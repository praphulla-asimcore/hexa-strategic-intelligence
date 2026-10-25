import { NextResponse } from "next/server";
import { config, integrationStatus } from "@/lib/server/config";
import { getActor } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const status = integrationStatus();
  if (!config.db()) return NextResponse.json({ mode: "local", actor, status });
  try {
    const { loadAll } = await import("@/lib/server/db");
    const data = await loadAll();
    return NextResponse.json({ mode: "remote", actor, status, ...data });
  } catch (e) {
    return NextResponse.json({ mode: "local", actor, status, error: `Database error: ${(e as Error).message}` });
  }
}
