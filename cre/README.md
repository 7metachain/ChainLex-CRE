# CRE Local Simulation (HTTP Trigger)

This directory contains a minimal local runner that simulates a CRE workflow using HTTP triggers.
It calls the mock risk API (`/risk-assessment`) and prints the normalized risk payload. This is
intended as the fastest way to validate the closed-loop logic before wiring real CRE tooling.

## Prerequisites

- Go 1.21+
- The chatbot service running locally (default `http://localhost:8000`)

## Run

```bash
cd cre/local-runner
go run . -wallet 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
```

Optional flags:

- `-api` override mock API base (default `CHATBOT_API_BASE` or `http://localhost:8000`)
- `-chain` chain label (default `sepolia`)
- `-provider` provider label (default `mock-chainalysis`)

## Next Steps

- Replace this runner with a real CRE workflow (Go/WASM) when DON + CLI is ready.
- Add an on-chain writer step to call `ChainlinkRisk.updateRiskAssessment` via a receiver contract.

## Production Workflow Package

A deployment-ready CRE workflow package for real-estate tokenization is included at:

- `cre/workflows/real-estate-tokenization/README.md`
- `cre/workflows/real-estate-tokenization/workflow-spec.json`
- `cre/workflows/real-estate-tokenization/review-checklist.md`
- `cre/workflows/real-estate-tokenization/deployment-request.md`

Use this package for live deployment requests and reviewer communication.
