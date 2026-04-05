import { ensureTables } from "./migrate";

let initialized = false;

export async function ensureInit() {
  if (initialized) return;
  try {
    await ensureTables();
  } catch (err) {
    console.error("[db] ensureTables failed:", err instanceof Error ? err.message : err);
  }
  initialized = true;
}
