package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"time"
)

type chainlexAssessRequest struct {
	WalletAddress string `json:"walletAddress"`
	Chain         string `json:"chain"`
	Provider      string `json:"provider"`
}

type riskRequest struct {
	WalletAddress string `json:"wallet_address"`
	Chain         string `json:"chain"`
	Provider      string `json:"provider"`
}

func main() {
	var walletAddress string
	var chain string
	var provider string
	var mode string
	var chainlexAPIBase string
	var riskAPIBase string

	flag.StringVar(&walletAddress, "wallet", "", "Wallet address to assess (0x...)")
	flag.StringVar(&chain, "chain", "sepolia", "Chain name")
	flag.StringVar(&provider, "provider", "mock-chainalysis", "Risk provider label")
	flag.StringVar(&mode, "mode", "chainlex", "Mode: chainlex | risk")
	flag.StringVar(&chainlexAPIBase, "chainlex-api", "", "ChainLex API base URL (defaults to CHAINLEX_API_BASE or http://localhost:3000)")
	flag.StringVar(&riskAPIBase, "risk-api", "", "Risk API base URL (defaults to CHATBOT_API_BASE or http://localhost:8000)")
	flag.Parse()

	if walletAddress == "" {
		fmt.Fprintln(os.Stderr, "wallet address is required: use -wallet 0x...")
		os.Exit(1)
	}

	client := &http.Client{Timeout: 20 * time.Second}

	switch mode {
	case "chainlex":
		if chainlexAPIBase == "" {
			chainlexAPIBase = os.Getenv("CHAINLEX_API_BASE")
		}
		if chainlexAPIBase == "" {
			chainlexAPIBase = "http://localhost:3000"
		}

		body, err := json.Marshal(chainlexAssessRequest{
			WalletAddress: walletAddress,
			Chain:         chain,
			Provider:      provider,
		})
		if err != nil {
			fmt.Fprintln(os.Stderr, "failed to encode request:", err)
			os.Exit(1)
		}

		resp, err := client.Post(chainlexAPIBase+"/api/oracle/mock-assess", "application/json", bytes.NewReader(body))
		if err != nil {
			fmt.Fprintln(os.Stderr, "request failed:", err)
			os.Exit(1)
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 300 {
			fmt.Fprintln(os.Stderr, "chainlex oracle API error:", resp.Status)
			os.Exit(1)
		}

		var result map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			fmt.Fprintln(os.Stderr, "failed to decode response:", err)
			os.Exit(1)
		}

		encoded, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(encoded))
	case "risk":
		if riskAPIBase == "" {
			riskAPIBase = os.Getenv("CHATBOT_API_BASE")
		}
		if riskAPIBase == "" {
			riskAPIBase = "http://localhost:8000"
		}

		body, err := json.Marshal(riskRequest{
			WalletAddress: walletAddress,
			Chain:         chain,
			Provider:      provider,
		})
		if err != nil {
			fmt.Fprintln(os.Stderr, "failed to encode request:", err)
			os.Exit(1)
		}

		resp, err := client.Post(riskAPIBase+"/risk-assessment", "application/json", bytes.NewReader(body))
		if err != nil {
			fmt.Fprintln(os.Stderr, "request failed:", err)
			os.Exit(1)
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 300 {
			fmt.Fprintln(os.Stderr, "risk API error:", resp.Status)
			os.Exit(1)
		}

		var result map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			fmt.Fprintln(os.Stderr, "failed to decode response:", err)
			os.Exit(1)
		}

		encoded, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(encoded))
	default:
		fmt.Fprintln(os.Stderr, "invalid mode, expected one of: chainlex | risk")
		os.Exit(1)
	}
}
