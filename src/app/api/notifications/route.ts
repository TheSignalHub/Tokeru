import { type NextRequest } from "next/server";
import { db, ensureInit } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/notifications
 * Returns the 20 most recent notifications for the authenticated user,
 * plus the unread count.
 */
export async function GET(request: NextRequest) {
  try {
    await ensureInit();

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const walletAddress = auth.user!.walletAddress;
    if (!walletAddress) {
      return Response.json({ notifications: [], unreadCount: 0 });
    }

    const [items, unreadCount] = await Promise.all([
      db.notifications.findByUser(walletAddress),
      db.notifications.countUnread(walletAddress),
    ]);

    return Response.json({ notifications: items, unreadCount });
  } catch (error) {
    console.error("[notifications/GET] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/notifications
 * Mark a single notification as read, or mark all as read.
 * Body: { id: number } or { markAllRead: true }
 */
export async function PATCH(request: NextRequest) {
  try {
    await ensureInit();

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const walletAddress = auth.user!.walletAddress;
    if (!walletAddress) {
      return Response.json({ error: "No wallet" }, { status: 403 });
    }

    const body = await request.json();

    if (body.markAllRead === true) {
      await db.notifications.markAllRead(walletAddress);
      return Response.json({ success: true });
    }

    if (typeof body.id === "number") {
      await db.notifications.markAsRead(body.id);
      return Response.json({ success: true });
    }

    return Response.json({ error: "Provide { id } or { markAllRead: true }" }, { status: 400 });
  } catch (error) {
    console.error("[notifications/PATCH] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
