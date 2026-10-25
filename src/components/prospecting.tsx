"use client";

import { useState } from "react";
import { Loader2, Mail, Search, Sparkles, UserSearch } from "lucide-react";
import { useIntel, uid, today } from "@/lib/store";
import { ARENAS, ARENA_LABEL, ARENA_SHORT, COUNTRY_LABEL } from "@/lib/labels";
import type { Account, Arena, Contact, CountryCode, Segment } from "@/lib/types";
import { Badge, Button, Field, Input, Modal, Select } from "./ui";

// Live prospecting UI. All calls go through /api/prospect so API keys stay on the server.

export async function prospect<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/prospect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...body }) });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
  return j as T;
}

const COUNTRY_BY_NAME: Record<string, CountryCode> = {
  australia: "AU",
  malaysia: "MY",
  singapore: "SG",
  nepal: "NP",
  indonesia: "ID",
  bangladesh: "BD",
  "united kingdom": "UK",
  "united states": "US",
};
const LOCATION_FOR: Record<CountryCode, string> = {
  AU: "australia",
  MY: "malaysia",
  SG: "singapore",
  NP: "nepal",
  ID: "indonesia",
  BD: "bangladesh",
  UK: "united kingdom",
  US: "united states",
};
const SIZE_RANGES = [
  { value: "1,10", label: "1–10" },
  { value: "11,50", label: "11–50" },
  { value: "51,200", label: "51–200" },
  { value: "201,500", label: "201–500" },
  { value: "501,1000", label: "501–1,000" },
  { value: "1001,5000", label: "1,001–5,000" },
];
const PRESETS: Record<string, { arena: Arena; segment: Segment; keywords: string; sizes: string[]; country: CountryCode }> = {
  "AU accounting firms": { arena: "finance_outsourcing", segment: "Accounting firms", keywords: "accounting, chartered accountants, tax advisory, bookkeeping", sizes: ["11,50", "51,200"], country: "AU" },
  "SG mid-market (finance)": { arena: "finance_outsourcing", segment: "Mid-market", keywords: "logistics, distribution, professional services", sizes: ["201,500", "501,1000"], country: "SG" },
  "MY SMEs (EOR/payroll)": { arena: "eor_payroll", segment: "SME", keywords: "technology, e-commerce, professional services", sizes: ["11,50", "51,200"], country: "MY" },
  "SG scale-ups (tech)": { arena: "tech_outsourcing", segment: "Scale-ups", keywords: "saas, fintech, healthtech, software", sizes: ["51,200", "201,500"], country: "SG" },
};

interface ApolloOrg {
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
}

const WHY_SERVICE: Record<Arena, string> = {
  finance_outsourcing: "Recurring finance work (bookkeeping, AP/AR, month-end, tax prep) suited to a managed Nepal finance team with senior review.",
  eor_payroll: "Hiring or paying staff across borders without an entity — EOR + payroll with local compliance ownership.",
  tech_outsourcing: "Engineering capacity via a dedicated Hexa team with tech-lead oversight and ISO 27001 controls.",
  advisory: "Market-entry, structuring or automation decisions where local regulatory credibility matters.",
};

