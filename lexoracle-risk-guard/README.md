# LexOracle Risk Guard — CRE Compliance Feed Workflow

A Chainlink CRE workflow that provides **DON-attested compliance data** for tokenized real-world assets (RWA). Functions as a Compliance Feed — the same trust model as Chainlink Price Feeds — enabling third-party protocols to verify user risk status independently of the token issuer.

## Architecture

```
GoPlus Security API (public, no auth)
        ↓
CRE DON Workflow (multi-node BFT consensus)
        ↓ WriteReport via KeystoneForwarder
LexOracleConsumer (IReceiver, 3-layer DON verification)
        ↓ updateRiskAssessment()
ChainlinkRisk (Compliance Feed)
        ↓ isUserAllowed()
  ┌─────┴──────────────┐
  │                     │
  uRWA token            ComplianceVault
  (self-check)          (third-party consumer)
```

**Why DON is required:** ComplianceVault is a third-party vault that accepts ccTMMF token deposits. It reads compliance data from ChainlinkRisk before allowing deposits. The vault operator is a different party than the token issuer — they cannot trust self-reported compliance data (simulate). Only DON-attested data provides independent, verifiable trust.

## Contracts (Sepolia Testnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| ChainlinkRisk | [`0x376c...9e5A`](https://sepolia.etherscan.io/address/0x376c431443FFFFaf23A97Ae2698664F58e3e9e5A) | Compliance Feed — stores DON-attested risk assessments |
| uRWA v2 (ccTMMF) | [`0x704c...0a77`](https://sepolia.etherscan.io/address/0x704c1ea432B9bab6F9DFc6a7425a1fe6358c0a77) | ERC-7943 RWA token with DON-authorized freeze |
| LexOracleConsumer v2 | [`0xF97B...Dafe`](https://sepolia.etherscan.io/address/0xF97B5E5d8724cf9e6C2e5f3C7920e31669c1Dafe) | IReceiver — forwarder check + workflow identity + temporal integrity |
| ComplianceVault | [`0x71eb...5815`](https://sepolia.etherscan.io/address/0x71eb1C48A9504f226fE703606a7a3276a5F85815) | Third-party vault gated on Compliance Feed |

## Workflow Triggers

| Trigger | Behavior |
|---------|----------|
| **Cron** (every 10 min) | Periodically assess a configured wallet address |
| **EVM Log** (Transfer event) | Assess sender and receiver on every uRWA token transfer |

## Data Sources

- **Primary:** [GoPlus Security API](https://api.gopluslabs.io) — public, no auth, checks 10+ risk flags (sanctions, phishing, mixer, etc.)
- **Secondary (optional):** Self-hosted risk model via `fallbackApiUrl` config

Each DON node independently calls all data sources. Results are aggregated via BFT consensus (`median` for scores, `identical` for categorical fields).

## Quick Start

### Prerequisites

- [CRE CLI](https://docs.chain.link/cre/getting-started/cli-installation) installed
- CRE account (`cre login`)
- Go 1.25.3+ (auto-downloaded via GOTOOLCHAIN)

### Simulate

```bash
cd lexoracle-risk-guard
cre workflow simulate risk-oracle --target staging-settings
```

Select trigger `1` (cron) when prompted. Expected output:

```
[USER LOG] Risk consensus result wallet=0x742d35... score=0 level=LOW sources=goplus
[USER LOG] Written to primary chain txHash=0x000... txStatus=TX_STATUS_SUCCESS
✓ Workflow Simulation Result: "assessed 0x742d35...: score=0 level=LOW"
```

### Deploy (requires Early Access)

```bash
cre workflow deploy risk-oracle --target production-settings
```

## Key Files

| File | Description |
|------|-------------|
| `risk-oracle/workflow.go` | Main workflow: GoPlus fetch → consensus → ABI encode → report → chain write |
| `risk-oracle/main.go` | WASM entry point |
| `risk-oracle/config.staging.json` | Staging config (30s cron, Sepolia) |
| `risk-oracle/config.production.json` | Production config (10min cron, Sepolia) |
| `risk-oracle/workflow.yaml` | Workflow name and artifact paths |
| `project.yaml` | CRE project settings (don-family, RPCs) |

## DON Security Layers

The LexOracleConsumer contract enforces three verification layers:

1. **Forwarder check** — only KeystoneForwarder can call `onReport()`
2. **Workflow identity** — `expectedWorkflowId` and `expectedWorkflowOwner` validation
3. **Temporal integrity** — `maxReportAge` rejects stale or replayed reports

The uRWA token adds a fourth layer:

4. **DON-authorized enforcement** — `donFreeze()` can only be called by the DON enforcer, not the token issuer (separation of duties)

## License

MIT
