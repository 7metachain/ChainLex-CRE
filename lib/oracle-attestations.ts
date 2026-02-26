import { neon, neonConfig } from "@neondatabase/serverless";
import { randomUUID } from "crypto";

neonConfig.fetchConnectionCache = true;

export type OracleAttestation = {
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

type InsertOracleAttestation = Omit<OracleAttestation, "id" | "createdAt">;

function getSql() {
  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  return neon(connectionString);
}

function getMemoryStore(): OracleAttestation[] {
  const globalKey = "__chainlex_oracle_attestations__";
  const globalRef = globalThis as unknown as Record<string, OracleAttestation[] | undefined>;
  if (!globalRef[globalKey]) {
    globalRef[globalKey] = [];
  }

  return globalRef[globalKey]!;
}

async function ensureTable() {
  const sql = getSql();
  if (!sql) return;

  await sql`
    CREATE TABLE IF NOT EXISTS oracle_attestations (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      chain TEXT NOT NULL,
      provider TEXT NOT NULL,
      score INTEGER NOT NULL,
      level TEXT NOT NULL,
      is_blacklisted BOOLEAN NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function recordOracleAttestation(entry: InsertOracleAttestation): Promise<OracleAttestation> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const record: OracleAttestation = { id, createdAt, ...entry };

  const sql = getSql();
  if (!sql) {
    const memory = getMemoryStore();
    memory.unshift(record);
    return record;
  }

  await ensureTable();
  await sql`
    INSERT INTO oracle_attestations (
      id, wallet_address, chain, provider, score, level, is_blacklisted, reason, status
    )
    VALUES (
      ${id}, ${entry.walletAddress}, ${entry.chain}, ${entry.provider}, ${entry.score},
      ${entry.level}, ${entry.isBlacklisted}, ${entry.reason}, ${entry.status}
    )
  `;

  return record;
}

export async function listOracleAttestations(limit = 20): Promise<OracleAttestation[]> {
  const sql = getSql();
  if (!sql) {
    return getMemoryStore().slice(0, limit);
  }

  await ensureTable();
  const rows = await sql`
    SELECT
      id,
      wallet_address as "walletAddress",
      chain,
      provider,
      score,
      level,
      is_blacklisted as "isBlacklisted",
      reason,
      status,
      created_at as "createdAt"
    FROM oracle_attestations
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows as OracleAttestation[];
}