export function FindAccounts({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, set, notify } = useIntel();
  const [preset, setPreset] = useState("AU accounting firms");
  const [f, setF] = useState(PRESETS["AU accounting firms"]);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<{ orgs: ApolloOrg[]; total: number } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const existing = new Set(state.accounts.map((a) => a.apollo_org_id).filter(Boolean));

  const run = async (p = 1) => {
    setBusy(true);
    setErr("");
    try {
      const r = await prospect<{ orgs: ApolloOrg[]; total: number }>("apollo.companies", {
        locations: [LOCATION_FOR[f.country]],
        employeeRanges: f.sizes,
        keywords: f.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        page: p,
      });
      setRes(r);
      setPage(p);
      setPicked(new Set());
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  const importPicked = async () => {
    const orgs = (res?.orgs ?? []).filter((o) => picked.has(o.id));
    const accounts: Account[] = orgs.map((o) => {
      const country = COUNTRY_BY_NAME[(o.country || "").toLowerCase()] ?? f.country;
      const staff = o.estimated_num_employees ?? 0;
      return {
        id: uid("acc"),
        name: o.name,
        sample: false,
        source: "apollo",
        apollo_org_id: o.id,
        domain: o.primary_domain,
        website: o.website_url,
        linkedin_url: o.linkedin_url,
        description: o.short_description?.slice(0, 400),
        location: [o.city, o.country].filter(Boolean).join(", "),
        country,
        industry: o.industry || "—",
        segment: f.segment,
        headcount: staff,
        revenue_band: "—",
        software: [],
        target_arena: f.arena,
        signals: [],
        fit: 3,
        outsourcing_readiness: 3,
        status: "new",
        owner: "BizDev",
        why_company: `${o.industry ?? "Company"} · ${staff || "?"} staff · ${[o.city, o.country].filter(Boolean).join(", ")}${o.short_description ? ` — ${o.short_description.slice(0, 160)}` : ""}`,
        why_service: WHY_SERVICE[f.arena],
        why_now: "Checking live job postings…",
        contacts: [],
        enriched_at: today(),
      };
    });
    set("accounts", (xs) => [...xs, ...accounts]);
    notify(`Imported ${accounts.length} accounts from Apollo — checking open roles…`);
    onClose();
    // Pull live job postings to establish "why now".
    for (const a of accounts) {
      try {
        const { jobs } = await prospect<{ jobs: { title: string; url?: string; posted_at?: string }[] }>("apollo.jobs", { organizationId: a.apollo_org_id });
        const rel = jobs.filter((j) => /(account|financ|bookkeep|payroll|audit|tax|controller|engineer|developer)/i.test(j.title));
        set("accounts", (xs) =>
          xs.map((x) =>
            x.id === a.id
              ? { ...x, open_roles: rel.slice(0, 15), why_now: rel.length ? `${rel.length} open finance/tech roles on Apollo (e.g. ${rel.slice(0, 2).map((r) => r.title).join(", ")}).` : "No relevant open roles found — monitor for triggers.", fit: rel.length >= 2 ? 4 : x.fit }
              : x,
          ),
        );
      } catch {
        /* job postings optional */
      }
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Find accounts — live from Apollo">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(PRESETS).map((k) => (
            <button key={k} onClick={() => { setPreset(k); setF(PRESETS[k]); }} className={`rounded-lg px-2.5 py-1 text-xs ${preset === k ? "nav-pill-active text-ink" : "bg-chip text-ink-2"}`}>{k}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Country"><Select value={f.country} onChange={(v) => setF({ ...f, country: v })} options={(Object.keys(LOCATION_FOR) as CountryCode[]).map((c) => ({ value: c, label: COUNTRY_LABEL[c] }))} /></Field>
          <Field label="Target service"><Select value={f.arena} onChange={(v) => setF({ ...f, arena: v })} options={ARENAS.map((a) => ({ value: a, label: ARENA_SHORT[a] }))} /></Field>
          <Field label="Segment"><Select value={f.segment} onChange={(v) => setF({ ...f, segment: v })} options={(["SME", "Mid-market", "Enterprise", "Accounting firms", "Scale-ups"] as Segment[]).map((s) => ({ value: s, label: s }))} /></Field>
        </div>
        <Field label="Industry keywords" hint="Comma-separated Apollo keyword tags"><Input value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} /></Field>
        <div>
          <div className="mb-1 text-xs font-medium text-ink-2">Employees</div>
          <div className="flex flex-wrap gap-1.5">
            {SIZE_RANGES.map((r) => (
              <button key={r.value} onClick={() => setF({ ...f, sizes: f.sizes.includes(r.value) ? f.sizes.filter((x) => x !== r.value) : [...f.sizes, r.value] })} className={`rounded-lg px-2.5 py-1 text-xs ${f.sizes.includes(r.value) ? "nav-pill-active text-ink" : "bg-chip text-ink-2"}`}>{r.label}</button>
            ))}
          </div>
        </div>
        <Button variant="primary" onClick={() => run(1)} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search Apollo</Button>
        {err && <p className="rounded-lg bg-bad-50 px-3 py-2 text-xs text-bad">{err}</p>}
        {res && (
          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-muted">
              <span>{res.total.toLocaleString()} matches · page {page}</span>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={page <= 1 || busy} onClick={() => run(page - 1)}>Prev</Button>
                <Button size="sm" variant="ghost" disabled={busy || res.orgs.length < 25} onClick={() => run(page + 1)}>Next</Button>
              </span>
            </div>
            <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {res.orgs.map((o) => {
                const dup = existing.has(o.id);
                return (
                  <li key={o.id} className="flex items-start gap-3 px-3 py-2">
                    <input type="checkbox" disabled={dup} checked={picked.has(o.id)} onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(o.id); else n.delete(o.id); setPicked(n); }} className="mt-1 accent-[#8b18e8]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink">{o.name} {dup && <Badge>already added</Badge>}</div>
                      <div className="truncate text-xs text-muted">{[o.industry, o.estimated_num_employees ? `${o.estimated_num_employees} staff` : null, o.city, o.primary_domain].filter(Boolean).join(" · ")}</div>
                    </div>
                  </li>
                );
              })}
              {!res.orgs.length && <li className="p-4 text-center text-sm text-muted">No matches — broaden keywords or sizes.</li>}
            </ul>
            <div className="mt-3 flex justify-end">
              <Button variant="primary" disabled={!picked.size} onClick={importPicked}>Import {picked.size || ""} account{picked.size === 1 ? "" : "s"}</Button>
            </div>
          </div>
        )}
        <p className="text-[11px] text-subtle">Company search uses Apollo search (no email credits). Imported accounts get live job-posting checks to establish &ldquo;why now&rdquo;.</p>
      </div>
    </Modal>
  );
}

