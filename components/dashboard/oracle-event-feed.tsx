"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OracleAttestation } from "@/lib/oracle-attestations";

const ETHERSCAN_TX = "https://sepolia.etherscan.io/tx/";

function levelColor(level: string) {
  switch (level) {
    case "LOW": return "border-l-green-500";
    case "MEDIUM": return "border-l-yellow-500";
    case "HIGH": return "border-l-red-500";
    case "BLOCKED": return "border-l-purple-500";
    default: return "border-l-zinc-400";
  }
}

function levelBadge(level: string): "secondary" | "destructive" | "outline" | "default" {
  switch (level) {
    case "LOW": return "secondary";
    case "MEDIUM": return "outline";
    case "HIGH":
    case "BLOCKED": return "destructive";
    default: return "default";
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type OracleEventFeedProps = {
  events: OracleAttestation[];
};

export function OracleEventFeed({ events }: OracleEventFeedProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Oracle Event Feed</CardTitle>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            Live
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          CRE workflow 自动执行的风险评估记录，按时间倒序
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
          <span>LOW (&lt;400)</span>
          <span>MEDIUM (400–599)</span>
          <span>HIGH (≥600)</span>
          <span>FREEZE (≥600 或 BLACKLIST)</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No oracle events yet. Run a CRE workflow to see events here.
            </p>
          )}
          {events.map((evt) => (
            <div
              key={evt.id}
              className={`rounded-lg border border-l-[3px] p-3 space-y-1.5 ${levelColor(evt.level)}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm">
                  {evt.walletAddress.slice(0, 6)}…{evt.walletAddress.slice(-4)}
                </span>
                <Badge variant={levelBadge(evt.level)}>{evt.level}</Badge>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <span>Score: <strong>{evt.score}</strong></span>
                <span>
                  Action:{" "}
                  <strong
                    className={
                      evt.action === "FREEZE"
                        ? "text-red-500"
                        : evt.action === "REVIEW"
                        ? "text-yellow-600"
                        : "text-green-500"
                    }
                  >
                    {evt.action}
                  </strong>
                </span>
              </div>

              {evt.txHash && (
                <a
                  href={`${ETHERSCAN_TX}${evt.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block font-mono text-xs text-blue-500 hover:underline"
                >
                  TX: {evt.txHash.slice(0, 10)}…{evt.txHash.slice(-6)} ✓
                </a>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span title="数据源：GoPlus 为链上风控 API，用于地址风险评分">{evt.provider}</span>
                <span>{timeAgo(evt.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
