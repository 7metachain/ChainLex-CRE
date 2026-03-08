Subject: Re: CRE Live Workflow Deployment Request - LexOracle Risk Guard (Updated)

Hi Thomas,

Thanks for the feedback — you're right on both points. I've made the following changes:

## 1. Local URLs removed

The workflow now uses **GoPlus Security API** (https://api.gopluslabs.io) as its primary public data source. No localhost references remain in any config file. An optional self-hosted fallback API can be configured but is disabled by default.

Commit: `56030a5` — "feat: multi-source risk assessment via GoPlus public API"

## 2. project.yaml added to repo root

A root-level `project.yaml` with `don-family: "zone-a"` and `workflow-owner-address` is now present.

Commit: `95a46f3` — "fix: add project.yaml to repo root and configure don-family"

## 3. Why simulate is insufficient for our use case

Our project is a compliance rail for regulated tokenized money market funds (TMMF). Three architectural decisions make DON deployment a hard requirement, not a preference:

**a) Conflict of interest separation (regulatory requirement)**

The token issuer (us) must not be the same party running compliance checks. This is a basic regulatory principle (FATF Travel Rule, EU MiCA "independent and verifiable" data sources). Running simulate means we assess our own tokens — a conflict of interest that auditors would flag. DON provides independent third-party attestation.

**b) On-chain signature enforcement (smart contract requirement)**

Our `LexOracleConsumer` contract is configured with:
- `setExpectedWorkflowId()` — only accepts reports from our specific workflow
- `setExpectedWorkflowOwner()` — verifies the DON-attested owner address
- Forwarder check — only `KeystoneForwarder` can call `onReport()`

In production, `MockKeystoneForwarder` reports would be **rejected by the contract itself**. This makes DON a technical prerequisite, not optional.

**c) Multi-source DON consensus (data integrity)**

Each DON node independently calls GoPlus Security API and an optional internal risk model. The `median` consensus on risk scores means no single node (including the workflow operator) can manipulate the final assessment. A single machine running simulate cannot provide equivalent BFT guarantees.

**d) DON-exclusive enforcement (separation of duties in smart contract)**

We added `donFreeze()` to our uRWA token contract — a freeze function that **only the DON enforcer (LexOracleConsumer) can call**. The token issuer/owner explicitly cannot trigger this function. This code-enforced separation only works with real DON-signed reports.

## Updated repository

https://github.com/7metachain/ChainLex-CRE (branch: `codex/mock-oracle-closed-loop`)

Key files:
- `project.yaml` — root-level CRE config
- `lexoracle-risk-guard/risk-oracle/workflow.go` — CRE workflow (dual trigger: Cron + EVM Log)
- `contracts/LexOracleConsumer.sol` — DON-exclusive consumer with 3-layer verification
- `contracts/uRWA.sol` — ERC-7943 token with DON-authorized enforcement
- `contracts/ChainlinkRisk.sol` — on-chain risk assessment storage

Deployed contracts (Sepolia):
- ChainlinkRisk: `0x376c431443FFFFaf23A97Ae2698664F58e3e9e5A`
- uRWA (ccTMMF): `0xD9a655186Aaff2143e65F749CD26ED0DD3510Ee8`
- LexOracleConsumer: `0xA3cBCd430D2b3924ED627FC6919110346A329570`

Happy to provide any additional information or walk through the code.

Best,
Jiajia Chen
ChainLex.ai
