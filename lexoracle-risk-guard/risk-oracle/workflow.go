package main

import (
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/shopspring/decimal"

	sdk "github.com/smartcontractkit/chainlink-protos/cre/go/sdk"
	"github.com/smartcontractkit/cre-sdk-go/capabilities/blockchain/evm"
	"github.com/smartcontractkit/cre-sdk-go/capabilities/networking/http"
	"github.com/smartcontractkit/cre-sdk-go/capabilities/scheduler/cron"
	"github.com/smartcontractkit/cre-sdk-go/cre"
)

type EVMConfig struct {
	URWAAddress          string `json:"urwaAddress"`
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

// Transfer(address,address,uint256) event signature hash
var transferEventSigHash = crypto.Keccak256([]byte("Transfer(address,address,uint256)"))

func InitWorkflow(config *Config, logger *slog.Logger, secretsProvider cre.SecretsProvider) (cre.Workflow[*Config], error) {
	chainSelector, err := evm.ChainSelectorFromName(config.EVM.ChainName)
	if err != nil {
		return nil, fmt.Errorf("invalid chain: %w", err)
	}

	// EVM Log Trigger: listen for Transfer events from uRWA contract
	urwaAddress := common.HexToAddress(config.EVM.URWAAddress)
	logTriggerCfg := &evm.FilterLogTriggerRequest{
		Addresses: [][]byte{urwaAddress.Bytes()},
		Topics: []*evm.TopicValues{
			{Values: [][]byte{transferEventSigHash}},
		},
		Confidence: evm.ConfidenceLevel_CONFIDENCE_LEVEL_FINALIZED,
	}
	logTrigger := evm.LogTrigger(chainSelector, logTriggerCfg)

	return cre.Workflow[*Config]{
		// Handler 1: Cron-based periodic assessment (for demo / fallback)
		cre.Handler(
			cron.Trigger(&cron.Config{Schedule: config.Schedule}),
			onCronTrigger,
		),
		// Handler 2: Event-driven assessment triggered by uRWA Transfer events
		cre.Handler(
			logTrigger,
			onTransferTrigger,
		),
	}, nil
}

// onCronTrigger assesses the pre-configured wallet address on a schedule.
func onCronTrigger(config *Config, runtime cre.Runtime, _ *cron.Payload) (string, error) {
	logger := runtime.Logger()
	logger.Info("Cron trigger fired — assessing configured wallet", "wallet", config.WalletToAssess)
	return assessAndWrite(config, runtime, config.WalletToAssess)
}

// onTransferTrigger fires when uRWA emits Transfer(from, to, value).
// It assesses both the sender and receiver addresses.
func onTransferTrigger(config *Config, runtime cre.Runtime, log *evm.Log) (string, error) {
	logger := runtime.Logger()

	if len(log.Topics) < 3 {
		return "", fmt.Errorf("Transfer event expected 3 topics, got %d", len(log.Topics))
	}

	from := common.BytesToAddress(log.Topics[1][12:])
	to := common.BytesToAddress(log.Topics[2][12:])

	logger.Info("Transfer event detected",
		"from", from.Hex(),
		"to", to.Hex(),
		"block", log.BlockNumber,
	)

	var lastResult string
	for _, addr := range []common.Address{from, to} {
		if addr == (common.Address{}) {
			continue // skip zero address (mint events)
		}
		result, err := assessAndWrite(config, runtime, addr.Hex())
		if err != nil {
			logger.Error("Assessment failed for address", "address", addr.Hex(), "error", err)
			continue
		}
		lastResult = result
	}

	return lastResult, nil
}

// assessAndWrite is the shared core: call risk API → encode → report → write on-chain.
func assessAndWrite(config *Config, runtime cre.Runtime, wallet string) (string, error) {
	logger := runtime.Logger()

	client := &http.Client{}

	fetchFn := func(cfg *Config, l *slog.Logger, sr *http.SendRequester) (*RiskResult, error) {
		reqBody := fmt.Sprintf(
			`{"wallet_address":"%s","chain":"%s","provider":"goplus"}`,
			wallet, cfg.EVM.ChainName,
		)
		resp, err := sr.SendRequest(&http.Request{
			Url:     cfg.RiskAPIURL,
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

	riskData, err := http.SendRequest(config, runtime, client, fetchFn, cre.ConsensusAggregationFromTags[*RiskResult]()).Await()
	if err != nil {
		return "", fmt.Errorf("risk assessment failed: %w", err)
	}

	logger.Info("Risk assessment result",
		"wallet", wallet,
		"score", riskData.Score.String(),
		"level", riskData.Level,
		"blacklisted", riskData.IsBlacklisted,
	)

	walletAddr := common.HexToAddress(wallet)

	addressType, _ := abi.NewType("address", "", nil)
	uint8Type, _ := abi.NewType("uint8", "", nil)
	uint256Type, _ := abi.NewType("uint256", "", nil)
	stringType, _ := abi.NewType("string", "", nil)
	boolType, _ := abi.NewType("bool", "", nil)

	encoded, err := abi.Arguments{
		{Type: addressType},
		{Type: uint8Type},
		{Type: uint256Type},
		{Type: stringType},
		{Type: boolType},
	}.Pack(
		walletAddr,
		mapRiskLevel(riskData.Level),
		riskData.Score.BigInt(),
		riskData.Reason,
		riskData.IsBlacklisted,
	)
	if err != nil {
		return "", fmt.Errorf("ABI encoding failed: %w", err)
	}

	report, err := runtime.GenerateReport(&sdk.ReportRequest{
		EncodedPayload: encoded,
		HashingAlgo:    "keccak256",
		SigningAlgo:    "ecdsa",
		EncoderName:    "evm",
	}).Await()
	if err != nil {
		return "", fmt.Errorf("report generation failed: %w", err)
	}

	chainSelector, _ := evm.ChainSelectorFromName(config.EVM.ChainName)
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
	)

	return fmt.Sprintf("assessed %s: score=%s level=%s tx=%s", wallet, riskData.Score.String(), riskData.Level, txHash), nil
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
