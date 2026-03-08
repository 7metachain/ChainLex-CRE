package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"strings"

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

// ---------------------------------------------------------------------------
// Config types
// ---------------------------------------------------------------------------

type EVMConfig struct {
	URWAAddress          string `json:"urwaAddress"`
	ChainlinkRiskAddress string `json:"chainlinkRiskAddress"`
	ConsumerAddress      string `json:"consumerAddress"`
	ChainName            string `json:"chainName"`
	GasLimit             uint64 `json:"gasLimit"`
}

type Config struct {
	Schedule       string      `json:"schedule"`
	GoPlusChainID  string      `json:"goPlusChainId"`
	FallbackAPIURL string      `json:"fallbackApiUrl"`
	WalletToAssess string      `json:"walletToAssess"`
	EVM            EVMConfig   `json:"evm"`
	CrossChainEVMs []EVMConfig `json:"crossChainEvms"`
}

// ---------------------------------------------------------------------------
// Risk data types — consensus tags drive DON aggregation
// ---------------------------------------------------------------------------

type RiskResult struct {
	Score         decimal.Decimal `json:"score" consensus_aggregation:"median"`
	Level         string          `json:"level" consensus_aggregation:"identical"`
	IsBlacklisted bool            `json:"is_blacklisted" consensus_aggregation:"identical"`
	Reason        string          `json:"reason" consensus_aggregation:"identical"`
	Sources       string          `json:"sources" consensus_aggregation:"identical"`
}

// GoPlus API response shape — result is a flat map of string→string flags
type GoPlusResponse struct {
	Code    int               `json:"code"`
	Message string            `json:"message"`
	Result  map[string]string `json:"result"`
}

// Fallback risk API response (our Python backend)
type FallbackAPIResponse struct {
	WalletAddress string  `json:"wallet_address"`
	Score         float64 `json:"score"`
	Level         string  `json:"level"`
	IsBlacklisted bool    `json:"is_blacklisted"`
	Reason        string  `json:"reason"`
}

// Transfer(address,address,uint256) event signature hash
var transferEventSigHash = crypto.Keccak256([]byte("Transfer(address,address,uint256)"))

// ---------------------------------------------------------------------------
// Workflow initialization — dual trigger (Cron + EVM Log)
// ---------------------------------------------------------------------------

func InitWorkflow(config *Config, logger *slog.Logger, secretsProvider cre.SecretsProvider) (cre.Workflow[*Config], error) {
	chainSelector, err := evm.ChainSelectorFromName(config.EVM.ChainName)
	if err != nil {
		return nil, fmt.Errorf("invalid chain: %w", err)
	}

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
		cre.Handler(cron.Trigger(&cron.Config{Schedule: config.Schedule}), onCronTrigger),
		cre.Handler(logTrigger, onTransferTrigger),
	}, nil
}

// ---------------------------------------------------------------------------
// Trigger handlers
// ---------------------------------------------------------------------------

func onCronTrigger(config *Config, runtime cre.Runtime, _ *cron.Payload) (string, error) {
	logger := runtime.Logger()
	logger.Info("Cron trigger fired", "wallet", config.WalletToAssess)
	return assessAndWrite(config, runtime, config.WalletToAssess)
}

func onTransferTrigger(config *Config, runtime cre.Runtime, log *evm.Log) (string, error) {
	logger := runtime.Logger()

	if len(log.Topics) < 3 {
		return "", fmt.Errorf("Transfer event expected 3 topics, got %d", len(log.Topics))
	}

	from := common.BytesToAddress(log.Topics[1][12:])
	to := common.BytesToAddress(log.Topics[2][12:])

	logger.Info("Transfer event detected", "from", from.Hex(), "to", to.Hex())

	var lastResult string
	for _, addr := range []common.Address{from, to} {
		if addr == (common.Address{}) {
			continue
		}
		result, err := assessAndWrite(config, runtime, addr.Hex())
		if err != nil {
			logger.Error("Assessment failed", "address", addr.Hex(), "error", err)
			continue
		}
		lastResult = result
	}
	return lastResult, nil
}

// ---------------------------------------------------------------------------
// Core: multi-source risk assessment → ABI encode → DON report → chain write
// ---------------------------------------------------------------------------

