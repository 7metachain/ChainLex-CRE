# Implementation Notes for ChainLex Integration

This CRE workflow package maps directly to existing ChainLex APIs and contracts.

## Existing ChainLex endpoints

- Risk assess and persistence/writeback entrypoint:
  - `POST /api/oracle/mock-assess`
- Attestation history:
  - `GET /api/oracle/attestations`

## Existing ChainLex contracts

- `contracts/ChainlinkRisk.sol`
  - writeback function: `updateRiskAssessment(address,uint8,uint256,string,bool)`
- `contracts/uRWA.sol`
  - transfer policy checks against `ChainlinkRisk`

## Required environment

Fill `.env.local` using values documented in `.env.example`:

- `ORACLE_WRITEBACK_RPC_URL`
- `ORACLE_WRITEBACK_PRIVATE_KEY`
- `ORACLE_CHAINLINK_RISK_ADDRESS`
- `ORACLE_WRITEBACK_CHAIN_ID`

For deployment API hardening:

- `FOUNDRY_PROJECT_ROOT`
- `FOUNDRY_RPC_URL`
- `FOUNDRY_PRIVATE_KEY`
- `FOUNDRY_VERIFY`
- `FOUNDRY_ETHERSCAN_API_KEY` (if verify enabled)

## Recommended Production API swap

Replace mock provider path behind `/api/oracle/mock-assess` with real provider adapters:

1. GoPlus / sanctions list / geofence adapters
2. score normalizer
3. confidence score and source provenance tags
4. policy engine for jurisdiction-specific risk thresholds

Do not change contract-level enum mapping:

- `LOW -> 1`
- `MEDIUM -> 2`
- `HIGH -> 3`
- `BLOCKED -> 4`
