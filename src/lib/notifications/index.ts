import { db } from "@/lib/db";
import { notifyUser } from "@/lib/email";
import type { NotificationType } from "@/lib/email";

/**
 * Send a notification to a user: persists to DB and sends email (best-effort).
 *
 * Use this instead of calling `notifyUser()` directly in API routes
 * so that notifications are both stored in-app and emailed.
 */
export async function notify(
  userAddress: string,
  params: {
    type: NotificationType;
    title: string;
    message: string;
    contractId: string;
    contractTitle: string;
    milestoneName?: string;
    amount?: number;
    tokenAmount?: number;
    investorName?: string;
    reason?: string;
    actorName?: string;
  },
) {
  // 1. Save to DB (always)
  try {
    await db.notifications.createNotification(
      userAddress,
      params.type,
      params.title,
      params.message,
      params.contractId,
    );
  } catch (err) {
    console.error("[notify] DB write failed:", err);
  }

  // 2. Send email (best-effort, non-blocking)
  notifyUser(userAddress, {
    type: params.type,
    contractTitle: params.contractTitle,
    contractId: params.contractId,
    milestoneName: params.milestoneName,
    amount: params.amount,
    tokenAmount: params.tokenAmount,
    investorName: params.investorName,
    reason: params.reason,
    actorName: params.actorName,
  }).catch(() => {});
}