func assessAndWrite(config *Config, runtime cre.Runtime, wallet string) (string, error) {
	logger := runtime.Logger()
	client := &http.Client{}

	// Each DON node independently calls GoPlus (primary, public) and the
	// fallback API (secondary). Results are merged locally, then
	// DON-level BFT consensus produces a single trusted score.
	fetchFn := func(cfg *Config, l *slog.Logger, sr *http.SendRequester) (*RiskResult, error) {
		return fetchMultiSource(cfg, l, sr, wallet)
	}

	riskData, err := http.SendRequest(config, runtime, client, fetchFn,
		cre.ConsensusAggregationFromTags[*RiskResult](),
	).Await()
	if err != nil {
		return "", fmt.Errorf("risk assessment consensus failed: %w", err)
	}

	logger.Info("Risk consensus result",
		"wallet", wallet,
		"score", riskData.Score.String(),
		"level", riskData.Level,
		"blacklisted", riskData.IsBlacklisted,
		"sources", riskData.Sources,
	)

	walletAddr := common.HexToAddress(wallet)

	encoded, err := encodeRiskData(walletAddr, riskData)
	if err != nil {
		return "", err
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
	logger.Info("Written to primary chain", "wallet", wallet, "chain", config.EVM.ChainName, "txHash", txHash)

	// Cross-chain compliance passport: replicate risk data to additional chains
	for _, xEvm := range config.CrossChainEVMs {
		xChainSelector, err := evm.ChainSelectorFromName(xEvm.ChainName)
		if err != nil {
			logger.Error("Cross-chain: invalid chain name", "chain", xEvm.ChainName, "error", err)
			continue
		}

		xReport, err := runtime.GenerateReport(&sdk.ReportRequest{
			EncodedPayload: encoded,
			HashingAlgo:    "keccak256",
			SigningAlgo:    "ecdsa",
			EncoderName:    "evm",
		}).Await()
		if err != nil {
			logger.Error("Cross-chain: report generation failed", "chain", xEvm.ChainName, "error", err)
			continue
		}

		xClient := &evm.Client{ChainSelector: xChainSelector}
		xReceiver := common.HexToAddress(xEvm.ConsumerAddress)

		xResult, err := xClient.WriteReport(runtime, &evm.WriteCreReportRequest{
			Receiver: xReceiver.Bytes(),
			Report:   xReport,
			GasConfig: &evm.GasConfig{
				GasLimit: xEvm.GasLimit,
			},
		}).Await()
		if err != nil {
			logger.Error("Cross-chain: write failed", "chain", xEvm.ChainName, "error", err)
			continue
		}
		xTxHash := common.BytesToHash(xResult.TxHash).Hex()
		logger.Info("Written to cross-chain", "chain", xEvm.ChainName, "txHash", xTxHash)
	}

	return fmt.Sprintf("assessed %s: score=%s level=%s sources=%s tx=%s",
		wallet, riskData.Score.String(), riskData.Level, riskData.Sources, txHash), nil
}

// ---------------------------------------------------------------------------
// Multi-source data fetching (GoPlus + fallback)
// ---------------------------------------------------------------------------

func fetchMultiSource(cfg *Config, logger *slog.Logger, sr *http.SendRequester, wallet string) (*RiskResult, error) {
	var scores []float64
	var reasons []string
	var sources []string
	var blacklisted bool

	// Source 1: GoPlus Security API (public, no auth)
	goPlusScore, goPlusBlacklisted, goPlusReason, err := fetchGoPlus(sr, wallet, cfg.GoPlusChainID)
	if err != nil {
		logger.Error("GoPlus fetch failed, will rely on fallback", "error", err)
	} else {
		scores = append(scores, goPlusScore)
		reasons = append(reasons, "goplus:"+goPlusReason)
		sources = append(sources, "goplus")
		if goPlusBlacklisted {
			blacklisted = true
		}
	}

	// Source 2: Fallback risk API (optional, self-hosted)
	if cfg.FallbackAPIURL != "" {
		fbScore, fbBlacklisted, fbReason, err := fetchFallbackAPI(sr, wallet, cfg)
		if err != nil {
			logger.Error("Fallback API failed", "error", err)
		} else {
			scores = append(scores, fbScore)
			reasons = append(reasons, "internal:"+fbReason)
			sources = append(sources, "internal")
			if fbBlacklisted {
				blacklisted = true
			}
		}
	}

	if len(scores) == 0 {
		return nil, fmt.Errorf("all risk data sources failed for %s", wallet)
	}

	avgScore := 0.0
	for _, s := range scores {
		avgScore += s
	}
	avgScore /= float64(len(scores))
	finalScore := math.Min(avgScore, 1000)

	level := scoreToLevel(finalScore)
	if blacklisted {
		level = "BLOCKED"
		finalScore = math.Max(finalScore, 900)
	}

	return &RiskResult{
		Score:         decimal.NewFromFloat(finalScore),
		Level:         level,
		IsBlacklisted: blacklisted,
		Reason:        strings.Join(reasons, "; "),
		Sources:       strings.Join(sources, ","),
	}, nil
}

func fetchGoPlus(sr *http.SendRequester, wallet string, chainID string) (float64, bool, string, error) {
	if chainID == "" {
		chainID = "1"
	}
	url := fmt.Sprintf("https://api.gopluslabs.io/api/v1/address_security/%s?chain_id=%s", wallet, chainID)

	resp, err := sr.SendRequest(&http.Request{
		Url:    url,
		Method: "GET",
	}).Await()
	if err != nil {
		return 0, false, "", fmt.Errorf("GoPlus request failed: %w", err)
	}

	var gp GoPlusResponse
	if err := json.Unmarshal(resp.Body, &gp); err != nil {
		return 0, false, "", fmt.Errorf("GoPlus parse failed: %w", err)
	}

	if gp.Result == nil || len(gp.Result) == 0 {
		return 100, false, "no data from GoPlus (treated as low risk)", nil
	}

	score := 0.0
	var flags []string

	riskKeys := []string{
		"honeypot_related_address", "phishing_activities", "blacklist_doubt",
		"stealing_attack", "blackmail_activities", "cybercrime",
		"money_laundering", "financial_crime", "mixer", "sanctioned",
	}
	for _, key := range riskKeys {
		if gp.Result[key] == "1" {
			score += 150
			flags = append(flags, key)
		}
	}

	blacklisted := gp.Result["sanctioned"] == "1" || gp.Result["blacklist_doubt"] == "1"
	if blacklisted && score < 900 {
		score = 900
	}
	if score > 1000 {
		score = 1000
	}
	if len(flags) == 0 {
		flags = append(flags, "clean")
	}

	reason := fmt.Sprintf("GoPlus flags: %s", strings.Join(flags, ","))
	return score, blacklisted, reason, nil
}

func fetchFallbackAPI(sr *http.SendRequester, wallet string, cfg *Config) (float64, bool, string, error) {
	reqBody := fmt.Sprintf(
		`{"wallet_address":"%s","chain":"%s","provider":"internal"}`,
		wallet, cfg.EVM.ChainName,
	)
	resp, err := sr.SendRequest(&http.Request{
		Url:     cfg.FallbackAPIURL,
		Method:  "POST",
		Headers: map[string]string{"Content-Type": "application/json"},
		Body:    []byte(reqBody),
	}).Await()
	if err != nil {
		return 0, false, "", fmt.Errorf("fallback API request failed: %w", err)
	}

	var fb FallbackAPIResponse
	if err := json.Unmarshal(resp.Body, &fb); err != nil {
		return 0, false, "", fmt.Errorf("fallback parse failed: %w", err)
	}

	return fb.Score, fb.IsBlacklisted, fb.Reason, nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func scoreToLevel(score float64) string {
	switch {
	case score >= 900:
		return "BLOCKED"
	case score >= 700:
		return "HIGH"
	case score >= 400:
		return "MEDIUM"
	default:
		return "LOW"
	}
}

func encodeRiskData(walletAddr common.Address, risk *RiskResult) ([]byte, error) {
	addressType, _ := abi.NewType("address", "", nil)
	uint8Type, _ := abi.NewType("uint8", "", nil)
	uint256Type, _ := abi.NewType("uint256", "", nil)
	stringType, _ := abi.NewType("string", "", nil)
	boolType, _ := abi.NewType("bool", "", nil)

	return abi.Arguments{
		{Type: addressType},
		{Type: uint8Type},
		{Type: uint256Type},
		{Type: stringType},
		{Type: boolType},
	}.Pack(
		walletAddr,
		mapRiskLevel(risk.Level),
		risk.Score.BigInt(),
		risk.Reason,
		risk.IsBlacklisted,
	)
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
