import { createPublicClient, createWalletClient, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export type OracleRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";

export type OracleWritebackInput = {
  walletAddress: `0x${string}`;
  score: number;
  level: OracleRiskLevel;
  reason: string;
  isBlacklisted: boolean;
};

const chainlinkRiskAbi = parseAbi([
  "function updateRiskAssessment(address user, uint8 level, uint256 score, string reason, bool isBlacklisted)",
]);

function getWritebackConfig() {
  const rpcUrl = process.env.ORACLE_WRITEBACK_RPC_URL;
  const privateKey = process.env.ORACLE_WRITEBACK_PRIVATE_KEY as Hex | undefined;
  const chainlinkRiskAddress = process.env.ORACLE_CHAINLINK_RISK_ADDRESS as `0x${string}` | undefined;
  const chainId = Number(process.env.ORACLE_WRITEBACK_CHAIN_ID ?? "11155111");

  if (!rpcUrl || !privateKey || !chainlinkRiskAddress || !Number.isFinite(chainId) || chainId <= 0) {
    return null;
  }

  return {
    rpcUrl,
    privateKey,
    chainlinkRiskAddress,
    chainId,
  };
}

export function isOracleWritebackEnabled() {
  return getWritebackConfig() !== null;
}

function mapRiskLevel(level: OracleRiskLevel): number {
  switch (level) {
    case "LOW":
      return 1;
    case "MEDIUM":
      return 2;
    case "HIGH":
      return 3;
    case "BLOCKED":
      return 4;
    default:
      return 0;
  }
}

export async function writeRiskAssessmentOnchain(input: OracleWritebackInput) {
  const config = getWritebackConfig();
  if (!config) {
    return { enabled: false as const };
  }

  const account = privateKeyToAccount(config.privateKey);
  const chain = {
    id: config.chainId,
    name: `chain-${config.chainId}`,
    nativeCurrency: { name: "Native", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [config.rpcUrl] },
      public: { http: [config.rpcUrl] },
    },
  };

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl),
  });
  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  const txHash = await walletClient.writeContract({
    address: config.chainlinkRiskAddress,
    abi: chainlinkRiskAbi,
    functionName: "updateRiskAssessment",
    args: [
      input.walletAddress,
      mapRiskLevel(input.level),
      BigInt(Math.max(0, Math.floor(input.score))),
      input.reason,
      input.isBlacklisted,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  return {
    enabled: true as const,
    txHash,
    blockNumber: receipt.blockNumber.toString(),
    status: receipt.status,
  };
}
