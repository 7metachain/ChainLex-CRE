"use client";

import { Badge } from "@/components/ui/badge";

const ETHERSCAN_BASE = "https://sepolia.etherscan.io/address/";

type Contract = { label: string; address: string };

type WorkflowStatusBarProps = {
  lastRunAt: string | null;
  contracts: Contract[];
};

function truncateAddress(addr: string) {
  if (addr.length <= 13) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getStatusColor(lastRunAt: string | null) {
  if (!lastRunAt) return { dot: "bg-zinc-400", ping: "", label: "Inactive" };
  const age = Date.now() - new Date(lastRunAt).getTime();
  if (age < 10 * 60_000) return { dot: "bg-green-500", ping: "animate-ping bg-green-400", label: "Active" };
  if (age < 60 * 60_000) return { dot: "bg-yellow-500", ping: "", label: "Stale" };
  return { dot: "bg-red-500", ping: "", label: "Offline" };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function WorkflowStatusBar({ lastRunAt, contracts }: WorkflowStatusBarProps) {
  const status = getStatusColor(lastRunAt);

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            {status.ping && (
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${status.ping}`} />
            )}
            <span className={`relative inline-flex h-3 w-3 rounded-full ${status.dot}`} />
          </span>
          <span className="text-sm font-semibold">CRE Workflow: {status.label}</span>
        </div>
        {lastRunAt && (
          <span className="text-sm text-muted-foreground">Last: {timeAgo(lastRunAt)}</span>
        )}
        <Badge variant="outline" className="hidden sm:inline-flex">Sepolia Testnet</Badge>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono text-muted-foreground">
        {contracts.map((c) => (
          <a
            key={c.label}
            href={`${ETHERSCAN_BASE}${c.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            {c.label}: {truncateAddress(c.address)}
          </a>
        ))}
      </div>
    </div>
  );
}
