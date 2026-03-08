import { spawn } from "child_process";
import { NextRequest } from "next/server";
import { recordDeployment } from "@/lib/db";

interface DeployRequest {
  tokenName: string;
  symbol: string;
  ownerAddress: string;
  riskAssessmentAddress: string;
  rpcUrl?: string;
  privateKey?: string;
  etherscanApiKey?: string;
  chain: string;
}

type DeployResponse = {
  success: boolean;
  transactionHash?: string;
  contractAddress?: string;
  output?: string;
  error?: string;
};

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_REGEX = /transaction hash:?\s*(0x[a-fA-F0-9]{64})/i;
const CONTRACT_ADDRESS_REGEX = /deployed to:?\s*(0x[a-fA-F0-9]{40})/i;

function requiredSetting(
  value: string | undefined,
  key: string
): string | Response {
  if (value && value.trim()) {
    return value.trim();
  }

  return Response.json(
    {
      success: false,
      error: `Missing required configuration: ${key}`,
    } as DeployResponse,
    { status: 500 }
  );
}

function resolveDeployConfig(body: DeployRequest) {
  const rpcUrl = body.rpcUrl?.trim() || process.env.FOUNDRY_RPC_URL;
  const privateKey = body.privateKey?.trim() || process.env.FOUNDRY_PRIVATE_KEY;
  const etherscanApiKey = body.etherscanApiKey?.trim() || process.env.FOUNDRY_ETHERSCAN_API_KEY;
  const cwd = process.env.FOUNDRY_PROJECT_ROOT || process.cwd();
  const target = process.env.FOUNDRY_CONTRACT_TARGET || "contracts/uRWA.sol:uRWA";
  const verify = process.env.FOUNDRY_VERIFY === "true";

  return { rpcUrl, privateKey, etherscanApiKey, cwd, target, verify };
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as DeployRequest;

  if (!body.tokenName || !body.symbol || !body.ownerAddress || !body.riskAssessmentAddress || !body.chain) {
    return Response.json(
      { success: false, error: "Missing required parameters" } as DeployResponse,
      { status: 400 }
    );
  }

  if (!ADDRESS_REGEX.test(body.ownerAddress) || !ADDRESS_REGEX.test(body.riskAssessmentAddress)) {
    return Response.json(
      { success: false, error: "Invalid address format" } as DeployResponse,
      { status: 400 }
    );
  }

  const cfg = resolveDeployConfig(body);

  const rpcUrl = requiredSetting(cfg.rpcUrl, "FOUNDRY_RPC_URL or request.rpcUrl");
  if (rpcUrl instanceof Response) return rpcUrl;

  const privateKey = requiredSetting(cfg.privateKey, "FOUNDRY_PRIVATE_KEY or request.privateKey");
  if (privateKey instanceof Response) return privateKey;

  const deployArgs = [
    "create",
    cfg.target,
    "--rpc-url",
    rpcUrl,
    "--private-key",
    privateKey,
    "--broadcast",
    "--constructor-args",
    body.tokenName,
    body.symbol,
    body.ownerAddress,
    body.riskAssessmentAddress,
  ];

  if (cfg.verify) {
    const etherscanApiKey = requiredSetting(
      cfg.etherscanApiKey,
      "FOUNDRY_ETHERSCAN_API_KEY or request.etherscanApiKey"
    );
    if (etherscanApiKey instanceof Response) return etherscanApiKey;

    deployArgs.push("--etherscan-api-key", etherscanApiKey, "--verify", "--verifier", "etherscan");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const child = spawn("forge", deployArgs, {
        cwd: cfg.cwd,
        env: { ...process.env },
      });

      let fullOutput = "";
      let transactionHash: string | undefined;
      let contractAddress: string | undefined;

      child.stdout.on("data", (data) => {
        const output = data.toString();
        fullOutput += output;

        if (!transactionHash) {
          const txMatch = output.match(TX_HASH_REGEX);
          if (txMatch) transactionHash = txMatch[1];
        }

        if (!contractAddress) {
          const addrMatch = output.match(CONTRACT_ADDRESS_REGEX);
          if (addrMatch) contractAddress = addrMatch[1];
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "output", output })}\n\n`));
      });

      child.stderr.on("data", (data) => {
        const output = data.toString();
        fullOutput += output;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", output })}\n\n`));
      });

      child.on("close", async (code) => {
        if (code === 0) {
          if (transactionHash) {
            await recordDeployment({
              id: transactionHash,
              assetName: body.tokenName,
              chain: body.chain,
              status: "deployed",
            });
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "success",
                transactionHash,
                contractAddress,
                output: fullOutput,
              })}\n\n`
            )
          );
        } else {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                output: `Deployment failed with exit code ${code}`,
                fullOutput,
              })}\n\n`
            )
          );
        }

        controller.close();
      });

      child.on("error", (error) => {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "error",
              output: `Failed to start deployment process: ${error.message}`,
              fullOutput,
            })}\n\n`
          )
        );
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function GET() {
  return Response.json({ message: "Contract deployment API" });
}
