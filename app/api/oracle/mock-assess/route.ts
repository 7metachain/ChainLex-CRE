import { NextResponse } from "next/server";
import { recordOracleAttestation } from "@/lib/oracle-attestations";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const CHATBOT_API_BASE = process.env.CHATBOT_API_BASE ?? process.env.NEXT_PUBLIC_CHATBOT_API_BASE ?? "http://localhost:8000";

type RiskResponse = {
  wallet_address: string;
  chain: string;
  provider: string;
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  is_blacklisted: boolean;
  reason: string;
  assessed_at: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as {
    walletAddress?: string;
    chain?: string;
    provider?: string;
  };

  const walletAddress = body.walletAddress?.trim();
  if (!walletAddress || !ADDRESS_REGEX.test(walletAddress)) {
    return NextResponse.json({ error: "Valid walletAddress is required" }, { status: 400 });
  }

  const chain = body.chain?.trim() || "sepolia";
  const provider = body.provider?.trim() || "mock-chainalysis";

  const response = await fetch(`${CHATBOT_API_BASE}/risk-assessment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet_address: walletAddress,
      chain,
      provider,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: "Mock risk provider request failed", details: errorText },
      { status: 502 }
    );
  }

  const risk = (await response.json()) as RiskResponse;
  const record = await recordOracleAttestation({
    walletAddress: risk.wallet_address,
    chain: risk.chain,
    provider: risk.provider,
    score: risk.score,
    level: risk.level,
    isBlacklisted: risk.is_blacklisted,
    reason: risk.reason,
    status: "succeeded",
  });

  return NextResponse.json({ risk, record });
}
