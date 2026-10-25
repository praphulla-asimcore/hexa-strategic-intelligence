import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/server/config";

export const dynamic = "force-dynamic";

/** Public: which integrations are configured (booleans only, no values). */
export function GET() {
  return NextResponse.json({ ok: true, integrations: integrationStatus() });
}
