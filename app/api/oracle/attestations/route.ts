import { NextResponse } from "next/server";
import { listOracleAttestations } from "@/lib/oracle-attestations";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;

  const items = await listOracleAttestations(limit);
  return NextResponse.json({ items });
}
