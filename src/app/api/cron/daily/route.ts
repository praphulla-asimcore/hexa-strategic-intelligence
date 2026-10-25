import { NextResponse } from "next/server";
import { config } from "@/lib/server/config";
import { getActor, isAdmin } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Vercel Cron calls this daily with `Authorization: Bearer $CRON_SECRET`.
// Admins can also trigger it (or a single job via ?job=) from Models & data.
export async function GET(req: Request) {
  const bearer = req.headers.get("authorization");
  const fromCron = config.cron() && bearer === `Bearer ${process.env.CRON_SECRET}`;
  if (!fromCron) {
    const actor = await getActor();
    if (!isAdmin(actor)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  if (!config.db()) return NextResponse.json({ error: "database not configured" }, { status: 503 });
  const { runAll, runJob, JOBS } = await import("@/lib/server/jobs");
  const job = new URL(req.url).searchParams.get("job");
  if (job) {
    if (!(job in JOBS)) return NextResponse.json({ error: "unknown job" }, { status: 400 });
    return NextResponse.json({ results: [await runJob(job as keyof typeof JOBS)] });
  }
  return NextResponse.json({ results: await runAll() });
}
