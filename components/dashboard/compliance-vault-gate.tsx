"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Link2 } from "lucide-react";

const ETHERSCAN_ADDR = "https://sepolia.etherscan.io/address/";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type VaultConfig = {
  address: string;
  tokenLabel: string;
  complianceFeedLabel: string;
  complianceFeedAddress: string;
};

type GateCheck = {
  address: string;
  allowed: boolean;
  reason: string;
  score: number;
  dataAge: string;
  stalenessLimit: string;
};

type EventRef = { walletAddress: string; createdAt: string };

type ComplianceVaultGateProps = {
  vault: VaultConfig;
  checks: GateCheck[];
  events?: EventRef[];
};

export function ComplianceVaultGate({ vault, checks: initialChecks, events = [] }: ComplianceVaultGateProps) {
  const [addressInput, setAddressInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState<GateCheck[]>(initialChecks);

  const handleCheck = useCallback(async () => {
    const addr = addressInput.trim();
    if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return;

    setChecking(true);
    try {
      const res = await fetch(`/api/oracle/vault-check?address=${addr}`);
      if (res.ok) {
        const data = await res.json();
        setChecks((prev) => [data, ...prev].slice(0, 10));
      }
    } catch {
      // silently fail
    } finally {
      setChecking(false);
    }
  }, [addressInput]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">ComplianceVault Gate</CardTitle>
          <a
            href={`${ETHERSCAN_ADDR}${vault.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline"
          >
            Sepolia
          </a>
        </div>
        <CardDescription className="text-xs space-y-0.5 mt-1">
          <span className="block text-muted-foreground">
            第三方金库根据 ChainlinkRisk 链上数据判断地址是否可准入
          </span>
          <span className="block mt-1">Token: {vault.tokenLabel}</span>
          <span className="block">
            Compliance Feed: {vault.complianceFeedLabel} ({vault.complianceFeedAddress.slice(0, 6)}...{vault.complianceFeedAddress.slice(-4)})
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="0x... address to check"
            className="font-mono text-xs"
          />
          <Button size="sm" onClick={handleCheck} disabled={checking}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
          </Button>
        </div>

        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {checks.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No gate checks yet. Enter an address to verify compliance.
            </p>
          )}
          {checks.map((check, i) => {
            const matchedEvent = events.find(
              (e) => e.walletAddress.toLowerCase() === check.address.toLowerCase()
            );
            return (
            <div
              key={`${check.address}-${i}`}
              className={`rounded-lg border p-3 space-y-1 ${check.allowed ? "border-green-500/30" : "border-red-500/30"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs">
                  {check.address.slice(0, 6)}...{check.address.slice(-4)}
                </span>
                {check.allowed ? (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> APPROVED
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" /> REJECTED
                  </Badge>
                )}
              </div>
              {matchedEvent && (
                <p className="text-[10px] text-blue-600 flex items-center gap-1" title="该地址在左侧 Oracle Event Feed 中有对应评估记录">
                  <Link2 className="h-3 w-3 flex-shrink-0" />
                  在 Event Feed 有记录 ({timeAgo(matchedEvent.createdAt)})
                </p>
              )}
              <p className="text-xs text-muted-foreground">{check.reason}</p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>Score: {check.score}</span>
                <span
                  title="链上该地址风险数据距离上次 CRE 更新的时间；超过 Limit 则视为过期，Vault 会拒绝准入"
                >
                  Data age: {check.dataAge}
                </span>
                <span
                  title="风险数据的最大有效时长，超过后需等待 CRE 再次更新"
                >
                  Limit: {check.stalenessLimit}
                </span>
              </div>
            </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
