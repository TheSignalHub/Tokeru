import { getDb } from "./client";
import { investorHoldings } from "./schema";
import { eq, and, sql } from "drizzle-orm";

export interface Holding {
  id: number;
  investorAddress: string;
  contractId: string;
  tokenAddress: string;
  amount: number;
  buyPrice: number;
  currentPrice: number;
  purchasedAt: string | null;
}

export async function createHolding(data: {
  investorAddress: string;
  contractId: string;
  tokenAddress: string;
  amount: number;
  buyPrice: number;
}): Promise<void> {
  const db = getDb();
  await db.insert(investorHoldings).values({
    investorAddress: data.investorAddress.toLowerCase(),
    contractId: data.contractId,
    tokenAddress: data.tokenAddress,
    amount: data.amount,
    buyPrice: data.buyPrice,
    currentPrice: data.buyPrice,
    purchasedAt: new Date().toISOString(),
  });
}

export async function findByInvestor(address: string): Promise<Holding[]> {
  const db = getDb();
  const result = await db
    .select()
    .from(investorHoldings)
    .where(eq(investorHoldings.investorAddress, address.toLowerCase()))
    .orderBy(sql`purchased_at DESC`);
  return result as Holding[];
}

export async function addToHolding(
  investorAddress: string,
  contractId: string,
  amount: number,
  buyPrice: number,
  tokenAddress: string = "",
): Promise<void> {
  const db = getDb();
  const existing = await db
    .select()
    .from(investorHoldings)
    .where(
      and(
        eq(investorHoldings.investorAddress, investorAddress.toLowerCase()),
        eq(investorHoldings.contractId, contractId),
      ),
    );

  if (existing.length > 0) {
    const old = existing[0];
    const newAmount = old.amount + amount;
    await db
      .update(investorHoldings)
      .set({ amount: newAmount, buyPrice })
      .where(eq(investorHoldings.id, old.id));
  } else {
    await createHolding({
      investorAddress,
      contractId,
      tokenAddress,
      amount,
      buyPrice,
    });
  }
}
