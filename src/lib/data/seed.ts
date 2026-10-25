import type {
  Account,
  CoverageCell,
  Decision,
  MarketCombo,
  Observation,
  Opportunity,
  PricingObservation,
  Provenance,
  SalaryBenchmark,
  Signal,
  Source,
  Task,
} from "../types";
import { competitors } from "./competitors";

// Starting data for the live platform (researched 25 Oct 2026).
// - Facts carry a source URL and "pending" verification until an analyst confirms them.
// - Market scores (1–5) are analyst judgements with the evidence noted; review them with the team.
// - Accounts, pipeline and Hexa prices start EMPTY: they come from Apollo/Lusha, the BD team and
//   finance — never from placeholders. Signals are produced by the live monitors.

const D = "2026-10-25";
const prov = (url: string | undefined, extra: Partial<Provenance> = {}): Provenance => ({
  source_url: url,
  source_type: "analyst_estimate",
  observed_at: D,
  confidence: "medium",
  verification_status: "pending",
  analyst: "Analyst assessment v1 (public sources)",
  ...extra,
});
const judgement = (url?: string) => prov(url, { confidence: "low", verification_status: "unverified" });

// ───────────────────────── Markets ─────────────────────────
type MC = Omit<MarketCombo, "id" | "provenance"> & { provenance?: Provenance };
const mc = (m: MC): MarketCombo => ({
  id: `${m.country}-${m.arena}-${m.segment}`.toLowerCase().replace(/\s+/g, "-"),
  provenance: judgement(),
  ...m,
});

const CAANZ_2026 = "https://www.charteredaccountantsanz.com/news-and-analysis/advocacy/policy-submissions/submission-on-2026-occupation-shortage-list-stakeholder-survey";
const CAANZ_2025 = "https://www.charteredaccountantsanz.com/news-and-analysis/news/targeted-measures-needed-to-tackle-persistent-accountant-shortages";
const RH_AU = "https://www.roberthalf.com/au/en/job-details/senior-accountant";
const REMOTE_CUT = "https://pricingsaas.com/companies/remote/diffs/2026W43";

