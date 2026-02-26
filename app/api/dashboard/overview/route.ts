import { NextResponse } from "next/server";
import { listDeployments } from "@/lib/db";
import { listOracleAttestations } from "@/lib/oracle-attestations";

export async function GET() {
  const [deployments, attestations] = await Promise.all([
    listDeployments(),
    listOracleAttestations(50),
  ]);

  const highRiskCount = attestations.filter((item) => item.level === "HIGH" || item.level === "BLOCKED").length;
  const deployedCount = deployments.filter((item) => item.status === "deployed").length;

  return NextResponse.json({
    summary: {
      totalDeployments: deployments.length,
      deployedCount,
      oracleChecks: attestations.length,
      highRiskCount,
    },
    deployments,
    attestations,
  });
}
