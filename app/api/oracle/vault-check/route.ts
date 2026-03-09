import { NextResponse } from "next/server";
import { listOracleAttestations } from "@/lib/oracle-attestations";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim() ?? "";

  if (!ADDRESS_REGEX.test(address)) {
    return NextResponse.json({ error: "Valid 0x address required" }, { status: 400 });
  }

  const attestations = await listOracleAttestations(100);
  const match = attestations.find(
    (a) => a.walletAddress.toLowerCase() === address.toLowerCase()
  );

  if (!match) {
    return NextResponse.json({
      address,
      allowed: true,
      reason: "No risk data available, allowing by default",
      score: 0,
      dataAge: "N/A",
      stalenessLimit: "1hr",
    });
  }

  const ageMs = Date.now() - new Date(match.createdAt).getTime();
  const ageMins = Math.floor(ageMs / 60_000);
  const dataAge = ageMins < 60 ? `${ageMins}min` : `${Math.floor(ageMins / 60)}hr`;

  const allowed = match.level === "LOW" || match.level === "MEDIUM";

  return NextResponse.json({
    address,
    allowed,
    reason: allowed ? "User is allowed" : `Risk level too high (score: ${match.score})`,
    score: match.score,
    dataAge,
    stalenessLimit: "1hr",
  });
}
