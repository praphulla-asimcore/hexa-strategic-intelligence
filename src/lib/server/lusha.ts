import "server-only";

// Lusha API (https://api.lusha.com). Company lookup by domain and person enrichment.
// API access requires a Lusha Scale plan; reveals consume Lusha credits.

const BASE = "https://api.lusha.com";

async function call<T>(path: string): Promise<T> {
  const key = process.env.LUSHA_API_KEY;
  if (!key) throw new Error("LUSHA_API_KEY not configured");
  const res = await fetch(`${BASE}${path}`, { headers: { api_key: key }, signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Lusha ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

export interface LushaCompany {
  name?: string;
  domain?: string;
  employees?: string;
  industry?: string;
  subIndustry?: string;
  location?: { country?: string; city?: string };
  description?: string;
  revenueRange?: string;
  linkedin?: string;
}

export async function companyByDomain(domain: string) {
  const r = await call<{ data?: LushaCompany } & LushaCompany>(`/v2/company?domain=${encodeURIComponent(domain)}`);
  return (r.data ?? r) as LushaCompany;
}

export interface LushaPerson {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: { title?: string } | string;
  emailAddresses?: { email: string; emailType?: string; emailConfidence?: string }[];
  phoneNumbers?: { number: string; phoneType?: string }[];
  socialLinks?: { linkedin?: string };
}

export async function enrichPerson(p: { firstName: string; lastName: string; companyDomain: string }) {
  const q = new URLSearchParams({ firstName: p.firstName, lastName: p.lastName, companyDomain: p.companyDomain });
  const r = await call<{ data?: LushaPerson } & LushaPerson>(`/v2/person?${q}`);
  return (r.data ?? r) as LushaPerson;
}
