import "server-only";
import type { Competitor, PricingObservation, Signal, Account, Arena, CountryCode, SignalType, Urgency } from "@/lib/types";
import { diffLines, fetchText, googleNews, htmlToText, pool, readRss, sha } from "./feeds";
import { completeJson, complete } from "./llm";
import { config } from "./config";
import * as db from "./db";
import { jobPostings } from "./apollo";

// Live-data jobs. Each writes append-only records (signals, pricing observations, settings)
// with provenance so the UI picks them up on the next load.

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const DAY = 864e5;

function signal(p: Partial<Signal> & Pick<Signal, "id" | "type" | "title" | "entity_id" | "entity_kind">): Signal {
  return {
    summary: "",
    urgency: "medium",
    impact: 3,
    owner: "Intelligence analyst",
    due_date: inDays(7),
    status: "new",
    recommended_action: "Review and decide whether action is needed.",
    provenance: { source_type: "company_website", observed_at: today(), confidence: "medium", verification_status: "unverified", analyst: "system:monitor" },
    ...p,
  };
}

async function competitorsFromDb() {
  const { collections } = await db.loadAll();
  return collections.competitors as Competitor[];
}

// ───────────── 1. Website & pricing-page change monitoring ─────────────
export async function monitorWebsites() {
  const comps = (await competitorsFromDb()).filter((c) => c.website && c.tier !== "substitute");
  const targets = comps.flatMap((c) => [c.website, ...(c.monitor_urls ?? [])].map((url) => ({ c, url })));
  let checked = 0,
    changed = 0,
    baselined = 0,
    failed = 0;
  const signals: Signal[] = [];
  const prices: PricingObservation[] = [];
  let llmBudget = 8;

  await pool(targets, 6, async ({ c, url }) => {
    try {
      const text = htmlToText(await fetchText(url));
      if (text.length < 200) return; // JS-rendered shell; nothing meaningful to compare
      checked++;
      const hash = sha(text);
      const prev = await db.getSnapshot(url);
      const isPricing = /pric/i.test(url);
      if (!prev) {
        baselined++;
        await db.putSnapshot(url, hash, text);
        if (isPricing && llmBudget-- > 0) prices.push(...(await extractPrices(c, url, text)));
        return;
      }
      if (prev.hash === hash) return;
      const { added, removed } = diffLines(prev.content ?? "", text);
      await db.putSnapshot(url, hash, text);
      if (added.length + removed.length < 3) return;
      changed++;
      let summary = `${added.length} lines added, ${removed.length} removed. New: ${added.slice(0, 4).join(" | ").slice(0, 400)}`;
      let action = isPricing ? "Re-check published pricing and update the scope-normalised comparison." : "Review the change; update positioning or battlecard if the offer changed.";
      let urgency: Urgency = isPricing ? "high" : "medium";
      if (llmBudget-- > 0) {
        const ai = await completeJson<{ material: boolean; summary: string; action: string; urgency: Urgency }>(
          "You monitor competitor websites for Hexamatics (EOR, finance/tech outsourcing, advisory in Asia-Pacific). Decide if a page change is commercially material.",
          `Competitor: ${c.name}\nPage: ${url}\nREMOVED:\n${removed.slice(0, 40).join("\n")}\nADDED:\n${added.slice(0, 40).join("\n")}\n\nReturn {"material": bool, "summary": "<=40 words: what changed", "action": "<=25 words for Hexa", "urgency": "critical|high|medium|low"}`,
        );
        if (ai) {
          if (!ai.material) return;
          summary = ai.summary;
          action = ai.action;
          urgency = ai.urgency;
        }
        if (isPricing) prices.push(...(await extractPrices(c, url, text)));
      }
      signals.push(
        signal({
          id: `web-${sha(url + hash).slice(0, 16)}`,
          type: isPricing ? "pricing_change" : "web_change",
          title: `${c.name}: ${isPricing ? "pricing page" : "website"} changed`,
          summary,
          entity_id: c.id,
          entity_kind: "competitor",
          urgency,
          impact: isPricing ? 4 : 3,
          owner: isPricing ? "Finance" : "Intelligence analyst",
          recommended_action: action,
          provenance: { source_url: url, source_type: isPricing ? "pricing_page" : "company_website", observed_at: today(), confidence: "high", verification_status: "pending", analyst: "system:monitor" },
        }),
      );
    } catch {
      failed++;
    }
  });
  const newSignals = await db.insertIfNew("signals", signals);
  const newPrices = await db.insertIfNew("pricing", prices);
  return { targets: targets.length, checked, baselined, changed, failed, newSignals, newPrices };
}

