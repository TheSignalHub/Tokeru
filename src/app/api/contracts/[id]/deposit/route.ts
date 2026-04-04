import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { validateDeposit, createDepositRecord } from "@/lib/payments/escrow";
import { depositEscrow, isBlockchainConfigured, createDeal, isFactoryConfigured } from "@/lib/blockchain";
import { CHAIN_CONFIG } from "@/lib/blockchain/config";
import { notify } from "@/lib/notifications";
import { privateDeposit, privateTransfer, isUnlinkConfigured, createUnlinkClient } from "@/lib/privacy";

const DepositSchema = z.object({
  amount: z.number().positive(),
  txHash: z.string().optional(), // Optional — chain provides real txHash
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureInit();
    const { id } = await params;

    const auth = await requireRole(request, id, "client");
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const parsed = DepositSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const contract = await db.contracts.findById(id);
    if (!contract) return Response.json({ error: "Contract not found" }, { status: 404 });

    const escrow = await db.escrows.findByContract(id);
    if (!escrow) return Response.json({ error: "Escrow not found" }, { status: 404 });

    if (escrow.depositedAmount >= escrow.totalAmount) {
      return Response.json({ error: "Escrow already fully funded" }, { status: 400 });
    }

    const validation = validateDeposit(escrow.totalAmount, escrow.depositedAmount, parsed.data.amount);
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    let txHash = parsed.data.txHash || `db_${Date.now().toString(36)}`;

    // ── Deploy on-chain if not yet deployed (this is THE moment — money is entering) ──
    if (!contract.onChainAddress && isFactoryConfigured() && contract.client && contract.agency) {
      try {
        console.log("[deposit] Contract not on-chain yet — deploying via factory...");
        const result = await createDeal({
          client: contract.client,
          agency: contract.agency,
          bd: contract.bd,
          bdFeeBps: Math.round((contract.bdFeePercent ?? 0) * 100),
          termsHash: contract.termsHash || `terms_${contract.id}`,
          milestones: contract.milestones.map((m) => ({
            name: m.name,
            amount: BigInt(Math.round(m.amount * 1e18)),
            deadline: m.deadline ? Math.floor(new Date(m.deadline).getTime() / 1000) : 0,
          })),
          tokenName: `${contract.title} Token`,
          tokenSymbol: (contract.title.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 4) || "DEAL") + contract.id.slice(0, 2).toUpperCase(),
        });

        contract.onChainAddress = result.serviceContractAddress;
        contract.tokenAddress = result.tokenAddress;

        await db.contracts.update(id, {
          onChainAddress: result.serviceContractAddress,
          tokenAddress: result.tokenAddress,
        });
        console.log("[deposit] Deployed:", result.serviceContractAddress, "token:", result.tokenAddress);
      } catch (chainErr) {
        const msg = chainErr instanceof Error ? chainErr.message : String(chainErr);
        console.error("[deposit] Factory deploy FAILED:", msg);
        return Response.json(
          { error: `On-chain deployment failed: ${msg}` },
          { status: 500 },
        );
      }
    }

    // ── Deposit escrow ──
    // If Unlink is configured: client deposits into shielded pool → operator withdraws → deposits on-chain
    // This hides the client's wallet address from the on-chain transaction.
    // If Unlink is NOT configured: direct on-chain deposit (client address visible).
    const depositAmount = BigInt(Math.round(parsed.data.amount * 1e18));

    if (isUnlinkConfigured() && contract.onChainAddress && isBlockchainConfigured()) {
      try {
        // 1. Get client's Unlink mnemonic
        const clientUser = await db.users.findRawByAddress(auth.walletAddress);
        if (!clientUser?.unlinkMnemonic) {
          throw new Error("Client Unlink wallet not configured. Please set up privacy in your profile.");
        }

        const paymentToken = CHAIN_CONFIG.paymentTokenAddress;
        if (!paymentToken) throw new Error("Payment token not configured");

        const amountStr = parsed.data.amount.toString();

        // 2. Client deposits USDC into Unlink shielded pool (hides their address)
        console.log("[deposit] Private deposit: client → shielded pool...");
        await privateDeposit(clientUser.unlinkMnemonic, paymentToken, amountStr);

        // 3. Private transfer from client's shielded balance to deployer's shielded balance
        // The deployer will then deposit into the ServiceContract on behalf of the client
        console.log("[deposit] Private transfer: shielded pool → operator...");
        const deployerUnlinkClient = createUnlinkClient(clientUser.unlinkMnemonic);
        const deployerAddr = await deployerUnlinkClient.getAddress();
        await privateTransfer(clientUser.unlinkMnemonic, deployerAddr, paymentToken, amountStr);

        // 4. Operator deposits into ServiceContract (client address never appears on-chain)
        console.log("[deposit] Operator depositing into ServiceContract...");
        txHash = await depositEscrow(contract.onChainAddress, depositAmount);
        console.log("[deposit] Private deposit complete:", txHash);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Private deposit failed";
        console.warn("[deposit] Unlink private deposit failed, falling back to direct:", msg);

        // Fall back to direct deposit if Unlink fails
        try {
          txHash = await depositEscrow(contract.onChainAddress, depositAmount);
          console.log("[deposit] Direct deposit fallback success:", txHash);
        } catch (directErr) {
          const directMsg = directErr instanceof Error ? directErr.message : "Deposit failed";
          return Response.json(
            { error: `Deposit failed: ${directMsg}` },
            { status: 500 },
          );
        }
      }
    } else if (contract.onChainAddress && isBlockchainConfigured()) {
      // Direct on-chain deposit (no Unlink — client address visible)
      try {
        txHash = await depositEscrow(contract.onChainAddress, depositAmount);
        console.log("[deposit] On-chain success:", txHash);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "On-chain deposit failed";
        console.error("[deposit] On-chain FAILED:", msg);
        return Response.json(
          { error: `Deposit failed on-chain: ${msg}. Please ensure you have approved USDC spending.` },
          { status: 500 },
        );
      }
    }

    // ── DB: record deposit only after chain succeeds ──
    const depositRecord = createDepositRecord({ amount: parsed.data.amount, txHash });
    const updatedEscrow = await db.escrows.addDeposit(id, depositRecord);

    if (updatedEscrow.depositedAmount >= updatedEscrow.totalAmount) {
      await db.contracts.update(id, { status: "active" });

      // Notify agency that escrow is deposited and contract is active
      if (contract.agency) {
        notify(contract.agency, {
          type: "escrow_deposited",
          title: "Escrow deposited",
          message: `The client has deposited $${parsed.data.amount.toLocaleString()} into escrow for "${contract.title}". The contract is now active.`,
          contractTitle: contract.title,
          contractId: id,
          amount: parsed.data.amount,
        });
      }
    }

    return Response.json({ ...updatedEscrow, txHash });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
