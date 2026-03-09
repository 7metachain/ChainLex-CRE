# LexOracle Compliance Monitor — Dashboard Design Spec

> One-line pitch: See a Transfer happen on-chain → CRE auto-triggers → risk score lands on-chain → high-risk address gets frozen — all traceable in one screen.

---

## Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  SECTION 1: Workflow Status Bar (full-width banner)                 │
├───────────┬───────────┬───────────┬───────────┬─────────────────────┤
│  Oracle   │ On-chain  │ High-Risk │  FREEZE   │   Vault             │
│  Checks   │ Writes    │ Detected  │  Actions  │   Rejected          │
├───────────┴───────────┴───────────┴───────────┴─────────────────────┤
│  SECTION 3: CRE Workflow Pipeline (latest execution, 7-step viz)    │
├─────────────────────────────────┬───────────────────────────────────┤
│  SECTION 4: Oracle Event Feed   │  SECTION 5: ComplianceVault Gate  │
│  (live, auto-refresh)           │  (third-party consumer status)    │
├─────────────────────────────────┴───────────────────────────────────┤
│  SECTION 6: Risk Score Trend        │  Risk Distribution Donut      │
└─────────────────────────────────────┴───────────────────────────────┘
```

---

## Section 1 — Workflow Status Bar

Full-width banner. Instant system health at a glance.

```
┌─────────────────────────────────────────────────────────────────────┐
│  LexOracle Compliance Monitor                                       │
│  CRE Workflow: ● ACTIVE    Last: 2 min ago    Sepolia Testnet       │
│  ChainlinkRisk: 0x1a2b...↗  uRWA: 0x3c4d...↗  Consumer: 0x5e6f...↗│
└─────────────────────────────────────────────────────────────────────┘
```

| Element | Source | Notes |
|---------|--------|-------|
| Status dot | Latest event timestamp | Green pulse (< 10 min), Yellow (10–60 min), Red (> 1 hr) |
| "Last: X ago" | `attestations[0].createdAt` | Relative time |
| Network badge | `.env.local` | `Sepolia Testnet` / `Mainnet` |
| Contract addresses | `ORACLE_CHAINLINKRISK_ADDRESS`, `ORACLE_URWA_ADDRESS`, `ORACLE_CONSUMER_ADDRESS` | Truncated, each links to Etherscan |

---

## Section 2 — KPI Cards (5 cards)

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│    47    │ │    38    │ │     6    │ │     3    │ │     1    │
│  Oracle  │ │ On-chain │ │  HIGH    │ │  FREEZE  │ │  Vault   │
│  Checks  │ │  Writes  │ │  Risk    │ │  Actions │ │ Rejected │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

| Card | Icon | Value | Color |
|------|------|-------|-------|
| Oracle Checks | `Activity` | `attestations.length` | Primary blue |
| On-chain Writes | `CheckCircle2` | `attestations.filter(s => s.status === "succeeded").length` | Green |
| High-Risk Detected | `AlertTriangle` | `attestations.filter(a => a.level === "HIGH" \|\| a.level === "BLOCKED").length` | Orange |
| FREEZE Actions | `Shield` | Count of `action === "FREEZE"` events | Red |
| Vault Rejected | `Ban` | Count of ComplianceVault deposit rejections | Purple |

---

## Section 3 — CRE Workflow Pipeline

The demo highlight. Visualizes the most recent end-to-end execution as a 7-step horizontal flow with checkmarks.

```
┌─────────────────────────────────────────────────────────────────────┐
│  CRE Workflow Pipeline (latest execution)                           │
│                                                                     │
│  [Transfer] → [CRE Trigger] → [GoPlus API] → [DON Consensus]       │
│      ✓             ✓               ✓              ✓                 │
│      ↓                                                              │
│  [ChainlinkRisk] → [Event Emitted] → [Dashboard Updated]           │
│       ✓                  ✓                  ✓                       │
│                                                                     │
│  Score: 807   Level: HIGH   Action: FREEZE   Duration: 4.2s        │
└─────────────────────────────────────────────────────────────────────┘
```

### 7 Steps Detail

| Step | Label | Data shown | Source |
|------|-------|-----------|--------|
| ① | Transfer Detected | from/to address, token amount | EVM Log Trigger event |
| ② | CRE Triggered | Trigger type: `CronTrigger` or `LogTrigger` | workflow.go |
| ③ | GoPlus API Called | Data source name, raw score returned | GoPlus response |
| ④ | DON Consensus | Aggregation method (`identical`/`median`), node count | CRE consensus layer |
| ⑤ | ChainlinkRisk Updated | TX hash (clickable → Etherscan), confirmation status | Broadcast TX |
| ⑥ | Event Emitted | `RiskAssessmentUpdated(user, level, score, reason)` | On-chain event |
| ⑦ | Dashboard Updated | Refresh timestamp | Client-side |

### Step Status Indicators

- ✓ Green check = completed successfully
- ⏳ Spinner = in progress
- ✗ Red cross = failed (with error tooltip)
- ○ Grey circle = not yet reached

### Summary Bar (below the pipeline)

Shows key metrics of the latest execution in a single line:
`Score: 807  |  Level: HIGH  |  Action: FREEZE  |  Duration: 4.2s  |  TX: 0xabc...↗`

---

## Section 4 — Oracle Event Feed (Live)

Left column (≈60% width). Real-time scrollable list of all oracle executions. Auto-refreshes every 15 seconds.

```
┌─────────────────────────────────────────────────┐
│  Oracle Event Feed (Live)           Auto-refresh │
├─────────────────────────────────────────────────┤
│  ● 0x7f3a...  Score: 807  Level: HIGH           │
│    Action: FREEZE   TX: 0xabc...↗      2 min ago│
│─────────────────────────────────────────────────│
│  ○ 0x2b1c...  Score: 312  Level: LOW            │
│    Action: PASS     TX: 0xdef...↗      8 min ago│
│─────────────────────────────────────────────────│
│  ● 0x9e4d...  Score: 650  Level: MEDIUM         │
│    Action: REVIEW   TX: 0x123...↗     15 min ago│
│─────────────────────────────────────────────────│
│  [Load More]                                     │
└─────────────────────────────────────────────────┘
```

### Per-event fields

| Field | Type | Display |
|-------|------|---------|
| `walletAddress` | string | `0x7f3a...4e8f` (first 6 + last 4) |
| `score` | number | Bold, 0–1000 |
| `level` | enum | Badge: LOW=green, MEDIUM=yellow, HIGH=red, BLOCKED=purple |
| `action` | enum | **PASS** (green), **REVIEW** (yellow), **FREEZE** (red) |
| `txHash` | string | Monospace, clickable → `sepolia.etherscan.io/tx/{hash}` |
| `source` | string | "GoPlus" / "Multi-source" |
| `createdAt` | ISO string | Relative time ("2 min ago") |

### Left color bar

Each event card has a 3px left border colored by risk level:
- `LOW` → `border-green-500`
- `MEDIUM` → `border-yellow-500`
- `HIGH` → `border-red-500`
- `BLOCKED` → `border-purple-500`

### Required type change

Current `OracleAttestation` type needs two new fields:

```typescript
type OracleAttestation = {
  // ... existing fields ...
  txHash: string;                              // NEW — broadcast transaction hash
  action: "PASS" | "REVIEW" | "FREEZE";       // NEW — enforcement action taken
};
```

---

## Section 5 — ComplianceVault Gate

Right column (≈40% width). Shows how a third-party vault consumes oracle data — the core visual proof that DON is necessary.

```
┌─────────────────────────────────────────────────┐
│  ComplianceVault Gate            Sepolia ↗       │
├─────────────────────────────────────────────────┤
│  Vault:           0xABC...↗                      │
│  Token:           uRWA (ccTMMF)                  │
│  Compliance Feed: ChainlinkRisk (0x1a2b...)      │
│  Total Deposits:  50,000 uRWA                    │
│  Max Staleness:   3600s (1 hour)                 │
├─────────────────────────────────────────────────┤
│  Latest Gate Checks:                             │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  0x7f3a... → HIGH RISK                     │  │
│  │  ✗ DEPOSIT REJECTED                        │  │
│  │  Reason: Risk level too high (score: 807)  │  │
│  │  Data age: 4min < 1hr limit ✓                │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  0x2b1c... → LOW RISK                      │  │
│  │  ✓ DEPOSIT APPROVED                        │  │
│  │  Score: 120 · Data age: 2min ✓             │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  [ Check Address ]                               │
└─────────────────────────────────────────────────┘
```

### Data sources

| Field | Source |
|-------|--------|
| Vault address | `ORACLE_COMPLIANCEVAULT_ADDRESS` env var |
| Token / Compliance Feed | `ComplianceVault.token()` / `ComplianceVault.complianceFeed()` (on-chain read via viem) |
| Total Deposits | `ComplianceVault.totalDeposits()` (on-chain read) |
| Max Staleness | `ComplianceVault.maxStaleness()` (on-chain read) |
| Gate checks | `ComplianceVault.checkCompliance(address)` view function returns `(allowed, reason, score, lastUpdated)` |

### "Check Address" action

Input field + button. User enters a wallet address, clicks "Check Address", the UI calls `ComplianceVault.checkCompliance(addr)` via viem `readContract` and displays the result inline. No transaction needed — it's a `view` call.

---

## Section 6 — Charts Row

Two charts side by side (50/50 split), reusing the existing SVG chart components with improved data.

### 6a: Risk Score Trend (Line Chart)

```
┌─────────────────────────────────────────────────┐
│  Risk Score Trend                                │
│                                                  │
│  800─      *                                     │
│  600─ · · · · · · · · · · · threshold            │
│  400─ *        *                                  │
│  200─                  *    *                     │
│    0─┼────┼────┼────┼────┼────┼                  │
│     12:00 12:30 13:00 13:30 14:00 14:30          │
└─────────────────────────────────────────────────┘
```

| Improvement | Detail |
|-------------|--------|
| X-axis | Real timestamps from `attestations[].createdAt` instead of "Day 1, Day 2..." |
| Threshold line | Horizontal dashed red line at `score = 600` (HIGH threshold) |
| Point coloring | Points above threshold → red fill, below → blue fill |
| Tooltip | On hover: "Score: 807 · HIGH · 0x7f3a... · 12:34 PM" |

### 6b: Risk Distribution (Donut Chart)

```
┌─────────────────────────────────────────────────┐
│  Risk Distribution                               │
│                                                  │
│          ┌───────┐                               │
│         /  LOW    \                              │
│        │  60%     │                              │
│         \  MED   /                               │
│          └───────┘                               │
│                                                  │
│  ■ Low 60%   ■ Medium 20%                       │
│  ■ High 15%  ■ Blocked 5%                       │
└─────────────────────────────────────────────────┘
```

| Improvement | Detail |
|-------------|--------|
| Empty state | Show "No data yet" text instead of hardcoded percentages |
| Hover | Expand segment + tooltip with count & percentage |
| Colors | Low=`#10b981`, Medium=`#f59e0b`, High=`#ef4444`, Blocked=`#7c3aed` |