export const markets: MarketCombo[] = [
  mc({ country: "AU", arena: "finance_outsourcing", segment: "Accounting firms", demand: 5, margin: 4, accessibility: 4, intensity: 4, readiness: 4, regulatory_risk: "low", notes: "Blueprint Priority 1. CA ANZ 2026 survey: fill rates only 40–55% for general, tax and audit accountants (<67% signals shortage). Robert Half 2026: senior accountant median A$120k nationally, A$130.8k Sydney. Crowded with TOA Global, Emapta.", provenance: judgement(CAANZ_2026) }),
  mc({ country: "AU", arena: "finance_outsourcing", segment: "SME", demand: 4, margin: 4, accessibility: 3, intensity: 3, readiness: 4, regulatory_risk: "low", notes: "Same accountant shortage; SMEs fragmented — reach via accounting-firm partners. Tax accountants added to the 2025 Occupation Shortage List (CA ANZ).", provenance: judgement(CAANZ_2025) }),
  mc({ country: "AU", arena: "finance_outsourcing", segment: "Mid-market", demand: 4, margin: 4, accessibility: 3, intensity: 4, readiness: 3, regulatory_risk: "low", notes: "Finance managers fill at 85% and management accountants 75% (CA ANZ 2026) — less acute than practice roles; CFO/ERP triggers matter more.", provenance: judgement(CAANZ_2026) }),
  mc({ country: "AU", arena: "tech_outsourcing", segment: "Scale-ups", demand: 4, margin: 3, accessibility: 3, intensity: 4, readiness: 3, regulatory_risk: "low", notes: "Engineering demand strong but vendor field crowded; pursue only with verified skills (blueprint Priority 3)." }),
  mc({ country: "MY", arena: "eor_payroll", segment: "SME", demand: 4, margin: 3, accessibility: 4, intensity: 4, readiness: 5, regulatory_risk: "medium", notes: "Home market. Global EOR list prices converged at ~US$599 (Deel; Remote cut from $699 in Oct 2026) and Multiplier ~US$400 — undifferentiated EOR faces fee compression; compete on local compliance + bundle.", provenance: judgement(REMOTE_CUT) }),
  mc({ country: "MY", arena: "eor_payroll", segment: "Mid-market", demand: 4, margin: 3, accessibility: 4, intensity: 4, readiness: 5, regulatory_risk: "medium", notes: "Regional HQs consolidating payroll; regional specialists (BIPO, Links, BoardRoom) compete on service depth." }),
  mc({ country: "MY", arena: "finance_outsourcing", segment: "Mid-market", demand: 3, margin: 3, accessibility: 4, intensity: 3, readiness: 4, regulatory_risk: "low", notes: "Shared-service demand; local listed BPOs (Scicom ~RM211m revenue, Daythree ~RM90m) are CX-weighted.", provenance: judgement("https://simplywall.st/stock/klse/scicom") }),
  mc({ country: "MY", arena: "advisory", segment: "SME", demand: 3, margin: 5, accessibility: 4, intensity: 2, readiness: 5, regulatory_risk: "medium", notes: "Market entry, structuring and restructuring advisory; high margin, low volume." }),
  mc({ country: "SG", arena: "tech_outsourcing", segment: "Scale-ups", demand: 4, margin: 4, accessibility: 3, intensity: 4, readiness: 3, regulatory_risk: "low", notes: "SG software engineer median base ~S$70k (Payscale) to S$100k+ for mid-level — strong offshore economics; validate verified skills first.", provenance: judgement("https://www.payscale.com/research/SG/Job=Software_Engineer/Salary") }),
  mc({ country: "SG", arena: "finance_outsourcing", segment: "Mid-market", demand: 4, margin: 4, accessibility: 3, intensity: 4, readiness: 4, regulatory_risk: "low", notes: "High local wages support offshore finance; CPF employer contribution 17% adds to in-house cost." }),
  mc({ country: "SG", arena: "eor_payroll", segment: "Scale-ups", demand: 4, margin: 3, accessibility: 3, intensity: 5, readiness: 4, regulatory_risk: "low", notes: "Densest global-EOR competition (Deel, Remote, Multiplier HQ, Oyster, Rippling)." }),
  mc({ country: "SG", arena: "advisory", segment: "Mid-market", demand: 3, margin: 5, accessibility: 3, intensity: 3, readiness: 4, regulatory_risk: "low", notes: "Regional structuring and automation advisory." }),
  mc({ country: "ID", arena: "eor_payroll", segment: "Mid-market", demand: 4, margin: 3, accessibility: 3, intensity: 3, readiness: 4, regulatory_risk: "high", notes: "Regulatory complexity (omnibus law, BPJS) favours local expertise; Hexa has an Indonesian entity." }),
  mc({ country: "UK", arena: "finance_outsourcing", segment: "Accounting firms", demand: 4, margin: 4, accessibility: 2, intensity: 4, readiness: 3, regulatory_risk: "low", notes: "Large market; time-zone and brand-awareness hurdles; QX Global and TOA Global present." }),
  mc({ country: "US", arena: "finance_outsourcing", segment: "Accounting firms", demand: 5, margin: 4, accessibility: 2, intensity: 5, readiness: 2, regulatory_risk: "low", notes: "Very large but crowded (Entigrity, TOA Global US); needs US-hours delivery." }),
  mc({ country: "NP", arena: "advisory", segment: "SME", demand: 2, margin: 3, accessibility: 5, intensity: 2, readiness: 5, regulatory_risk: "medium", notes: "Inbound investors setting up in Nepal." }),
];

// ───────────────────── Coverage matrix ─────────────────────
export const coverage: CoverageCell[] = competitors.flatMap((c) =>
  c.arenas.flatMap((a) =>
    c.countries.map((country) => ({
      competitor_id: c.id,
      arena: a,
      country,
      intensity: Math.min(3, Math.max(1, Math.round(c.threat_inputs.market_presence * 0.6))) as 1 | 2 | 3,
    })),
  ),
);

