# Live Deployment Review Checklist (CRE)

Use this checklist before sending to reviewer.

## Hard Requirements

- [ ] Workflow is final and immutable-safe for one-time deployment.
- [ ] No mainnet writes anywhere in config or code paths.
- [ ] All chain IDs are testnet only.
- [ ] Cron frequency is no faster than every 10 minutes.
- [ ] Log trigger contract address is final and correct.
- [ ] Log trigger event signature exactly matches deployed contract ABI.
- [ ] If HTTP trigger is enabled, `authorizedKeys` is configured.

## ChainLex Contract Safety

- [ ] `ChainlinkRisk` deployed on target testnet.
- [ ] CRE writer address is granted `setAuthorizedCaller(writer, true)`.
- [ ] `uRWA` points to the same `ChainlinkRisk` address.
- [ ] Risk threshold and staleness params are configured.

## Data and Policy

- [ ] Risk score normalization is deterministic.
- [ ] Blacklist overrides score policy is documented.
- [ ] Reason strings are bounded (no unbounded payload risk).
- [ ] Idempotency key and duplicate handling are enabled.

## Reliability and Security

- [ ] Risk API primary and fallback endpoints both tested.
- [ ] Retries and backoff tested under timeout conditions.
- [ ] Secrets are injected securely (no plaintext keys in repo).
- [ ] Audit logs include runId <-> txHash mapping.

## Demo Evidence

- [ ] `cre simulate` result captured for same workflow spec.
- [ ] At least one successful testnet writeback transaction hash recorded.
- [ ] Dashboard shows attestation + on-chain writeback evidence.