---

## Data Architecture

### API Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/dashboard/overview` | GET | Summary KPIs + deployments + attestations | Exists (needs `txHash`/`action` fields) |
| `/api/oracle/attestations` | GET | Paginated list of oracle events | Exists |
| `/api/oracle/audit-ingest` | POST | Receives CRE workflow callbacks | Exists |
| `/api/oracle/status` | GET | Workflow health, contract addresses, last run time | **New** |
| `/api/oracle/latest-pipeline` | GET | 7-step pipeline state for latest execution | **New** |
| `/api/oracle/mock-assess` | POST | Trigger manual risk assessment | Exists (to be deprecated) |

### Data flow

```
CRE Workflow (Go/WASM)
    │
    ├── broadcast TX → Sepolia (ChainlinkRisk.updateRiskAssessment)
    │
    └── POST /api/oracle/audit-ingest (callback with txHash, score, level, action)
            │
            ▼
        DB / attestation store
            │
            ├── GET /api/oracle/attestations    → Section 4: Event Feed
            ├── GET /api/oracle/latest-pipeline  → Section 3: Pipeline
            ├── GET /api/oracle/status           → Section 1: Status Bar
            ├── GET /api/dashboard/overview       → Section 2: KPI Cards
            └── viem readContract (ComplianceVault) → Section 5: Vault Gate
```

