import "server-only";

// Apollo.io REST API (https://api.apollo.io/api/v1). Search endpoints return firmographics
// and people without consuming email credits; enrichment (people/match) consumes credits.

const BASE = "https://api.apollo.io/api/v1";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("APOLLO_API_KEY not configured");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": key, ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Apollo ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

export interface ApolloOrg {
  id: string;
  name: string;
  website_url?: string;
  primary_domain?: string;
  linkedin_url?: string;
  estimated_num_employees?: number;
  industry?: string;
  country?: string;
  city?: string;
  short_description?: string;
  founded_year?: number;
  annual_revenue_printed?: string;
  technology_names?: string[];
}

export async function searchOrganizations(f: { locations: string[]; employeeRanges: string[]; keywords: string[]; page?: number }) {
  const r = await call<{ organizations?: ApolloOrg[]; accounts?: ApolloOrg[]; pagination?: { total_entries?: number } }>("/mixed_companies/search", {
    method: "POST",
    body: JSON.stringify({
      organization_locations: f.locations,
      organization_num_employees_ranges: f.employeeRanges,
      q_organization_keyword_tags: f.keywords,
      page: f.page ?? 1,
      per_page: 25,
    }),
  });
  return { orgs: [...(r.organizations ?? []), ...(r.accounts ?? [])], total: r.pagination?.total_entries ?? 0 };
}

export interface ApolloPerson {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  last_name_obfuscated?: string;
  title?: string;
  seniority?: string;
  linkedin_url?: string;
  email_status?: string;
  departments?: string[];
}

export async function searchPeople(f: { organizationId?: string; domain?: string; titles: string[] }) {
  const body: Record<string, unknown> = { person_titles: f.titles, page: 1, per_page: 25 };
  if (f.organizationId) body.organization_ids = [f.organizationId];
  if (f.domain) body.q_organization_domains_list = [f.domain];
  const r = await call<{ people?: ApolloPerson[]; contacts?: ApolloPerson[] }>("/mixed_people/api_search", { method: "POST", body: JSON.stringify(body) });
  return [...(r.people ?? []), ...(r.contacts ?? [])];
}

export interface JobPosting {
  id: string;
  title: string;
  url?: string;
  city?: string;
  country?: string;
  posted_at?: string;
  last_seen_at?: string;
}

export async function jobPostings(organizationId: string) {
  const r = await call<{ organization_job_postings?: JobPosting[] }>(`/organizations/${organizationId}/job_postings?page=1&per_page=50`);
  return r.organization_job_postings ?? [];
}

/** Reveals a business email for one person (consumes Apollo credits). */
export async function matchPerson(id: string) {
  const r = await call<{ person?: ApolloPerson & { email?: string } }>("/people/match", {
    method: "POST",
    body: JSON.stringify({ id, reveal_personal_emails: false }),
  });
  return r.person ?? null;
}