// ───────────────────────── Pricing ─────────────────────────
// Published / reported competitor prices only. Hexa's own prices are entered by Finance.
const EOR_SCOPE = ["employment contract", "payroll", "statutory filings", "platform"];
export const pricing: PricingObservation[] = [
  { id: "p-deel-eor", entity_id: "deel", arena: "eor_payroll", country: "MY", service: "Employer of Record (from)", price_type: "published", observed_value: 599, unit: "per employee / month", currency: "USD", scope: [...EOR_SCOPE, "benefits admin"], notes: "Published 'from' rate. Third-party reports: $400–500 negotiated at 20+ headcount. Excludes salary and employer statutory costs.", provenance: prov("https://www.deel.com/pricing", { source_type: "pricing_page" }) },
  { id: "p-deel-payroll", entity_id: "deel", arena: "eor_payroll", country: "MY", service: "Global payroll (own entity)", price_type: "published", observed_value: 29, unit: "per employee / month", currency: "USD", scope: ["payroll"], notes: "Often with a one-time entity setup fee (reported ~$1,000).", provenance: prov("https://www.deel.com/pricing", { source_type: "pricing_page" }) },
  { id: "p-remote-eor-2026-10", entity_id: "remote", arena: "eor_payroll", country: "MY", service: "Employer of Record", price_type: "published", observed_value: 599, unit: "per employee / month", currency: "USD", scope: [...EOR_SCOPE, "benefits admin", "owned entity"], notes: "Cut from $699 between 12–19 Oct 2026; 15% startup discount for first 12 months (PricingSaaS tracker). Blueprint's $699 is superseded.", provenance: prov(REMOTE_CUT, { source_type: "pricing_page", confidence: "medium" }) },
  { id: "p-remote-payroll", entity_id: "remote", arena: "eor_payroll", country: "MY", service: "Payroll", price_type: "published", observed_value: 29, unit: "per employee / month", currency: "USD", scope: ["payroll"], provenance: prov("https://remote.com/pricing", { source_type: "pricing_page" }) },
  { id: "p-multiplier-eor", entity_id: "multiplier", arena: "eor_payroll", country: "SG", service: "Employer of Record (from)", price_type: "external_estimate", observed_value: 400, unit: "per employee / month", currency: "USD", scope: [...EOR_SCOPE, "no setup / termination / FX fees"], notes: "Reported by several third-party guides; Multiplier states flat monthly fee, no hidden onboarding/termination/FX fees.", provenance: prov("https://www.usemultiplier.com/employer-of-record/employer-of-record-cost", { source_type: "analyst_estimate" }) },
  { id: "p-oyster-eor", entity_id: "oyster", arena: "eor_payroll", country: "SG", service: "Employer of Record (list)", price_type: "external_estimate", observed_value: 699, unit: "per employee / month", currency: "USD", scope: EOR_SCOPE, notes: "List price per third-party reviews; ~$599 on annual/scale plans.", provenance: prov("https://gloroots.com/blog/oysterhr-pricing") },
  { id: "p-rippling-eor", entity_id: "rippling", arena: "eor_payroll", country: "SG", service: "Employer of Record (estimate)", price_type: "external_estimate", observed_value: 499, unit: "per employee / month", currency: "USD", scope: EOR_SCOPE, notes: "Not published; customer reports $499–599. Base HRIS from $8 is not EOR.", provenance: prov("https://www.gloroots.com/blog/rippling-pricing", { confidence: "low" }) },
];

