import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const AgencySetupSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  categories: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    await ensureInit();
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const walletAddress = auth.user!.walletAddress;
    if (!walletAddress) {
      return Response.json(
        { error: "No wallet associated with account" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = AgencySetupSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { companyName, description, website, categories } = parsed.data;

    const updated = await db.users.updateAgencyScore(walletAddress, {
      companyName,
      description: description || undefined,
      website: website || undefined,
      categories: categories ?? [],
    });

    return Response.json(updated);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
