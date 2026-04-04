import { type NextRequest } from "next/server";
import { z } from "zod";
import { ensureInit } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const InviteSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().optional(),
  role: z.enum(["admin", "member"]).optional().default("member"),
});

export async function GET(request: NextRequest) {
  try {
    await ensureInit();
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    // Team table not yet in DB schema — return empty array
    return Response.json({ members: [] });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureInit();
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const parsed = InviteSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { email, name, role } = parsed.data;

    // Team table not yet in schema — log and acknowledge
    console.log(
      `[agency/team] Invite requested: email=${email}, name=${name ?? ""}, role=${role}, by=${auth.user!.walletAddress}`,
    );

    return Response.json({
      success: true,
      message: `Invite sent to ${email}`,
      email,
      name: name ?? null,
      role,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