interface ApolloPerson {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  last_name_obfuscated?: string;
  title?: string;
  seniority?: string;
  linkedin_url?: string;
  email_status?: string;
}

const TITLES: Record<Arena, string[]> = {
  finance_outsourcing: ["Managing Partner", "Partner", "Practice Manager", "CFO", "Finance Director", "Financial Controller", "Head of Finance"],
  eor_payroll: ["Head of HR", "HR Director", "People Operations", "CFO", "COO", "Founder"],
  tech_outsourcing: ["CTO", "VP Engineering", "Head of Engineering", "Engineering Manager", "Founder"],
  advisory: ["CEO", "Managing Director", "CFO", "Founder"],
};

const seniorityOf = (p: ApolloPerson): Contact["seniority"] => {
  const s = `${p.seniority ?? ""} ${p.title ?? ""}`.toLowerCase();
  if (/c_suite|owner|founder|partner|chief|cfo|ceo|cto|coo|managing director/.test(s)) return "C-level";
  if (/vp|director|head/.test(s)) return "VP/Director";
  if (/manager/.test(s)) return "Manager";
  return "Individual";
};

export function FindPeople({ account, open, onClose, onAdd }: { account: Account; open: boolean; onClose: () => void; onAdd: (c: Contact[]) => void }) {
  const [titles, setTitles] = useState(TITLES[account.target_arena].join(", "));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [people, setPeople] = useState<ApolloPerson[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const have = new Set(account.contacts.map((c) => c.apollo_id).filter(Boolean));

  const run = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await prospect<{ people: ApolloPerson[] }>("apollo.people", {
        organizationId: account.apollo_org_id,
        domain: account.apollo_org_id ? undefined : account.domain,
        titles: titles.split(",").map((t) => t.trim()).filter(Boolean),
      });
      setPeople(r.people);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  const add = () => {
    const sel = (people ?? []).filter((p) => picked.has(p.id));
    onAdd(
      sel.map((p) => {
        const sen = seniorityOf(p);
        return {
          id: uid("ct"),
          name: p.name || [p.first_name, p.last_name || p.last_name_obfuscated].filter(Boolean).join(" ") || "Unknown",
          role: p.title || "—",
          department: "",
          seniority: sen,
          influence: sen === "C-level" ? "decision_maker" : sen === "VP/Director" ? "influencer" : "influencer",
          relationship: "none",
          lawful_basis: "legitimate_interest",
          verified: p.email_status === "verified",
          source_type: "licensed_feed",
          linkedin_url: p.linkedin_url,
          apollo_id: p.id,
        };
      }),
    );
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Decision-makers at ${account.name}`}>
      <div className="space-y-3">
        {!account.apollo_org_id && !account.domain && <p className="rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn">Add the company domain to search people.</p>}
        <Field label="Titles" hint="Comma-separated"><Input value={titles} onChange={(e) => setTitles(e.target.value)} /></Field>
        <Button variant="primary" onClick={run} disabled={busy || (!account.apollo_org_id && !account.domain)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserSearch className="h-4 w-4" />} Search Apollo</Button>
        {err && <p className="rounded-lg bg-bad-50 px-3 py-2 text-xs text-bad">{err}</p>}
        {people && (
          <>
            <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {people.map((p) => (
                <li key={p.id} className="flex items-start gap-3 px-3 py-2">
                  <input type="checkbox" disabled={have.has(p.id)} checked={picked.has(p.id)} onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(p.id); else n.delete(p.id); setPicked(n); }} className="mt-1 accent-[#8b18e8]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">{p.name || [p.first_name, p.last_name || p.last_name_obfuscated].filter(Boolean).join(" ")} {have.has(p.id) && <Badge>added</Badge>}</div>
                    <div className="truncate text-xs text-muted">{p.title} {p.email_status && <>· email {p.email_status}</>}</div>
                  </div>
                </li>
              ))}
              {!people.length && <li className="p-4 text-center text-sm text-muted">No people found for these titles.</li>}
            </ul>
            <div className="flex justify-end"><Button variant="primary" disabled={!picked.size} onClick={add}>Add {picked.size || ""} to buying group</Button></div>
          </>
        )}
        <p className="text-[11px] text-subtle">People search doesn&apos;t reveal emails. Use &ldquo;Reveal&rdquo; on a contact to spend Apollo or Lusha credits. Lawful basis defaults to legitimate interest — review before outreach.</p>
      </div>
    </Modal>
  );
}

export function ContactReveal({ account, contact, onUpdate }: { account: Account; contact: Contact; onUpdate: (c: Contact) => void }) {
  const { status, notify } = useIntel();
  const [busy, setBusy] = useState<string | null>(null);
  const apollo = async () => {
    if (!contact.apollo_id) return;
    setBusy("apollo");
    try {
      const { person } = await prospect<{ person: { email?: string; email_status?: string; linkedin_url?: string } | null }>("apollo.reveal", { id: contact.apollo_id });
      if (person?.email) onUpdate({ ...contact, email: person.email, verified: person.email_status === "verified" || contact.verified, linkedin_url: person.linkedin_url || contact.linkedin_url });
      else notify("Apollo returned no email for this person.");
    } catch (e) {
      notify((e as Error).message);
    }
    setBusy(null);
  };
  const lusha = async () => {
    const [firstName, ...rest] = contact.name.split(" ");
    if (!account.domain || !rest.length) return notify("Lusha needs a full name and company domain.");
    setBusy("lusha");
    try {
      const { person } = await prospect<{ person: { emailAddresses?: { email: string }[]; phoneNumbers?: { number: string }[] } }>("lusha.person", { firstName, lastName: rest.join(" "), companyDomain: account.domain });
      const email = person?.emailAddresses?.[0]?.email;
      const phone = person?.phoneNumbers?.[0]?.number;
      if (email || phone) onUpdate({ ...contact, email: email || contact.email, phone: phone || contact.phone, verified: true });
      else notify("Lusha found no contact details.");
    } catch (e) {
      notify((e as Error).message);
    }
    setBusy(null);
  };
  if (contact.email) return <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"><Mail className="h-3 w-3" /> {contact.email}</a>;
  return (
    <div className="flex flex-wrap gap-1">
      {contact.apollo_id && status?.apollo && <Button size="sm" variant="ghost" onClick={apollo} disabled={!!busy} title="Uses Apollo credits">{busy === "apollo" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Reveal (Apollo)</Button>}
      {status?.lusha && <Button size="sm" variant="ghost" onClick={lusha} disabled={!!busy} title="Uses Lusha credits">{busy === "lusha" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Enrich (Lusha)</Button>}
    </div>
  );
}

export const ARENA_HELP = ARENA_LABEL;
