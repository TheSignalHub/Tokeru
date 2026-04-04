import { getDb } from "./client";
import { notifications } from "./schema";
import { eq, desc, and, sql } from "drizzle-orm";

export async function createNotification(
  userAddress: string,
  type: string,
  title: string,
  message: string,
  contractId?: string,
) {
  const now = new Date().toISOString();
  await getDb().insert(notifications).values({
    userAddress: userAddress.toLowerCase(),
    type,
    title,
    message,
    contractId,
    read: false,
    createdAt: now,
  });
}

export async function findByUser(userAddress: string, limit = 20) {
  return getDb()
    .select()
    .from(notifications)
    .where(eq(notifications.userAddress, userAddress.toLowerCase()))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markAsRead(id: number) {
  await getDb()
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, id));
}

export async function markAllRead(userAddress: string) {
  await getDb()
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.userAddress, userAddress.toLowerCase()),
        eq(notifications.read, false),
      ),
    );
}

export async function countUnread(userAddress: string): Promise<number> {
  const result = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userAddress, userAddress.toLowerCase()),
        eq(notifications.read, false),
      ),
    );
  return Number(result[0]?.count ?? 0);
}
