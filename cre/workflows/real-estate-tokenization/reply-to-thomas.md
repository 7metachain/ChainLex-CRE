Subject: Re: CRE Live Workflow Deployment Request - LexOracle Risk Guard (Updated)

Hi Thomas,

Thanks for the feedback — both issues have been fixed, and I'd like to explain why simulate is insufficient for our architecture.

## 1. Fixes applied

**Local URLs removed:** The workflow now uses GoPlus Security API (https://api.gopluslabs.io) as its primary public data source. No localhost references remain. Simulation passes with real GoPlus data (score=0, level=LOW, sources=goplus, TX_STATUS_SUCCESS).

**project.yaml at repo root:** Added with `don-family: "zone-a"` and `workflow-owner-address`.

## 2. Why simulate is insufficient — third-party data consumers

Our system isn't just a self-contained risk check. ChainlinkRisk functions as a **Compliance Feed** — the same trust model as Chainlink Price Feeds.

We've deployed a `ComplianceVault` contract (Sepolia: `0x71eb1C48A9504f226fE703606a7a3276a5F85815`) that represents a **third-party vault operator** accepting our ccTMMF token as deposits. Before allowing any deposit, the vault calls `ChainlinkRisk.isUserAllowed(depositor)` to verify compliance status.

Here's the trust problem:

```
Token issuer (us) runs simulate → writes risk data to ChainlinkRisk
Third-party vault reads ChainlinkRisk → "Who wrote this data?"
Answer: "The token issuer themselves"
→ Vault operator cannot trust self-reported compliance data
→ This is a conflict of interest that regulators flag
```

```
DON runs workflow → writes risk data to ChainlinkRisk via KeystoneForwarder
Third-party vault reads ChainlinkRisk → "Who wrote this data?"
Answer: "Chainlink DON — independently verified, BFT consensus, on-chain signature proof"
→ Vault operator can independently verify the data source
→ Satisfies FATF/MiCA "independent and verifiable" requirement
```

The vault doesn't trust us. It trusts the DON. This is identical to why Aave trusts Chainlink Price Feeds instead of asking token issuers to self-report prices.

With simulate, the compliance data is self-reported — the ComplianceVault integration has no verifiable trust anchor. Only DON deployment provides the independent attestation that third-party protocols require.

## 3. Deployment details

- Repo: https://github.com/7metachain/ChainLex-CRE (branch: `codex/mock-oracle-closed-loop`)
- Cron trigger: every 10 minutes. No faster.
- Testnet only (Sepolia, chainId 11155111). No mainnet writes.
- Time-limited deployment — can be deactivated after the hackathon.

Contracts on Sepolia:
| Contract | Address |
|----------|---------|
| ChainlinkRisk (Compliance Feed) | `0x376c431443FFFFaf23A97Ae2698664F58e3e9e5A` |
| uRWA v2 (ccTMMF token) | `0x704c1ea432B9bab6F9DFc6a7425a1fe6358c0a77` |
| LexOracleConsumer v2 (IReceiver) | `0xF97B5E5d8724cf9e6C2e5f3C7920e31669c1Dafe` |
| ComplianceVault (third-party consumer) | `0x71eb1C48A9504f226fE703606a7a3276a5F85815` |

## 4. Broadcast evidence (real Sepolia transactions)

We ran `cre simulate --broadcast` which produced a **real on-chain transaction** on Sepolia:

- **Tx:** [`0xc0cb044a...aa1804`](https://sepolia.etherscan.io/tx/0xc0cb044ac59393c10e668b66d280ba152136ed2730e3843898bd0f6757aa1804)
- **Block:** 10411693
- **Result:** score=0, level=LOW, sources=goplus

The uRWA contract has live activity — we minted 10,000 ccTMMF and executed a real Transfer event ([`0x6ac2d03b...`](https://sepolia.etherscan.io/tx/0x6ac2d03bb9a44a3284e0ec1122035ea0d73b3b203014a8668c38c2f31821d5a8)) so the EVM Log Trigger has real events to monitor.

## 5. Forwarder switch plan

The Consumer contract currently uses `MockKeystoneForwarder` for simulation. Once DON deployment access is granted, we'll switch to the production `KeystoneForwarder` (`0xF834...`) via a single `setForwarderAddress()` call — no redeployment needed. The README documents this step.

Happy to walk through the code or answer any questions.

Best,
Jiajia Chen
ChainLex.ai