// ─────────────────────── Salary benchmarks ───────────────────────
// Annual = monthly × 13 in Nepal (Dashain festival allowance) and × 12 elsewhere.
export const salaries: SalaryBenchmark[] = [
  { id: "s-au-sa", role: "Senior Accountant", country: "AU", currency: "AUD", annual_low: 110000, annual_mid: 120000, annual_high: 135000, oncost_pct: 0.18, availability: "scarce", provenance: prov(RH_AU, { source_type: "licensed_feed", confidence: "high", verification_status: "pending" }) },
  { id: "s-np-sa", role: "Senior Accountant", country: "NP", currency: "NPR", annual_low: 715000, annual_mid: 975000, annual_high: 1235000, oncost_pct: 0.2, availability: "balanced", provenance: prov("https://mirchawala.com/blogs/?p=53410", { confidence: "low" }) },
  { id: "s-sg-se", role: "Software Engineer", country: "SG", currency: "SGD", annual_low: 55000, annual_mid: 85000, annual_high: 130000, oncost_pct: 0.17, availability: "tight", provenance: prov("https://www.payscale.com/research/SG/Job=Software_Engineer/Salary", { confidence: "medium" }) },
  { id: "s-np-se", role: "Software Engineer", country: "NP", currency: "NPR", annual_low: 650000, annual_mid: 1010000, annual_high: 1560000, oncost_pct: 0.2, availability: "tight", provenance: prov("https://worldsalaries.com/average-software-developer-salary-in-nepal/", { confidence: "low" }) },
  { id: "s-my-pr", role: "Payroll Executive", country: "MY", currency: "MYR", annual_low: 36000, annual_mid: 45000, annual_high: 54000, oncost_pct: 0.15, availability: "balanced", provenance: prov("https://my.jobstreet.com/companies/select-service-partner-168552716421303/salaries/payroll-executive", { confidence: "low" }) },
  { id: "s-np-pr", role: "Payroll Executive", country: "NP", currency: "NPR", annual_low: 325000, annual_mid: 516000, annual_high: 585000, oncost_pct: 0.2, availability: "balanced", provenance: prov("https://worldsalaries.com/average-accounting-associate-salary-in-nepal/", { confidence: "low" }) },
];

/** Fallback FX to USD; the daily FX job replaces these with live rates. */
export const FX_TO_USD: Record<string, number> = {
  USD: 1,
  AUD: 0.65,
  SGD: 0.77,
  MYR: 0.236,
  NPR: 0.0071,
  IDR: 0.000061,
  GBP: 1.33,
  BDT: 0.0082,
};

// ───────────────────── Live collections (start empty) ─────────────────────
export const signals: Signal[] = [];
export const accounts: Account[] = [];
export const opportunities: Opportunity[] = [];

// ───────────────────────── Tasks ─────────────────────────
export const tasks: Task[] = [
  { id: "t-setup-db", title: "Connect Neon Postgres in Vercel (Storage → Neon)", owner: "Engineer", role: "Engineering", status: "todo", due: "2026-10-28", priority: "critical" },
  { id: "t-setup-auth", title: "Create Google OAuth client; set AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET", owner: "Engineer", role: "Engineering", status: "todo", due: "2026-10-28", priority: "critical" },
  { id: "t-setup-keys", title: "Add APOLLO_API_KEY, LUSHA_API_KEY, ANTHROPIC_API_KEY to Vercel", owner: "Engineer", role: "Engineering", status: "todo", due: "2026-10-28", priority: "high" },
  { id: "t1", title: "Finalize the four primary service-market combinations", owner: "Management", role: "Strategy", status: "todo", due: "2026-10-31", priority: "critical" },
  { id: "t3", title: "Review analyst threat scores and market scores with the team", owner: "Analyst", role: "Intelligence", status: "todo", due: "2026-10-31", priority: "high" },
  { id: "t4", title: "Enter Hexa's current price list and recent quotes (Pricing → Add observation)", owner: "Finance", role: "Finance", status: "todo", due: "2026-10-31", priority: "critical" },
  { id: "t5", title: "Verify the five Tier-1 competitor profiles and battlecards", owner: "Analyst", role: "Intelligence", status: "todo", due: "2026-10-31", priority: "high" },
  { id: "t6", title: "Research and validate the Tier-2 competitors", owner: "Analyst", role: "Intelligence", status: "todo", due: "2026-11-08", priority: "high" },
  { id: "t7", title: "Replace salary benchmarks with Hexa's actual Nepal payroll costs", owner: "Finance", role: "Finance", status: "todo", due: "2026-11-08", priority: "high" },
  { id: "t8", title: "Import 20 AU accounting firms via Apollo and verify decision-makers", owner: "BD Lead", role: "BizDev", status: "todo", due: "2026-11-08", priority: "high" },
  { id: "t11", title: "Produce first Monday intelligence brief from live signals", owner: "Analyst", role: "Intelligence", status: "todo", due: "2026-11-02", priority: "medium" },
  { id: "t12", title: "Log every active deal and its outcome in Sales (win/loss reason mandatory)", owner: "BD Lead", role: "BizDev", status: "todo", due: "2026-11-08", priority: "high" },
];

