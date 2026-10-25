import { NextResponse } from "next/server";
import { config } from "@/lib/server/config";
import { canEdit, getActor } from "@/lib/server/session";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body =
  | { action: "apollo.companies"; locations: string[]; employeeRanges: string[]; keywords: string[]; page?: number }
  | { action: "apollo.people"; organizationId?: string; domain?: string; titles: string[] }
  | { action: "apollo.reveal"; id: string }
  | { action: "apollo.jobs"; organizationId: string }
  | { action: "lusha.company"; domain: string }
  | { action: "lusha.person"; firstName: string; lastName: string; companyDomain: string };

// Live prospecting: proxies Apollo / Lusha so API keys stay server-side.
export async function POST(req: Request) {
  const actor = await getActor();
  if (!canEdit(actor)) return NextResponse.json({ error: "Your role is view-only" }, { status: 403 });
  const b = (await req.json()) as Body;
  try {
    if (b.action.startsWith("apollo.") && !config.apollo()) return NextResponse.json({ error: "APOLLO_API_KEY is not set in Vercel" }, { status: 503 });
    if (b.action.startsWith("lusha.") && !config.lusha()) return NextResponse.json({ error: "LUSHA_API_KEY is not set in Vercel" }, { status: 503 });
    const apollo = await import("@/lib/server/apollo");
    const lusha = await import("@/lib/server/lusha");
    switch (b.action) {
      case "apollo.companies":
        return NextResponse.json(await apollo.searchOrganizations(b));
      case "apollo.people":
        return NextResponse.json({ people: await apollo.searchPeople(b) });
      case "apollo.reveal":
        return NextResponse.json({ person: await apollo.matchPerson(b.id) });
      case "apollo.jobs":
        return NextResponse.json({ jobs: await apollo.jobPostings(b.organizationId) });
      case "lusha.company":
        return NextResponse.json({ company: await lusha.companyByDomain(b.domain) });
      case "lusha.person":
        return NextResponse.json({ person: await lusha.enrichPerson(b) });
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
