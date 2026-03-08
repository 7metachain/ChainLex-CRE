Subject: Re: CRE Live Workflow Deployment Request - LexOracle Risk Guard

Hi CRE Team,

Thanks for the review process. Sharing the details for our live CRE deployment request.

1) Why live deployment is required (beyond `cre simulate`)

Our hackathon deliverable is a real-estate tokenization compliance rail. Simulation is already used for development, but final judging requires verifiable live DON execution evidence:

- autonomous trigger execution from real on-chain transfer logs,
- live DON consensus on risk scoring,
- testnet on-chain writeback transaction proof via `ChainlinkRisk.updateRiskAssessment(...)`.

This proof cannot be fully established through local simulation alone.

2) Repository URL

- GitHub: <REPLACE_ME_GITHUB_URL>
- If private, reviewer access granted to: `thodges-gh`

3) Deployment readiness checklist

- Cron trigger: every 10 minutes (no faster).
- Mainnet writes: disabled; testnet only (`chainId=11155111`, Sepolia).
- Log trigger:
  - Contract: `0xD9a655186Aaff2143e65F749CD26ED0DD3510Ee8` (uRWA / ccTMMF)
  - Event: `Transfer(address,address,uint256)`
- Consumer contract (IReceiver): `0xA3cBCd430D2b3924ED627FC6919110346A329570`
  - Forwards decoded risk data to ChainlinkRisk.updateRiskAssessment()
- ChainlinkRisk contract: `0x376c431443FFFFaf23A97Ae2698664F58e3e9e5A`
  - Stores on-chain risk assessments; Consumer is authorized caller
- Risk API: hosted backend (`/risk-assessment` endpoint)
  - Primary and fallback currently use the same endpoint; will separate post-hackathon
- Audit callback: `POST /api/oracle/audit-ingest` (receives and persists attestation logs)
- HTTP trigger: not used in current live path.

4) Simulation evidence

`cre workflow simulate` passed successfully on 2026-03-08:
- Trigger: cron-trigger@1.0.0
- Steps: http-actions → consensus → report generation → evm write
- Result: score=807, level=HIGH, txStatus=TX_STATUS_SUCCESS
- Workflow name: lexoracle-risk-guard-staging

We acknowledge this is a one-time deployment window and the workflow has been finalized for that deployment.

Best,
<REPLACE_ME_NAME>
ChainLex.ai
