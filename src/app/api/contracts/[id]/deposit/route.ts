import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { validateDeposit, createDepositRecord } from "@/lib/payments/escrow";
import { depositEscrow, isBlockchainConfigured, createDeal, isFactoryConfigured } from "@/lib/blockchain";

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

    // ── Chain-first: deposit escrow on-chain ──
    if (contract.onChainAddress && isBlockchainConfigured()) {
      try {
        txHash = await depositEscrow(
          contract.onChainAddress,
          BigInt(Math.round(parsed.data.amount * 1e18)),
        );
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
    }

    return Response.json({ ...updatedEscrow, txHash });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
