import { ethers } from "ethers";
import { type NextRequest } from "next/server";
import { db, ensureInit } from "@/lib/db";
import { isBlockchainConfigured } from "@/lib/blockchain";
import { CHAIN_CONFIG } from "@/lib/blockchain/config";
import { getDeployerSigner } from "@/lib/blockchain/clients";
import { SERVICE_CONTRACT_ABI } from "@/lib/blockchain/abis";
import { createPool, addLiquidity } from "@/lib/uniswap";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/contracts/:id/pool
 *
 * Agency-only. Creates a Uniswap V3 secondary market pool for a tokenized contract.
 * Requires: contract is tokenized AND has tokens minted (totalSupply > 0).
 *
 * Steps:
 *  1. Mint tokens to deployer (for initial liquidity seeding)
 *  2. Create Uniswap V3 pool (ContractToken / USDC)
 *  3. Add initial liquidity
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureInit();
    const { id } = await params;
    const contract = await db.contracts.findById(id);

    if (!contract) {
      return Response.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.agency.toLowerCase() !== auth.user!.walletAddress?.toLowerCase()) {
      return Response.json({ error: "Only the agency can activate the pool" }, { status: 403 });
    }

    if (!contract.tokenizationExposure) {
      return Response.json({ error: "Contract must be tokenized first" }, { status: 400 });
    }

    if (!contract.tokenAddress || !contract.onChainAddress) {
      return Response.json({ error: "Contract not deployed on-chain" }, { status: 400 });
    }

    if (!isBlockchainConfigured() || !CHAIN_CONFIG.paymentTokenAddress) {
      return Response.json({ error: "Blockchain not configured" }, { status: 400 });
    }

    // Parse tokenization settings (1 token = $1 face value by default)
    let totalSupply = contract.totalValue;
    let pricePerToken = 1;
    try {
      const exposure = JSON.parse(contract.tokenizationExposure);
      totalSupply = exposure.totalSupply ?? contract.totalValue;
      pricePerToken = exposure.pricePerToken ?? 1;
    } catch { /* use defaults */ }

    const signer = getDeployerSigner();
    const deployerAddress = await signer.getAddress();

    // 1. Mint liquidity tokens to deployer (for pool seeding)
    //    These are separate from investor tokens — they seed the AMM.
    const liquidityTokenAmount = ethers.parseUnits(Math.floor(totalSupply * 0.1).toString(), 18); // 10% of supply for liquidity
    const sc = new ethers.Contract(contract.onChainAddress, SERVICE_CONTRACT_ABI, signer);

    try {
      const tx = await sc.mintTokens(deployerAddress, liquidityTokenAmount, { gasLimit: 300_000 });
      await tx.wait(1);
      console.log(`[pool] Minted ${ethers.formatUnits(liquidityTokenAmount, 18)} liquidity tokens to deployer`);
    } catch (mintErr) {
      const msg = mintErr instanceof Error ? mintErr.message : String(mintErr);
      // If cap exceeded, liquidity tokens may already exist — try to continue
      if (!msg.includes("Cap exceeded")) {
        return Response.json({ error: `Failed to mint liquidity tokens: ${msg}` }, { status: 500 });
      }
      console.warn("[pool] Mint skipped (cap reached), continuing with existing balance");
    }

    // 2. Create Uniswap V3 pool
    let poolAddress: string;
    let poolExisted = false;
    try {
      const poolResult = await createPool({
        tokenAddress: contract.tokenAddress,
        usdcAddress: CHAIN_CONFIG.paymentTokenAddress,
        initialPrice: pricePerToken,
        signer,
      });
      poolAddress = poolResult.address;
      poolExisted = poolResult.existed;
      console.log(`[pool] Uniswap pool: ${poolAddress} (existed: ${poolExisted})`);
    } catch (poolErr) {
      const msg = poolErr instanceof Error ? poolErr.message : String(poolErr);
      return Response.json({ error: `Failed to create pool: ${msg}` }, { status: 500 });
    }

    // 3. Add initial liquidity
    if (poolAddress && poolAddress !== ethers.ZeroAddress && !poolExisted) {
      try {
        const usdcContract = new ethers.Contract(
          CHAIN_CONFIG.paymentTokenAddress,
          ["function decimals() view returns (uint8)"],
          signer,
        );
        const usdcDecimals = await usdcContract.decimals().then(Number).catch(() => 18);
        const liquiditySupplyNum = Number(ethers.formatUnits(liquidityTokenAmount, 18));
        const usdcAmount = ethers.parseUnits(
          (liquiditySupplyNum * pricePerToken).toString(),
          usdcDecimals,
        );

        await addLiquidity({
          tokenAddress: contract.tokenAddress,
          usdcAddress: CHAIN_CONFIG.paymentTokenAddress,
          tokenAmount: liquidityTokenAmount,
          usdcAmount,
          signer,
        });
        console.log(`[pool] Initial liquidity added`);
      } catch (liqErr) {
        const msg = liqErr instanceof Error ? liqErr.message : String(liqErr);
        console.warn(`[pool] Liquidity addition failed (pool exists but empty): ${msg}`);
        // Pool was created, just no liquidity — still a partial success
      }
    }

    return Response.json({
      success: true,
      poolAddress,
      poolExisted,
    });
  } catch (error) {
    console.error("[pool] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
