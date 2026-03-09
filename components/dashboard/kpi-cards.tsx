"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Activity, CheckCircle2, AlertTriangle, Shield, Ban } from "lucide-react";
import type { ReactNode } from "react";

type KPI = { value: number; label: string; icon: ReactNode; color: string };

type KPICardsProps = {
  oracleChecks: number;
  onChainWrites: number;
  highRisk: number;
  freezeActions: number;
  vaultRejected: number;
};

export function KPICards({ oracleChecks, onChainWrites, highRisk, freezeActions, vaultRejected }: KPICardsProps) {
  const cards: KPI[] = [
    { value: oracleChecks, label: "Oracle Checks", icon: <Activity className="h-5 w-5 text-primary" />, color: "bg-primary/10" },
    { value: onChainWrites, label: "On-chain Writes", icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, color: "bg-green-500/10" },
    { value: highRisk, label: "High Risk", icon: <AlertTriangle className="h-5 w-5 text-orange-500" />, color: "bg-orange-500/10" },
    { value: freezeActions, label: "FREEZE Actions", icon: <Shield className="h-5 w-5 text-red-500" />, color: "bg-red-500/10" },
    { value: vaultRejected, label: "Vault Rejected", icon: <Ban className="h-5 w-5 text-purple-500" />, color: "bg-purple-500/10" },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${c.color}`}>{c.icon}</div>
              <div>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-sm text-muted-foreground">{c.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