async function extractPrices(c: Competitor, url: string, text: string): Promise<PricingObservation[]> {
  const res = await completeJson<{ plans: { plan: string; price: number; currency: string; unit: string; arena: Arena; includes: string[] }[] }>(
    "Extract publicly advertised prices from a pricing page. Only include prices explicitly shown as numbers. Never infer.",
    `Company: ${c.name}\nURL: ${url}\nPAGE TEXT:\n${text.slice(0, 12000)}\n\nReturn {"plans":[{"plan":"","price":0,"currency":"USD","unit":"per employee / month","arena":"eor_payroll|finance_outsourcing|tech_outsourcing|advisory","includes":["short scope items"]}]} — empty array if none.`,
    { maxTokens: 2000 },
  );
  return (res?.plans ?? [])
    .filter((p) => p.price > 0 && p.currency)
    .slice(0, 8)
    .map((p) => ({
      id: `p-auto-${c.id}-${sha(`${url}|${p.plan}|${p.price}|${p.currency}`).slice(0, 12)}`,
      entity_id: c.id,
      arena: p.arena || c.arenas[0],
      country: (c.countries[0] ?? "US") as CountryCode,
      service: `${p.plan}`.slice(0, 80),
      price_type: "published" as const,
      observed_value: p.price,
      unit: p.unit || "per month",
      currency: p.currency.toUpperCase(),
      scope: (p.includes ?? []).slice(0, 10),
      notes: "Extracted automatically from the live pricing page. Confirm country scope before use.",
      provenance: { source_url: url, source_type: "pricing_page" as const, observed_at: today(), confidence: "medium" as const, verification_status: "pending" as const, analyst: "system:price-extractor" },
    }));
}

// ───────────── 2. News & regulatory feeds ─────────────
const REG_QUERIES: { q: string; country: CountryCode; arena: Arena }[] = [
  { q: "Malaysia Employment Act amendment OR EPF contribution OR SOCSO change", country: "MY", arena: "eor_payroll" },
  { q: "Singapore CPF contribution change OR Ministry of Manpower employment pass", country: "SG", arena: "eor_payroll" },
  { q: "Fair Work Commission Australia award OR superannuation guarantee change", country: "AU", arena: "eor_payroll" },
  { q: "Australia accountant shortage OR offshore accounting firms", country: "AU", arena: "finance_outsourcing" },
  { q: "Nepal labour act OR Nepal IT outsourcing OR Nepal minimum wage", country: "NP", arena: "tech_outsourcing" },
  { q: "Indonesia omnibus law employment OR BPJS Ketenagakerjaan change", country: "ID", arena: "eor_payroll" },
  { q: "employer of record Asia Pacific", country: "SG", arena: "eor_payroll" },
];

export async function newsFeeds() {
  const comps = (await competitorsFromDb()).filter((c) => c.tier !== "substitute");
  const queries = [
    ...comps.map((c) => ({ q: c.news_query || `"${c.name}"`, entity_id: c.id, kind: "competitor" as const, name: c.name, country: undefined as CountryCode | undefined, arena: c.arenas[0] })),
    ...REG_QUERIES.map((r) => ({ q: r.q, entity_id: `${r.country.toLowerCase()}-${r.arena}`, kind: "market" as const, name: `${r.country} ${r.arena}`, country: r.country, arena: r.arena })),
  ];
  const cutoff = Date.now() - 10 * DAY;
  const fresh: { item: { title: string; link: string; pubDate?: string; source?: string }; q: (typeof queries)[number] }[] = [];
  let failed = 0;
  await pool(queries, 6, async (q) => {
    try {
      const items = (await readRss(googleNews(`${q.q} when:14d`)))
        .filter((i) => !i.pubDate || new Date(i.pubDate).getTime() > cutoff)
        .slice(0, 4);
      const keys = await db.markSeen(items.map((i) => `news:${sha(i.link)}`));
      for (const i of items) if (keys.includes(`news:${sha(i.link)}`)) fresh.push({ item: i, q });
    } catch {
      failed++;
    }
  });

  let triage: { i: number; relevant: boolean; urgency: Urgency; impact: number; type: SignalType; summary: string; action: string; owner: string }[] | null = null;
  if (fresh.length && config.anthropic()) {
    triage = await completeJson(
      "You triage news for Hexamatics' strategic intelligence team (EOR/payroll, finance & tech outsourcing, advisory; markets AU, MY, SG, NP, ID). Drop items that are not about the named company/topic (name collisions) or have no commercial relevance.",
      `Items:\n${fresh.map((f, i) => `${i}. [${f.q.kind}: ${f.q.name}] ${f.item.title} (${f.item.source ?? ""}, ${f.item.pubDate ?? ""})`).join("\n")}\n\nReturn [{"i":0,"relevant":true,"urgency":"critical|high|medium|low","impact":1-5,"type":"funding|leadership_hire|expansion|launch|pricing_change|regulatory|partnership|contract|layoffs|news","summary":"<=30 words","action":"<=20 words for Hexa","owner":"Strategy|Intelligence analyst|BizDev|Finance"}] for every item.`,
      { maxTokens: 6000 },
    );
  }
  const signals: Signal[] = fresh.flatMap((f, i) => {
    const t = triage?.find((x) => x.i === i);
    if (triage && (!t || !t.relevant)) return [];
    return [
      signal({
        id: `news-${sha(f.item.link).slice(0, 16)}`,
        type: t?.type ?? (f.q.kind === "market" ? "regulatory" : "news"),
        title: f.item.title.slice(0, 180),
        summary: t?.summary ?? `${f.item.source ?? "News"} — ${f.item.pubDate ?? ""}`,
        entity_id: f.q.entity_id,
        entity_kind: f.q.kind,
        country: f.q.country,
        arena: f.q.arena,
        urgency: t?.urgency ?? "low",
        impact: t?.impact ?? 2,
        owner: t?.owner ?? (f.q.kind === "market" ? "Strategy" : "Intelligence analyst"),
        due_date: inDays(t?.urgency === "critical" ? 2 : t?.urgency === "high" ? 5 : 10),
        recommended_action: t?.action ?? "Read and assess relevance.",
        provenance: { source_url: f.item.link, source_type: f.q.kind === "market" ? "regulator" : "press_release", observed_at: today(), effective_date: f.item.pubDate ? new Date(f.item.pubDate).toISOString().slice(0, 10) : undefined, confidence: "medium", verification_status: "unverified", analyst: triage ? "system:news+claude" : "system:news" },
      }),
    ];
  });
  const inserted = await db.insertIfNew("signals", signals);
  return { queries: queries.length, fresh: fresh.length, kept: signals.length, inserted, failed, triaged: !!triage };
}

