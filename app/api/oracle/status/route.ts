import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    active: true,
    network: "sepolia",
    contracts: {
      chainlinkRisk: process.env.ORACLE_CHAINLINK_RISK_ADDRESS ?? "",
      urwa: process.env.ORACLE_URWA_ADDRESS ?? "",
      consumer: process.env.ORACLE_CONSUMER_ADDRESS ?? "",
      complianceVault: process.env.ORACLE_COMPLIANCE_VAULT_ADDRESS ?? "",
    },
  });
}
