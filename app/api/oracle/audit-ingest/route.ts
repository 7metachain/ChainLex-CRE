import { NextResponse } from "next/server";
import { recordOracleAttestation } from "@/lib/oracle-attestations";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

type AuditPayload = {
  walletAddress: string;
  chain?: string;
  provider?: string;
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  isBlacklisted?: boolean;
  reason?: string;
  action?: string;
  txHash?: string;
};

export async function POST(request: Request) {
  let body: AuditPayload;
  try {
    body = (await request.json()) as AuditPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const walletAddress = body.walletAddress?.trim();
  if (!walletAddress || !ADDRESS_REGEX.test(walletAddress)) {
    return NextResponse.json(
      { error: "Valid walletAddress (0x-prefixed, 40 hex chars) is required" },
      { status: 400 },
    );
  }

  if (typeof body.score !== "number" || body.score < 0 || body.score > 1000) {
    return NextResponse.json(
      { error: "score must be a number between 0 and 1000" },
      { status: 400 },
    );
  }

  const validLevels = ["LOW", "MEDIUM", "HIGH", "BLOCKED"];
  if (!validLevels.includes(body.level)) {
    return NextResponse.json(
      { error: `level must be one of: ${validLevels.join(", ")}` },
      { status: 400 },
    );
  }

  const record = await recordOracleAttestation({
    walletAddress,
    chain: body.chain?.trim() || "sepolia",
    provider: body.provider?.trim() || "cre-audit",
    score: body.score,
    level: body.level,
    isBlacklisted: body.isBlacklisted ?? false,
    reason: body.reason?.trim() || "",
    status: "succeeded",
  });

  console.log(
    `[audit-ingest] addr=${walletAddress} score=${body.score} level=${body.level} action=${body.action ?? "none"} tx=${body.txHash ?? "none"}`,
  );

  return NextResponse.json({
    ok: true,
    record,
    receivedAt: new Date().toISOString(),
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/oracle/audit-ingest",
    description: "Receives CRE workflow audit callbacks and persists attestation records",
    status: "active",
  });
}
