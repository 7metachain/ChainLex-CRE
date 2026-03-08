package main

import (
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/shopspring/decimal"

	sdk "github.com/smartcontractkit/chainlink-protos/cre/go/sdk"
	"github.com/smartcontractkit/cre-sdk-go/capabilities/blockchain/evm"
	"github.com/smartcontractkit/cre-sdk-go/capabilities/networking/http"
	"github.com/smartcontractkit/cre-sdk-go/capabilities/scheduler/cron"
	"github.com/smartcontractkit/cre-sdk-go/cre"
)

type EVMConfig struct {
	ChainlinkRiskAddress string `json:"chainlinkRiskAddress"`
	ConsumerAddress      string `json:"consumerAddress"`
	ChainName            string `json:"chainName"`
	GasLimit             uint64 `json:"gasLimit"`
}

type Config struct {
	Schedule       string    `json:"schedule"`
	RiskAPIURL     string    `json:"riskApiUrl"`
	WalletToAssess string    `json:"walletToAssess"`
	EVM            EVMConfig `json:"evm"`
}

type RiskResult struct {
	Score         decimal.Decimal `json:"score" consensus_aggregation:"median"`
	Level         string          `json:"level" consensus_aggregation:"identical"`
	IsBlacklisted bool            `json:"is_blacklisted" consensus_aggregation:"identical"`
	Reason        string          `json:"reason" consensus_aggregation:"identical"`
}

type RiskAPIResponse struct {
	WalletAddress string  `json:"wallet_address"`
	Score         float64 `json:"score"`
	Level         string  `json:"level"`
	IsBlacklisted bool    `json:"is_blacklisted"`
	Reason        string  `json:"reason"`
}

func InitWorkflow(config *Config, logger *slog.Logger, secretsProvider cre.SecretsProvider) (cre.Workflow[*Config], error) {
	return cre.Workflow[*Config]{
		cre.Handler(
			cron.Trigger(&cron.Config{Schedule: config.Schedule}),
			onCronTrigger,
		),
	}, nil
}

func onCronTrigger(config *Config, runtime cre.Runtime, _ *cron.Payload) (string, error) {
	logger := runtime.Logger()
	wallet := config.WalletToAssess

	logger.Info("Starting risk assessment", "wallet", wallet)

	// Step 1: Call risk API with DON consensus
	client := &http.Client{}
	riskPromise := http.SendRequest(config, runtime, client, fetchRisk, cre.ConsensusAggregationFromTags[*RiskResult]())

	riskData, err := riskPromise.Await()
	if err != nil {
		logger.Error("Risk API consensus failed", "error", err)
		return "", fmt.Errorf("risk assessment failed: %w", err)
	}

	logger.Info("Risk assessment result",
		"wallet", wallet,
		"score", riskData.Score.String(),
		"level", riskData.Level,
		"blacklisted", riskData.IsBlacklisted,
		"reason", riskData.Reason,
	)

	// Step 2: Encode risk data as ABI calldata for the consumer contract
	riskLevel := mapRiskLevel(riskData.Level)
	score := riskData.Score.BigInt()
	walletAddr := common.HexToAddress(wallet)

	addressType, _ := abi.NewType("address", "", nil)
	uint8Type, _ := abi.NewType("uint8", "", nil)
	uint256Type, _ := abi.NewType("uint256", "", nil)
	stringType, _ := abi.NewType("string", "", nil)
	boolType, _ := abi.NewType("bool", "", nil)

	args := abi.Arguments{
		{Type: addressType},
		{Type: uint8Type},
		{Type: uint256Type},
		{Type: stringType},
		{Type: boolType},
	}

	encoded, err := args.Pack(
		walletAddr,
		riskLevel,
		score,
		riskData.Reason,
		riskData.IsBlacklisted,
	)
	if err != nil {
		return "", fmt.Errorf("ABI encoding failed: %w", err)
	}

	// Step 3: Generate signed report and write to chain
	report, err := runtime.GenerateReport(&sdk.ReportRequest{
		EncodedPayload: encoded,
		HashingAlgo:    "keccak256",
		SigningAlgo:    "ecdsa",
		EncoderName:    "evm",
	}).Await()
	if err != nil {
		return "", fmt.Errorf("report generation failed: %w", err)
	}

	chainSelector, err := evm.ChainSelectorFromName(config.EVM.ChainName)
	if err != nil {
		return "", fmt.Errorf("invalid chain: %w", err)
	}

	evmClient := &evm.Client{ChainSelector: chainSelector}
	receiverAddr := common.HexToAddress(config.EVM.ConsumerAddress)

	writeResult, err := evmClient.WriteReport(runtime, &evm.WriteCreReportRequest{
		Receiver: receiverAddr.Bytes(),
		Report:   report,
		GasConfig: &evm.GasConfig{
			GasLimit: config.EVM.GasLimit,
		},
	}).Await()
	if err != nil {
		return "", fmt.Errorf("onchain write failed: %w", err)
	}

	txHash := common.BytesToHash(writeResult.TxHash).Hex()
	logger.Info("Written to chain",
		"wallet", wallet,
		"score", riskData.Score.String(),
		"level", riskData.Level,
		"txHash", txHash,
		"txStatus", writeResult.TxStatus,
	)

	return fmt.Sprintf("assessed %s: score=%s level=%s tx=%s", wallet, riskData.Score.String(), riskData.Level, txHash), nil
}

func fetchRisk(config *Config, logger *slog.Logger, sendRequester *http.SendRequester) (*RiskResult, error) {
	reqBody := fmt.Sprintf(
		`{"wallet_address":"%s","chain":"%s","provider":"goplus"}`,
		config.WalletToAssess, config.EVM.ChainName,
	)

	resp, err := sendRequester.SendRequest(&http.Request{
		Url:     config.RiskAPIURL,
		Method:  "POST",
		Headers: map[string]string{"Content-Type": "application/json"},
		Body:    []byte(reqBody),
	}).Await()
	if err != nil {
		return nil, fmt.Errorf("risk API request failed: %w", err)
	}

	var apiResp RiskAPIResponse
	if err := json.Unmarshal(resp.Body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse risk response: %w", err)
	}

	return &RiskResult{
		Score:         decimal.NewFromFloat(apiResp.Score),
		Level:         apiResp.Level,
		IsBlacklisted: apiResp.IsBlacklisted,
		Reason:        apiResp.Reason,
	}, nil
}

func mapRiskLevel(level string) uint8 {
	switch level {
	case "LOW":
		return 1
	case "MEDIUM":
		return 2
	case "HIGH":
		return 3
	case "BLOCKED":
		return 4
	default:
		return 0
	}
}
