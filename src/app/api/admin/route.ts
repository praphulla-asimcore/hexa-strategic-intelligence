import { NextResponse } from "next/server";
import { config, integrationStatus } from "@/lib/server/config";
import { getActor, isAdmin } from "@/lib/server/session";
import type { Role } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Users, roles and the audit trail (admin only).
export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!config.db()) return NextResponse.json({ status: integrationStatus(), users: [], audit: [] });
  const { listUsers, recentAudit } = await import("@/lib/server/db");
  return NextResponse.json({
    status: integrationStatus(),
    users: isAdmin(actor) ? await listUsers() : [],
    audit: await recentAudit(150),
  });
}

export async function PATCH(req: Request) {
  const actor = await getActor();
  if (!isAdmin(actor)) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { email, role } = (await req.json()) as { email: string; role: Role };
  if (!["admin", "editor", "viewer"].includes(role)) return NextResponse.json({ error: "bad role" }, { status: 400 });
  if (email === actor!.email && role !== "admin") return NextResponse.json({ error: "You can't remove your own admin role" }, { status: 400 });
  const { setRole } = await import("@/lib/server/db");
  await setRole(email.toLowerCase(), role, actor!.email);
  return NextResponse.json({ ok: true });
}