export const decisions: Decision[] = [
  { id: "d1", date: "2026-10-24", title: "Lead with AU finance outsourcing for accounting firms", context: "Blueprint Priority 1; CA ANZ 2026 survey shows 40–55% fill rates for practice accountants.", decision: "Concentrate first 30 days of research and outbound on AU accounting firms.", owner: "Management", evidence: ["blueprint §13", CAANZ_2026], review_on: "2026-11-21" },
  { id: "d2", date: "2026-10-24", title: "Rate competitors by service × country × segment", context: "Single overall rank hides where rivals are actually strong.", decision: "No single global competitor rank. Threat scored per arena and published with evidence coverage.", owner: "Strategy", evidence: ["blueprint §2 design principle"], review_on: "2026-12-19" },
];

// ───────────────────────── Sources ─────────────────────────
export const sources: Source[] = [
  { id: "src-hnpl", name: "Hexamatics Nepal website", url: "https://www.hnpl.business", type: "company_website", licence: "public", refresh: "monthly", owner: "Analyst", last_checked: D, reliability: "high" },
  ...competitors
    .filter((c) => c.website)
    .map<Source>((c) => ({ id: `src-${c.id}`, name: `${c.name} website (monitored daily)`, url: c.website, type: "company_website", licence: "public", refresh: "daily", owner: "system:monitor", last_checked: D, reliability: "medium" })),
  { id: "src-gnews", name: "Google News RSS (competitor & regulatory queries)", url: "https://news.google.com/", type: "press_release", licence: "public", refresh: "daily", owner: "system:news", last_checked: D, reliability: "medium" },
  { id: "src-fx", name: "Open Exchange Rates API (FX)", url: "https://open.er-api.com/", type: "licensed_feed", licence: "public", refresh: "daily", owner: "system:fx", last_checked: D, reliability: "high" },
  { id: "src-apollo", name: "Apollo.io API (accounts, contacts, job postings)", url: "https://www.apollo.io/", type: "licensed_feed", licence: "licensed", refresh: "daily", owner: "BD Lead", last_checked: D, reliability: "high" },
  { id: "src-lusha", name: "Lusha API (company & contact enrichment)", url: "https://www.lusha.com/", type: "licensed_feed", licence: "licensed", refresh: "ad-hoc", owner: "BD Lead", last_checked: D, reliability: "high" },
  { id: "src-caanz", name: "CA ANZ — 2026 Occupation Shortage List submission", url: CAANZ_2026, type: "regulator", licence: "public", refresh: "ad-hoc", owner: "Analyst", last_checked: D, reliability: "high" },
  { id: "src-rh", name: "Robert Half Australia — 2026 salary data", url: RH_AU, type: "licensed_feed", licence: "public", refresh: "ad-hoc", owner: "Finance", last_checked: D, reliability: "high" },
  { id: "src-pricingsaas", name: "PricingSaaS — Remote pricing change tracker", url: REMOTE_CUT, type: "pricing_page", licence: "public", refresh: "weekly", owner: "Finance", last_checked: D, reliability: "medium" },
  { id: "src-crm", name: "In-app pipeline (Sales)", url: "", type: "crm", licence: "internal", refresh: "daily", owner: "BD Lead", last_checked: D, reliability: "high" },
];

