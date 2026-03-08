# CRE Workflow: Real Estate Tokenization Risk Guard

This package defines a production-grade CRE workflow for ChainLex.ai that continuously monitors real-estate token transfers, performs AML/sanctions risk checks, and writes the risk decision back on-chain.

## Business Objective

Protect RWA real-estate secondary trading with automatic compliance controls:

- Block sanctioned or blacklisted wallets before settlement.
- Keep an auditable, on-chain risk trail for regulators and custodians.
- Reduce manual compliance review load for high-frequency transfer flows.

## Workflow Topology

1. Trigger: `log` trigger on `uRWA.Transfer(address,address,uint256)` for a fixed testnet contract.
2. Enrichment: resolve `from`, `to`, `amount`, `txHash`, `logIndex`, `blockTime`.
3. Risk Fetch: query risk provider API (primary + fallback endpoint).
4. Consensus: DON median/majority aggregation into normalized risk model.
5. Policy: convert provider score to ChainLex risk levels (`LOW/MEDIUM/HIGH/BLOCKED`).
6. On-chain Action: call `ChainlinkRisk.updateRiskAssessment(user, level, score, reason, isBlacklisted)`.
7. Off-chain Audit: POST signed run summary to ChainLex ingest API.

## Production Controls

- Testnet only (explicit chain ID allowlist).
- Idempotency key: `txHash:logIndex:user` to avoid duplicate writes.
- Retry with exponential backoff on risk API and writeback.
- Circuit breaker when provider SLA degrades.
- Dead-letter output for unresolved runs.
- HTTP trigger (if enabled) uses `authorizedKeys` only.
- Cron backfill no faster than 10 minutes (review requirement).

## SLO Targets

- P95 trigger-to-writeback latency: < 45s
- Successful writeback rate: >= 99%
- False-positive freeze ratio: < 1%

## Files in this folder

- `workflow-spec.json`: deployment-ready logical spec.
- `deployment-request.md`: email reply template for reviewer.
- `review-checklist.md`: pre-deploy hard gate checklist.
- `simulate-input.example.json`: sample event payload for simulation.

## How to use this package

1. Fill all `REPLACE_ME_*` values in `workflow-spec.json`.
2. Run through `review-checklist.md` item-by-item.
3. Paste `deployment-request.md` into your reviewer reply with final values.
4. Run `cre simulate` with `simulate-input.example.json` before requesting live deployment.
