import { NextResponse } from "next/server";
import { config } from "@/lib/server/config";
import { canEdit, getActor } from "@/lib/server/session";

export const runtime = "nodejs";

const ALLOWED = new Set(["weights"]);

export async function PUT(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!ALLOWED.has(key)) return NextResponse.json({ error: "unknown setting" }, { status: 404 });
  if (!config.db()) return NextResponse.json({ error: "database not configured" }, { status: 503 });
  const actor = await getActor();
  if (!canEdit(actor)) return NextResponse.json({ error: "Your role is view-only" }, { status: 403 });
  const { setSetting } = await import("@/lib/server/db");
  await setSetting(key, await req.json(), actor!.email);
  return NextResponse.json({ ok: true });
}
