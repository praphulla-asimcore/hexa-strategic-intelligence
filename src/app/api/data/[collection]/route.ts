import { NextResponse } from "next/server";
import { isCollection } from "@/lib/collections";
import { config } from "@/lib/server/config";
import { canEdit, getActor } from "@/lib/server/session";

export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ collection: string }> }) {
  const { collection } = await ctx.params;
  if (!isCollection(collection)) return NextResponse.json({ error: "unknown collection" }, { status: 404 });
  if (!config.db()) return NextResponse.json({ error: "database not configured" }, { status: 503 });
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!canEdit(actor)) return NextResponse.json({ error: "Your role is view-only" }, { status: 403 });

  const body = (await req.json()) as { upserts?: { id: string }[]; deletes?: string[] };
  const upserts = (body.upserts ?? []).filter((r) => r && typeof r.id === "string").slice(0, 500);
  const deletes = (body.deletes ?? []).filter((x) => typeof x === "string").slice(0, 500);
  const { applyChanges } = await import("@/lib/server/db");
  await applyChanges(collection, upserts, deletes, actor.email);
  return NextResponse.json({ ok: true, upserts: upserts.length, deletes: deletes.length });
}