// ─────────────────────── Observations ───────────────────────
const o = (id: string, entity_id: string, field: string, observed_value: string, url: string, extra: Partial<Observation> = {}): Observation => ({
  id,
  entity_id,
  field,
  observed_value,
  source_url: url,
  source_type: "company_website",
  observed_at: D,
  confidence: "medium",
  verification_status: "pending",
  analyst: "Analyst (public sources)",
  ...extra,
});

export const observations: Observation[] = [
  o("o1", "hexa", "certification", "ISO 27001", "https://www.hnpl.business"),
  o("o2", "hexa", "certification", "ISO 9001", "https://www.hnpl.business"),
  o("o3", "hexa", "accreditation", "ACCA Approved Employer", "https://www.hnpl.business"),
  o("o4", "deel", "published_price", "599", "https://www.deel.com/pricing", { service_line: "eor_payroll", unit: "per employee / month", currency: "USD", source_type: "pricing_page" }),
  o("o5", "remote", "published_price", "599 (cut from 699, Oct 2026)", REMOTE_CUT, { service_line: "eor_payroll", unit: "per employee / month", currency: "USD", source_type: "pricing_page", effective_date: "2026-10-19" }),
  o("o6", "remote", "arr", "> US$300m; cash-flow positive", "https://dealroom.co/companies/remote-1/", { effective_date: "2026-05-01" }),
  o("o7", "remote", "owned_entities", "100+", "https://dealroom.co/companies/remote-1/"),
  o("o8", "deel", "revenue_run_rate", "US$1bn", "https://www.enterprisetimes.co.uk/tag/valuation/", { effective_date: "2025-06-04" }),
  o("o9", "emapta", "pricing_model", "Salary pass-through at cost (90% of salaries US$750–1,500/month) + per-seat service fee + one-time setup/recruitment fee", "https://emapta.com/pricing/", { service_line: "finance_outsourcing" }),
  o("o10", "emapta", "headcount", "7,200+ across 18 offices in 6 countries (company)", "https://emapta.com/"),
  o("o11", "toa-global", "headcount", "3,000+ team members; 800+ accounting firm clients", "https://ph.indeed.com/cmp/Toa-Global", { service_line: "finance_outsourcing" }),
  o("o12", "daythree", "revenue", "RM89.8m (FY Dec 2025, aggregator)", "https://simplywall.st/stock/klse/day3", { currency: "MYR" }),
  o("o13", "scicom", "revenue", "RM210.8m (TTM Sep 2025, aggregator); ~1,138 staff", "https://simplywall.st/stock/klse/scicom", { currency: "MYR" }),
  o("o14", "multiplier", "published_price", "~400 EOR from", "https://www.usemultiplier.com/employer-of-record/employer-of-record-cost", { service_line: "eor_payroll", unit: "per employee / month", currency: "USD", confidence: "low" }),
  o("o15", "market", "au_accountant_fill_rate", "40–55% for general, tax, internal & external auditors", CAANZ_2026, { market: "AU", service_line: "finance_outsourcing", source_type: "regulator", confidence: "high" }),
  o("o16", "market", "au_senior_accountant_salary", "A$110k–135k (median A$120k); Sydney median A$130.8k", RH_AU, { market: "AU", service_line: "finance_outsourcing", currency: "AUD", source_type: "licensed_feed", confidence: "high" }),
];

export const HEXA = {
  name: "Hexamatics Nepal (HNPL)",
  website: "https://www.hnpl.business",
  models: [
    { title: "In your market", subtitle: "EOR & business operations", services: "Employment, payroll, compliance, legal, secretarial, logistics, workspace" },
    { title: "In our centres", subtitle: "Dedicated professional capability", services: "Finance, technology and people operations, with training, management and productivity improvement" },
    { title: "Before you commit", subtitle: "Advisory", services: "Market entry, operating structures, regulatory restructuring, automation advisory" },
  ],
  differentiators: ["ISO 27001", "ISO 9001", "ACCA Approved Employer", "Operating history", "In-house technology"],
  products: ["APEX", "HexaInsights", "HexaComply", "Hexa SmartLedger", "HexaCoPilot"],
};