// ───────────── 3. FX rates ─────────────
export async function fxRates() {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`FX ${res.status}`);
  const j = (await res.json()) as { result: string; rates: Record<string, number>; time_last_update_utc: string };
  if (j.result !== "success") throw new Error("FX feed error");
  const want = ["USD", "AUD", "SGD", "MYR", "NPR", "IDR", "GBP", "BDT", "EUR", "INR", "PHP"];
  const toUsd = Object.fromEntries(want.filter((c) => j.rates[c]).map((c) => [c, +(1 / j.rates[c]).toPrecision(6)]));
  await db.setSetting("fx", { ...toUsd, _asOf: j.time_last_update_utc, _source: "open.er-api.com" }, "system:fx");
  return { currencies: Object.keys(toUsd).length, asOf: j.time_last_update_utc };
}

// ───────────── 4. Account hiring signals (Apollo) ─────────────
const ROLE_RX = /(account|finance|bookkeep|payroll|audit|tax|controller|ap\/ar|accounts payable|accounts receivable|developer|engineer|software)/i;

export async function accountSignals() {
  if (!config.apollo()) return { skipped: "APOLLO_API_KEY not set" };
  const { collections } = await db.loadAll();
  const accounts = (collections.accounts as Account[]).filter((a) => a.apollo_org_id && a.status !== "disqualified");
  const signals: Signal[] = [];
  const updates: Account[] = [];
  let failed = 0;
  await pool(accounts.slice(0, 40), 4, async (a) => {
    try {
      const posts = (await jobPostings(a.apollo_org_id!)).filter((p) => ROLE_RX.test(p.title));
      updates.push({ ...a, open_roles: posts.slice(0, 15).map((p) => ({ title: p.title, url: p.url, posted_at: p.posted_at })), enriched_at: today() });
      if (posts.length >= 2) {
        const week = Math.floor(Date.now() / (7 * DAY));
        signals.push(
          signal({
            id: `hire-${a.id}-${week}`,
            type: "hiring_spike",
            title: `${a.name}: ${posts.length} open finance/tech roles`,
            summary: posts.slice(0, 5).map((p) => p.title).join(" · "),
            entity_id: a.id,
            entity_kind: "account",
            country: a.country,
            arena: a.target_arena,
            urgency: posts.length >= 4 ? "high" : "medium",
            impact: Math.min(5, 2 + Math.floor(posts.length / 2)),
            owner: "BizDev",
            recommended_action: "Send cost-of-vacancy outreach referencing the open roles; offer a pilot.",
            provenance: { source_url: posts[0]?.url, source_type: "job_posting", observed_at: today(), confidence: "high", verification_status: "verified", analyst: "system:apollo" },
          }),
        );
      }
    } catch {
      failed++;
    }
  });
  if (updates.length) await db.applyChanges("accounts", updates, [], "system:apollo");
  const inserted = await db.insertIfNew("signals", signals);
  return { accounts: accounts.length, refreshed: updates.length, inserted, failed };
}

// ───────────── Runner ─────────────
export const JOBS = { websites: monitorWebsites, news: newsFeeds, fx: fxRates, accounts: accountSignals } as const;
export type JobName = keyof typeof JOBS;

export async function runJob(name: JobName) {
  const id = await db.startJob(name);
  try {
    const detail = await JOBS[name]();
    await db.finishJob(id, true, detail);
    return { job: name, ok: true, detail };
  } catch (e) {
    await db.finishJob(id, false, { error: (e as Error).message });
    return { job: name, ok: false, detail: { error: (e as Error).message } };
  }
}

export async function runAll() {
  // FX first (fast), then the rest in parallel.
  const fx = await runJob("fx");
  const rest = await Promise.all((["websites", "news", "accounts"] as JobName[]).map(runJob));
  return [fx, ...rest];
}

export { complete };