### Type definitions

```typescript
type OracleAttestation = {
  id: string;
  walletAddress: string;
  chain: string;
  provider: string;
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  isBlacklisted: boolean;
  reason: string;
  status: "succeeded" | "failed";
  createdAt: string;
  txHash: string;                              // NEW
  action: "PASS" | "REVIEW" | "FREEZE";       // NEW
};

type WorkflowStatus = {
  active: boolean;
  lastRunAt: string | null;
  network: string;
  contracts: {
    chainlinkRisk: string;
    urwa: string;
    consumer: string;
    complianceVault: string;
  };
};

type PipelineStep = {
  label: string;
  status: "completed" | "in_progress" | "failed" | "pending";
  detail: string;
  txHash?: string;
};

type PipelineState = {
  steps: PipelineStep[];
  summary: {
    score: number;
    level: string;
    action: string;
    durationMs: number;
    txHash: string;
  };
};

type VaultGateCheck = {
  address: string;
  allowed: boolean;
  reason: string;
  score: number;
  lastUpdated: number;
  dataAge: string;
  stalenessLimit: number;
};
```

---

## Component Structure

```
app/dashboard/page.tsx
  └── <OracleDashboard />                   (new top-level component)
        ├── <WorkflowStatusBar />            Section 1
        ├── <KPICards />                     Section 2
        ├── <CREPipeline />                  Section 3
        ├── <div className="grid lg:grid-cols-[0.6fr_0.4fr]">
        │     ├── <OracleEventFeed />        Section 4
        │     └── <ComplianceVaultGate />    Section 5
        ├── <div className="grid md:grid-cols-2">
        │     ├── <RiskScoreTrend />         Section 6a
        │     └── <RiskDistribution />       Section 6b
```

