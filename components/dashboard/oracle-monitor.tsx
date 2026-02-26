"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
};

const DEFAULT_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";

export function OracleMonitor() {
  const [walletAddress, setWalletAddress] = useState(DEFAULT_WALLET);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<OracleAttestation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      const response = await fetch("/api/oracle/attestations?limit=20");
      if (!response.ok) {
        throw new Error(`Failed to load oracle records (${response.status})`);
      }

      const payload = (await response.json()) as { items: OracleAttestation[] };
      setItems(payload.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load oracle records");
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const onAssess = useCallback(async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/oracle/mock-assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Risk assessment failed");
      }

      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Risk assessment failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [loadItems, walletAddress]);

  const latest = useMemo(() => items[0], [items]);

  return (
    <Card className="border-muted-foreground/10">
      <CardHeader>
        <CardTitle>Oracle Mock Loop</CardTitle>
        <CardDescription>
          Trigger mock risk assessment, persist the result, and render the latest attestations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row">
          <Input
            value={walletAddress}
            onChange={(event) => setWalletAddress(event.target.value)}
            placeholder="0x..."
            className="font-mono text-xs"
          />
          <Button onClick={onAssess} disabled={isSubmitting}>
            {isSubmitting ? "Assessing..." : "Assess Risk"}
          </Button>
          <Button variant="outline" onClick={loadItems}>
            Refresh
          </Button>
        </div>

        {latest ? (
          <div className="rounded-xl border border-border/60 p-3 text-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-medium">Latest:</span>
              <Badge variant={latest.level === "LOW" ? "secondary" : "destructive"}>{latest.level}</Badge>
              <span>score {latest.score}</span>
            </div>
            <p className="font-mono text-xs">{latest.walletAddress}</p>
            <p className="mt-1 text-muted-foreground">{latest.reason}</p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border/40 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono">{item.walletAddress}</p>
                <Badge variant={item.level === "LOW" ? "secondary" : "destructive"}>
                  {item.level} / {item.score}
                </Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{item.reason}</p>
              <p className="mt-1 text-muted-foreground">
                {item.provider} · {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
          {!items.length ? <p className="text-sm text-muted-foreground">No oracle records yet.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
