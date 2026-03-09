"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import type { OracleAttestation } from "@/lib/oracle-attestations";
import { WorkflowStatusBar } from "./workflow-status-bar";
import { KPICards } from "./kpi-cards";
import { CREPipeline } from "./cre-pipeline";
import { OracleEventFeed } from "./oracle-event-feed";
import { ComplianceVaultGate } from "./compliance-vault-gate";
import { RiskScoreTrend, RiskDistribution } from "./risk-charts";

const CONTRACTS = [
  { label: "ChainlinkRisk", envKey: "chainlinkRisk" },
  { label: "uRWA", envKey: "urwa" },
  { label: "Consumer", envKey: "consumer" },
] as const;

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
    createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
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
    createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
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
    reason: "Medium risk - flagged by one source, cleared by another",
    status: "succeeded",
    createdAt: new Date(Date.now() - 15 * 60_000).toISOString(),
    txHash: "0x123456789012345678901234567890abcdef1234567890abcdef1234567890ab",
    action: "REVIEW",
  },
  {
    id: "demo-4",
    walletAddress: "0xAdB60036FE9d4c269Ed5ca8C5958dd29bc66D814",
    chain: "Sepolia",
    provider: "GoPlus",
    score: 180,
    level: "LOW",
    isBlacklisted: false,
    reason: "Clean address - no risk signals detected",
    status: "succeeded",
    createdAt: new Date(Date.now() - 32 * 60_000).toISOString(),
    txHash: "0x456789012345678901234567890abcdef1234567890abcdef1234567890123456",
    action: "PASS",
  },
  {
    id: "demo-5",
    walletAddress: "0xDead000000000000000000000000000000000000",
    chain: "Sepolia",
    provider: "GoPlus",
    score: 950,
    level: "BLOCKED",
    isBlacklisted: true,
    reason: "Known malicious address - blacklisted by multiple providers",
    status: "succeeded",
    createdAt: new Date(Date.now() - 45 * 60_000).toISOString(),
    txHash: "0x789012345678901234567890abcdef1234567890abcdef12345678901234567890",
    action: "FREEZE",
  },
];

const DEMO_VAULT_CHECKS = [
  {
    address: "0x7f3a8c2E9b4D1F6e5A3c7B0d2E8f4A6C9b1D3e",
    allowed: false,
    reason: "Risk level too high (score: 807)",
    score: 807,
    dataAge: "4min",
    stalenessLimit: "1hr",
  },
  {
    address: "0x2b1c5D8e3F7a0C4b6E9d1A5f8B2c4D7e0F3a6B",
    allowed: true,
    reason: "User is allowed",
    score: 312,
    dataAge: "2min",
    stalenessLimit: "1hr",
  },
];

type OracleStatusResponse = {
  contracts: {
    chainlinkRisk: string;
    urwa: string;
    consumer: string;
    complianceVault: string;
  };
};

export function OracleDashboard() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<OracleAttestation[]>([]);
  const [contractAddresses, setContractAddresses] = useState({
    chainlinkRisk: "",
    urwa: "",
    consumer: "",
    complianceVault: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, attestationsRes] = await Promise.all([
        fetch("/api/oracle/status").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/oracle/attestations?limit=50").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      if (statusRes?.contracts) {
        setContractAddresses(statusRes.contracts);
      }

      const items: OracleAttestation[] = attestationsRes?.items ?? [];
      const normalized = items.map((item) => ({
        ...item,
        txHash: item.txHash ?? "",
        action: item.action ?? deriveAction(item.score, item.level),
      }));

      setEvents(normalized.length > 0 ? normalized : DEMO_EVENTS);
    } catch {
      setEvents(DEMO_EVENTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const latest = events[0] ?? null;
  const succeededCount = events.filter((e) => e.status === "succeeded").length;
  const highRiskCount = events.filter((e) => e.level === "HIGH" || e.level === "BLOCKED").length;
  const freezeCount = events.filter((e) => e.action === "FREEZE").length;
  const vaultRejectedCount = DEMO_VAULT_CHECKS.filter((c) => !c.allowed).length;

  const contracts = CONTRACTS.map((c) => ({
    label: c.label,
    address: contractAddresses[c.envKey] || "0x0000000000000000000000000000000000000000",
  }));

  return (
    <section className="space-y-6">
      {/* Section 1: Workflow Status Bar */}
      <WorkflowStatusBar
        lastRunAt={latest?.createdAt ?? null}
        contracts={contracts}
      />

      {/* Section 2: KPI Cards */}
      <KPICards
        oracleChecks={events.length}
        onChainWrites={succeededCount}
        highRisk={highRiskCount}
        freezeActions={freezeCount}
        vaultRejected={vaultRejectedCount}
      />

      {/* Section 3: CRE Pipeline */}
      <CREPipeline latest={latest} />

      {/* Data flow diagram */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs">
        <p className="text-muted-foreground mb-2">数据流：</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">Oracle Event Feed</span>
          <span className="text-muted-foreground">(CRE 写入)</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-medium">ChainlinkRisk 链上</span>
          <span className="text-muted-foreground">←</span>
          <span className="text-muted-foreground">(ComplianceVault 读取)</span>
          <span className="font-medium">ComplianceVault Gate</span>
        </div>
      </div>

      {/* Section 4 + 5: Event Feed + Vault Gate */}
      <div className="grid gap-6 lg:grid-cols-[0.6fr_0.4fr]">
        <OracleEventFeed events={events} />
        <ComplianceVaultGate
          vault={{
            address: contractAddresses.complianceVault || "0x0000000000000000000000000000000000000000",
            tokenLabel: "uRWA (ccTMMF)",
            complianceFeedLabel: "ChainlinkRisk",
            complianceFeedAddress: contractAddresses.chainlinkRisk || "0x0000000000000000000000000000000000000000",
          }}
          checks={DEMO_VAULT_CHECKS}
          events={events.map((e) => ({ walletAddress: e.walletAddress, createdAt: e.createdAt }))}
        />
      </div>

      {/* Section 6: Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <RiskScoreTrend attestations={events} />
        <RiskDistribution attestations={events} />
      </div>
    </section>
  );
}

function deriveAction(score: number, level: string): "PASS" | "REVIEW" | "FREEZE" {
  if (level === "BLOCKED" || score >= 800) return "FREEZE";
  if (level === "HIGH" || score >= 600) return "FREEZE";
  if (level === "MEDIUM" || score >= 400) return "REVIEW";
  return "PASS";
}