### File mapping

| Component | File |
|-----------|------|
| `OracleDashboard` | `components/dashboard/oracle-dashboard.tsx` (new, replaces current page composition) |
| `WorkflowStatusBar` | `components/dashboard/workflow-status-bar.tsx` (new) |
| `KPICards` | Refactored from existing summary cards in `overview.tsx` |
| `CREPipeline` | `components/dashboard/cre-pipeline.tsx` (new) |
| `OracleEventFeed` | Replaces `components/dashboard/oracle-monitor.tsx` |
| `ComplianceVaultGate` | `components/dashboard/compliance-vault-gate.tsx` (new) |
| `RiskScoreTrend` | Extracted from existing `LineChart` in `overview.tsx` |
| `RiskDistribution` | Extracted from existing `RiskDistributionChart` in `overview.tsx` |

---

## Implementation Priority

| Phase | Items | Effort |
|-------|-------|--------|
| **P0 — Demo-ready** | Workflow Status Bar, KPI Cards (relabeled), CRE Pipeline, Event Feed with txHash | 1–2 days |
| **P1 — Polished** | ComplianceVault Gate (on-chain reads), Chart improvements (threshold line, real timestamps) | 1 day |
| **P2 — Production** | `/api/oracle/status` and `/api/oracle/latest-pipeline` backed by DB, remove Reports tab, auto-refresh WebSocket upgrade | 1–2 days |

---

## Removed from current Dashboard

The following elements from the existing `overview.tsx` are **not relevant** to the Oracle Dashboard and should be removed or moved to a separate page:

| Element | Reason |
|---------|--------|
| Deployment list (left sidebar) | Belongs to Contracts page, not Oracle monitoring |
| Reports tab (Monthly / SAR) | Compliance document generation, not oracle data |
| Report to Authority dialog | Separate regulatory workflow |
| Search deployments | Not relevant to oracle event monitoring |

---

## Mock Data Strategy

Until the CRE workflow is running on a live DON, the dashboard should work with **demo seed data** that can be loaded via a single API call or button:

```typescript
const DEMO_EVENTS: OracleAttestation[] = [
  {
    id: "demo-1",
    walletAddress: "0x7f3a8c2E9b4D1F6e5A3c7B0d2E8f4A6C9b1D3e",
    chain: "Sepolia",
    provider: "GoPlus",
    score: 807,
    level: "HIGH",
    isBlacklisted: false,
    reason: "High-risk address detected by GoPlus Security API",
    status: "succeeded",
    createdAt: new Date(Date.now() - 2 * 60000).toISOString(),
    txHash: "0xabc123def456789012345678901234567890abcdef1234567890abcdef123456",
    action: "FREEZE",
  },
  {
    id: "demo-2",
    walletAddress: "0x2b1c5D8e3F7a0C4b6E9d1A5f8B2c4D7e0F3a6B",
    chain: "Sepolia",
    provider: "GoPlus",
    score: 312,
    level: "LOW",
    isBlacklisted: false,
    reason: "Address passed all security checks",
    status: "succeeded",
    createdAt: new Date(Date.now() - 8 * 60000).toISOString(),
    txHash: "0xdef456789012345678901234567890abcdef1234567890abcdef123456789012",
    action: "PASS",
  },
  {
    id: "demo-3",
    walletAddress: "0x9e4d2A7b5C1f8E3d6B0a4F7c2D5e8A1b3C6f9D",
    chain: "Sepolia",
    provider: "GoPlus + Fallback",
    score: 650,
    level: "MEDIUM",
    isBlacklisted: false,
    reason: "Medium risk — flagged by one source, cleared by another",
    status: "succeeded",
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
    txHash: "0x123456789012345678901234567890abcdef1234567890abcdef1234567890ab",
    action: "REVIEW",
  },
];
```

---

## Contract Addresses (Sepolia v2)

| Contract | Address |
|----------|---------|
| ChainlinkRisk | `0xYOUR_CHAINLINKRISK_ADDRESS` |
| uRWA | `0xYOUR_URWA_ADDRESS` |
| LexOracleConsumer | `0xYOUR_CONSUMER_ADDRESS` |
| ComplianceVault | `0xYOUR_VAULT_ADDRESS` |

> Replace with actual deployed addresses from `.env.local` before demo.