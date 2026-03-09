"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, XCircle, Circle } from "lucide-react";
import type { OracleAttestation } from "@/lib/oracle-attestations";

const ETHERSCAN_TX = "https://sepolia.etherscan.io/tx/";

type StepStatus = "completed" | "in_progress" | "failed" | "pending";

type PipelineStep = {
  label: string;
  detail: string;
  status: StepStatus;
};

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "in_progress":
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Circle className="h-5 w-5 text-zinc-400" />;
  }
}

function buildSteps(latest: OracleAttestation | null): PipelineStep[] {
  if (!latest) {
    return [
      { label: "Transfer Detected", detail: "Waiting...", status: "pending" },
      { label: "CRE Triggered", detail: "--", status: "pending" },
      { label: "GoPlus API", detail: "--", status: "pending" },
      { label: "DON Consensus", detail: "--", status: "pending" },
      { label: "ChainlinkRisk", detail: "--", status: "pending" },
      { label: "Event Emitted", detail: "--", status: "pending" },
      { label: "Dashboard", detail: "--", status: "pending" },
    ];
  }

  const addr = `${latest.walletAddress.slice(0, 6)}...${latest.walletAddress.slice(-4)}`;
  const hasTx = !!latest.txHash;
  const succeeded = latest.status === "succeeded";

  return [
    { label: "Transfer Detected", detail: addr, status: "completed" },
    { label: "CRE Triggered", detail: "Log Trigger", status: "completed" },
    { label: "GoPlus API", detail: `Score: ${latest.score}`, status: "completed" },
    { label: "DON Consensus", detail: "identical", status: "completed" },
    { label: "ChainlinkRisk", detail: hasTx ? `TX: ${latest.txHash.slice(0, 8)}...` : "--", status: succeeded ? "completed" : "failed" },
    { label: "Event Emitted", detail: "RiskAssessmentUpdated", status: succeeded ? "completed" : "pending" },
    { label: "Dashboard", detail: "Updated", status: "completed" },
  ];
}

type CREPipelineProps = {
  latest: OracleAttestation | null;
};

export function CREPipeline({ latest }: CREPipelineProps) {
  const steps = buildSteps(latest);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">CRE Workflow Pipeline (Latest Execution)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-0 overflow-x-auto pb-2">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-start">
              <div className="flex flex-col items-center min-w-[90px]">
                <StatusIcon status={step.status} />
                <span className="mt-1.5 text-xs font-medium text-center leading-tight">{step.label}</span>
                <span className="mt-0.5 text-[10px] text-muted-foreground text-center leading-tight">{step.detail}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="flex items-center pt-2.5 px-0.5">
                  <div className={`h-0.5 w-6 ${step.status === "completed" ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                </div>
              )}
            </div>
          ))}
        </div>

        {latest && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/50 px-4 py-2 text-sm">
            <span>Score: <strong>{latest.score}</strong></span>
            <Badge variant={latest.level === "LOW" ? "secondary" : latest.level === "MEDIUM" ? "outline" : "destructive"}>
              {latest.level}
            </Badge>
            <span>
              Action:{" "}
              <strong className={
                latest.action === "FREEZE" ? "text-red-500" :
                latest.action === "REVIEW" ? "text-yellow-600" : "text-green-500"
              }>
                {latest.action}
              </strong>
            </span>
            {latest.txHash && (
              <a
                href={`${ETHERSCAN_TX}${latest.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-blue-500 hover:underline"
              >
                TX: {latest.txHash.slice(0, 10)}...{latest.txHash.slice(-6)}
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
