import type {
  Account,
  Arena,
  CountryCode,
  CoverageCell,
  Decision,
  FunnelStage,
  LossReason,
  MarketCombo,
  Observation,
  Opportunity,
  PricingObservation,
  Provenance,
  SalaryBenchmark,
  Segment,
  Signal,
  Source,
  Task,
} from "../types";
import { competitors } from "./competitors";

// ILLUSTRATIVE SEED DATA.
// Scores, salaries, accounts and pipeline below are placeholders so the engines can be
// exercised end to end. They are NOT research findings. Replace with verified and internal data.

const D = "2026-10-24";
const est = (extra: Partial<Provenance> = {}): Provenance => ({
  source_type: "analyst_estimate",
  observed_at: D,
  confidence: "low",
  verification_status: "unverified",
  analyst: "Intelligence analyst",
  ...extra,
});

// ───────────────────────── Markets ─────────────────────────
type MC = Omit<MarketCombo, "id" | "provenance"> & { provenance?: Provenance };
const mc = (m: MC): MarketCombo => ({
  id: `${m.country}-${m.arena}-${m.segment}`.toLowerCase().replace(/\s+/g, "-"),
  provenance: est(),
  ...m,
});

export const markets: MarketCombo[] = [
  mc({ country: "AU", arena: "finance_outsourcing", segment: "Accounting firms", demand: 5, margin: 4, accessibility: 4, intensity: 4, readiness: 4, addressable_usd_m: 420, growth_pct: 11, regulatory_risk: "low", notes: "Priority 1. Persistent accountant shortages; offshore model normalised among firms.", win_rate: 0.28, contribution_margin: 0.38 }),
  mc({ country: "AU", arena: "finance_outsourcing", segment: "SME", demand: 4, margin: 4, accessibility: 3, intensity: 3, readiness: 4, addressable_usd_m: 260, growth_pct: 9, regulatory_risk: "low", notes: "Fragmented buyers; reach via partners and accounting firms.", win_rate: 0.22, contribution_margin: 0.36 }),
  mc({ country: "AU", arena: "finance_outsourcing", segment: "Mid-market", demand: 4, margin: 4, accessibility: 3, intensity: 4, readiness: 3, addressable_usd_m: 310, growth_pct: 8, regulatory_risk: "low", notes: "CFO-led finance transformation; ERP migration triggers.", win_rate: 0.2, contribution_margin: 0.34 }),
  mc({ country: "AU", arena: "tech_outsourcing", segment: "Scale-ups", demand: 4, margin: 3, accessibility: 3, intensity: 4, readiness: 3, addressable_usd_m: 380, growth_pct: 10, regulatory_risk: "low", notes: "Engineering demand strong; crowded vendor field." }),
  mc({ country: "MY", arena: "eor_payroll", segment: "SME", demand: 4, margin: 3, accessibility: 4, intensity: 4, readiness: 5, addressable_usd_m: 90, growth_pct: 12, regulatory_risk: "medium", notes: "Priority 2. Home-market strength; compliance changes drive demand.", win_rate: 0.33, contribution_margin: 0.29 }),
  mc({ country: "MY", arena: "eor_payroll", segment: "Mid-market", demand: 4, margin: 3, accessibility: 4, intensity: 4, readiness: 5, addressable_usd_m: 120, growth_pct: 10, regulatory_risk: "medium", notes: "Regional HQs consolidating payroll across APAC.", win_rate: 0.3, contribution_margin: 0.27 }),
  mc({ country: "MY", arena: "finance_outsourcing", segment: "Mid-market", demand: 3, margin: 3, accessibility: 4, intensity: 3, readiness: 4, addressable_usd_m: 80, growth_pct: 7, regulatory_risk: "low", notes: "Shared-service demand; price-sensitive." }),
  mc({ country: "MY", arena: "advisory", segment: "SME", demand: 3, margin: 5, accessibility: 4, intensity: 2, readiness: 5, addressable_usd_m: 25, growth_pct: 6, regulatory_risk: "medium", notes: "Market entry & restructuring advisory; high margin, low volume.", win_rate: 0.4, contribution_margin: 0.52 }),
  mc({ country: "SG", arena: "tech_outsourcing", segment: "Scale-ups", demand: 4, margin: 4, accessibility: 3, intensity: 4, readiness: 3, addressable_usd_m: 210, growth_pct: 9, regulatory_risk: "low", notes: "Priority 3. Tech teams scaling; validate verified skills before pursuit." }),
  mc({ country: "SG", arena: "finance_outsourcing", segment: "Mid-market", demand: 4, margin: 4, accessibility: 3, intensity: 4, readiness: 4, addressable_usd_m: 150, growth_pct: 8, regulatory_risk: "low", notes: "High local wages support offshore finance economics.", win_rate: 0.24, contribution_margin: 0.37 }),
  mc({ country: "SG", arena: "eor_payroll", segment: "Scale-ups", demand: 4, margin: 3, accessibility: 3, intensity: 5, readiness: 4, addressable_usd_m: 140, growth_pct: 11, regulatory_risk: "low", notes: "Dense global-EOR competition." }),
  mc({ country: "SG", arena: "advisory", segment: "Mid-market", demand: 3, margin: 5, accessibility: 3, intensity: 3, readiness: 4, addressable_usd_m: 40, growth_pct: 6, regulatory_risk: "low", notes: "Regional structuring and automation advisory." }),
  mc({ country: "ID", arena: "eor_payroll", segment: "Mid-market", demand: 4, margin: 3, accessibility: 3, intensity: 3, readiness: 4, addressable_usd_m: 110, growth_pct: 13, regulatory_risk: "high", notes: "Growing inbound investment; regulatory complexity favours local expertise." }),
  mc({ country: "UK", arena: "finance_outsourcing", segment: "Accounting firms", demand: 4, margin: 4, accessibility: 2, intensity: 4, readiness: 3, addressable_usd_m: 360, growth_pct: 8, regulatory_risk: "low", notes: "Large market; time-zone and brand-awareness hurdles." }),
  mc({ country: "US", arena: "finance_outsourcing", segment: "Accounting firms", demand: 5, margin: 4, accessibility: 2, intensity: 5, readiness: 2, addressable_usd_m: 900, growth_pct: 9, regulatory_risk: "low", notes: "Very large but crowded; requires US-hours delivery." }),
  mc({ country: "NP", arena: "advisory", segment: "SME", demand: 2, margin: 3, accessibility: 5, intensity: 2, readiness: 5, addressable_usd_m: 8, growth_pct: 5, regulatory_risk: "medium", notes: "Inbound investors setting up in Nepal." }),
];

// ───────────────────── Coverage matrix ─────────────────────
// Derived from each competitor's declared arenas × countries (intensity from market presence).
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
export const pricing: PricingObservation[] = [
  {
    id: "p-deel-eor",
    entity_id: "deel",
    arena: "eor_payroll",
    country: "MY",
    service: "Employer of Record",
    price_type: "published",
    observed_value: 599,
    unit: "per employee / month",
    currency: "USD",
    scope: ["employment contract", "payroll", "statutory filings", "platform"],
    notes: "Advertised 'starting at' rate per blueprint. Varies by period, country, discount and scope.",
    provenance: { source_url: "https://www.deel.com/", source_type: "pricing_page", observed_at: D, confidence: "medium", verification_status: "pending", analyst: "Intelligence analyst" },
  },
  {
    id: "p-remote-eor",
    entity_id: "remote",
    arena: "eor_payroll",
    country: "MY",
    service: "Employer of Record (standard)",
    price_type: "published",
    observed_value: 699,
    unit: "per employee / month",
    currency: "USD",
    scope: ["employment contract", "payroll", "statutory filings", "platform", "benefits admin"],
    notes: "Advertised standard EOR rate per blueprint. Verify before commercial use.",
    provenance: { source_url: "https://remote.com/", source_type: "pricing_page", observed_at: D, confidence: "medium", verification_status: "pending", analyst: "Intelligence analyst" },
  },
  {
    id: "p-hexa-eor",
    entity_id: "hexa",
    arena: "eor_payroll",
    country: "MY",
    service: "Managed EOR + payroll + secretarial",
    price_type: "hexa_deal",
    observed_value: 650,
    unit: "per employee / month",
    currency: "USD",
    scope: ["employment contract", "payroll", "statutory filings", "platform", "local HR advisory", "secretarial", "named account manager"],
    notes: "Illustrative placeholder — replace with actual deal data.",
    provenance: est({ source_type: "internal" }),
  },
  {
    id: "p-multiplier-eor",
    entity_id: "multiplier",
    arena: "eor_payroll",
    country: "SG",
    service: "Employer of Record",
    price_type: "external_estimate",
    observed_value: 400,
    unit: "per employee / month",
    currency: "USD",
    scope: ["employment contract", "payroll", "platform"],
    notes: "Placeholder estimate — research required.",
    provenance: est(),
  },
  {
    id: "p-emapta-acct",
    entity_id: "emapta",
    arena: "finance_outsourcing",
    country: "AU",
    service: "Dedicated senior accountant",
    price_type: "external_estimate",
    observed_value: 3400,
    unit: "per FTE / month",
    currency: "AUD",
    scope: ["dedicated resource", "workspace", "IT", "HR admin"],
    notes: "Salary-based pricing; placeholder estimate.",
    provenance: est(),
  },
  {
    id: "p-toa-acct",
    entity_id: "toa-global",
    arena: "finance_outsourcing",
    country: "AU",
    service: "Offshore accountant",
    price_type: "competitor_quote",
    observed_value: 3100,
    unit: "per FTE / month",
    currency: "AUD",
    scope: ["dedicated resource", "workspace", "IT"],
    notes: "Placeholder for a quote reported by a prospect — confirm with BD.",
    provenance: est({ source_type: "competitor_quote" }),
  },
  {
    id: "p-hexa-acct",
    entity_id: "hexa",
    arena: "finance_outsourcing",
    country: "AU",
    service: "Managed senior accountant (with QA review)",
    price_type: "hexa_deal",
    observed_value: 3600,
    unit: "per FTE / month",
    currency: "AUD",
    scope: ["dedicated resource", "workspace", "IT", "HR admin", "QA review", "senior supervision", "training", "replacement guarantee"],
    notes: "Illustrative placeholder — replace with actual deal data.",
    provenance: est({ source_type: "internal" }),
  },
  {
    id: "p-hexa-dev",
    entity_id: "hexa",
    arena: "tech_outsourcing",
    country: "SG",
    service: "Dedicated full-stack engineer",
    price_type: "hexa_deal",
    observed_value: 4800,
    unit: "per FTE / month",
    currency: "SGD",
    scope: ["dedicated resource", "workspace", "IT", "tech lead oversight", "security controls"],
    notes: "Illustrative placeholder.",
    provenance: est({ source_type: "internal" }),
  },
];

// ─────────────────────── Salary benchmarks ───────────────────────
export const salaries: SalaryBenchmark[] = [
  { id: "s-au-sa", role: "Senior Accountant", country: "AU", currency: "AUD", annual_low: 90000, annual_mid: 105000, annual_high: 125000, oncost_pct: 0.2, time_to_hire_days: 55, availability: "scarce", provenance: est() },
  { id: "s-np-sa", role: "Senior Accountant", country: "NP", currency: "NPR", annual_low: 1200000, annual_mid: 1700000, annual_high: 2400000, oncost_pct: 0.12, time_to_hire_days: 30, availability: "balanced", provenance: est() },
  { id: "s-au-ba", role: "Bookkeeper / AP-AR", country: "AU", currency: "AUD", annual_low: 62000, annual_mid: 72000, annual_high: 85000, oncost_pct: 0.2, time_to_hire_days: 35, availability: "tight", provenance: est() },
  { id: "s-np-ba", role: "Bookkeeper / AP-AR", country: "NP", currency: "NPR", annual_low: 600000, annual_mid: 850000, annual_high: 1100000, oncost_pct: 0.12, time_to_hire_days: 21, availability: "abundant", provenance: est() },
  { id: "s-sg-fs", role: "Full-stack Engineer", country: "SG", currency: "SGD", annual_low: 85000, annual_mid: 110000, annual_high: 140000, oncost_pct: 0.17, time_to_hire_days: 60, availability: "scarce", provenance: est() },
  { id: "s-np-fs", role: "Full-stack Engineer", country: "NP", currency: "NPR", annual_low: 1500000, annual_mid: 2400000, annual_high: 3600000, oncost_pct: 0.12, time_to_hire_days: 40, availability: "tight", provenance: est() },
  { id: "s-my-pr", role: "Payroll Specialist", country: "MY", currency: "MYR", annual_low: 48000, annual_mid: 60000, annual_high: 78000, oncost_pct: 0.16, time_to_hire_days: 35, availability: "balanced", provenance: est() },
  { id: "s-np-pr", role: "Payroll Specialist", country: "NP", currency: "NPR", annual_low: 700000, annual_mid: 950000, annual_high: 1300000, oncost_pct: 0.12, time_to_hire_days: 25, availability: "balanced", provenance: est() },
];

/** Indicative FX to USD. Replace with a live feed. */
export const FX_TO_USD: Record<string, number> = {
  USD: 1,
  AUD: 0.66,
  SGD: 0.75,
  MYR: 0.22,
  NPR: 0.0074,
  IDR: 0.000063,
  GBP: 1.28,
  BDT: 0.0083,
};

// ───────────────────────── Signals ─────────────────────────
export const signals: Signal[] = [
  { id: "sig-1", type: "pricing_change", title: "Deel EOR headline rate observed at ~US$599", summary: "Headline EOR rate on pricing page. Scope and country variation unconfirmed.", entity_id: "deel", entity_kind: "competitor", country: "MY", arena: "eor_payroll", urgency: "high", impact: 4, owner: "Finance", due_date: "2026-10-31", status: "new", recommended_action: "Run scope-normalised comparison vs Hexa MY EOR offer; update battlecard pricing objection.", provenance: { source_url: "https://www.deel.com/", source_type: "pricing_page", observed_at: D, confidence: "medium", verification_status: "pending", analyst: "Intelligence analyst" } },
  { id: "sig-2", type: "pricing_change", title: "Remote standard EOR observed at ~US$699", summary: "Published standard EOR rate. Confirm inclusions.", entity_id: "remote", entity_kind: "competitor", arena: "eor_payroll", urgency: "medium", impact: 3, owner: "Finance", due_date: "2026-11-07", status: "new", recommended_action: "Add to pricing benchmark with scope tags.", provenance: { source_url: "https://remote.com/", source_type: "pricing_page", observed_at: D, confidence: "medium", verification_status: "pending", analyst: "Intelligence analyst" } },
  { id: "sig-3", type: "web_change", title: "Emapta finance landing page change (example)", summary: "Example of a monitored page change. Connect Visualping or similar to populate.", entity_id: "emapta", entity_kind: "competitor", country: "AU", arena: "finance_outsourcing", urgency: "medium", impact: 3, owner: "Intelligence analyst", due_date: "2026-11-03", status: "new", recommended_action: "Review diff; update positioning if service scope changed.", provenance: est({ source_type: "company_website" }) },
  { id: "sig-4", type: "hiring_spike", title: "Sample: Harbour & Co. advertising 4 accountant roles", summary: "Illustrative account signal: sustained hard-to-fill finance roles.", entity_id: "acc-1", entity_kind: "account", country: "AU", arena: "finance_outsourcing", urgency: "high", impact: 5, owner: "BizDev", due_date: "2026-10-29", status: "new", recommended_action: "Send cost-of-vacancy outreach to managing partner with 90-day pilot offer.", provenance: est({ source_type: "job_posting" }) },
  { id: "sig-5", type: "leadership_hire", title: "Sample: New CFO at Meridian Logistics", summary: "Illustrative signal: new CFO appointments often precede finance transformation.", entity_id: "acc-3", entity_kind: "account", country: "SG", arena: "finance_outsourcing", urgency: "high", impact: 4, owner: "BizDev", due_date: "2026-11-01", status: "triaged", recommended_action: "Congratulate + share SG finance cost benchmark; propose discovery call.", provenance: est({ source_type: "press_release" }) },
  { id: "sig-6", type: "regulatory", title: "Monitor: Malaysian employment / statutory contribution changes", summary: "Placeholder for regulatory feed. Connect official gazette / regulator RSS.", entity_id: "my-eor_payroll-sme", entity_kind: "market", country: "MY", arena: "eor_payroll", urgency: "medium", impact: 4, owner: "Strategy", due_date: "2026-11-15", status: "new", recommended_action: "Brief clients proactively; use as outbound trigger for MY SMEs.", provenance: est({ source_type: "regulator" }) },
  { id: "sig-7", type: "funding", title: "Sample: Kestrel Health raises Series B", summary: "Illustrative: funded scale-ups expand engineering and finance quickly.", entity_id: "acc-5", entity_kind: "account", country: "SG", arena: "tech_outsourcing", urgency: "medium", impact: 4, owner: "BizDev", due_date: "2026-11-05", status: "new", recommended_action: "Offer dedicated engineering pod + regional EOR bundle.", provenance: est({ source_type: "press_release" }) },
  { id: "sig-8", type: "expansion", title: "Sample: Andaman Retail opening Indonesia entity", summary: "Illustrative: cross-border expansion trigger for EOR + advisory.", entity_id: "acc-6", entity_kind: "account", country: "ID", arena: "eor_payroll", urgency: "high", impact: 4, owner: "BizDev", due_date: "2026-10-30", status: "new", recommended_action: "Pitch 'before you commit' advisory: EOR vs entity decision.", provenance: est({ source_type: "press_release" }) },
  { id: "sig-9", type: "launch", title: "AI automation substitutes gaining finance mindshare", summary: "Track AI bookkeeping tools as substitutes for junior finance FTEs.", entity_id: "sub-ai-automation", entity_kind: "competitor", arena: "finance_outsourcing", urgency: "medium", impact: 4, owner: "Strategy", due_date: "2026-11-20", status: "new", recommended_action: "Package HexaCoPilot / SmartLedger into managed finance offer.", provenance: est() },
  { id: "sig-10", type: "partnership", title: "Watch: global EOR platforms partnering with local payroll", summary: "Placeholder: partnerships could compress regional EOR differentiation.", entity_id: "multiplier", entity_kind: "competitor", arena: "eor_payroll", urgency: "low", impact: 3, owner: "Intelligence analyst", due_date: "2026-11-30", status: "new", recommended_action: "Monitor; evaluate Hexa as in-country partner for global platforms.", provenance: est() },
  { id: "sig-11", type: "tender", title: "Sample: shared-services tender (MY GLC)", summary: "Illustrative tender for back-office finance services.", entity_id: "acc-8", entity_kind: "account", country: "MY", arena: "finance_outsourcing", urgency: "critical", impact: 5, owner: "BizDev", due_date: "2026-10-27", status: "new", recommended_action: "Bid/no-bid decision by Monday; check capacity with delivery.", provenance: est({ source_type: "licensed_feed" }) },
];

// ───────────────────────── Accounts ─────────────────────────
// Fictional sample companies — clearly labelled. Do not treat as real prospects.
export const accounts: Account[] = [
  { id: "acc-1", name: "Harbour & Co. Chartered Accountants", sample: true, country: "AU", industry: "Accounting practice", segment: "Accounting firms", headcount: 45, revenue_band: "AUD 5–10m", software: ["Xero", "XPM"], target_arena: "finance_outsourcing", signals: ["sig-4"], fit: 5, outsourcing_readiness: 4, incumbent: "sub-inhouse", status: "researching", owner: "BizDev", why_company: "Mid-size practice with Xero stack matching Hexa delivery skills.", why_service: "Compliance and bookkeeping workload is repeatable and offshore-ready.", why_now: "Four accountant roles open > 60 days; tax season approaching.", contacts: [
    { id: "c1", name: "Managing Partner (to identify)", role: "Managing Partner", department: "Leadership", seniority: "C-level", influence: "decision_maker", relationship: "none", lawful_basis: "legitimate_interest", verified: false, source_type: "company_website" },
    { id: "c2", name: "Practice Manager (to identify)", role: "Practice Manager", department: "Operations", seniority: "Manager", influence: "champion", relationship: "none", lawful_basis: "legitimate_interest", verified: false, source_type: "company_website" },
  ] },
  { id: "acc-2", name: "Southern Cross Advisory", sample: true, country: "AU", industry: "Accounting practice", segment: "Accounting firms", headcount: 22, revenue_band: "AUD 2–5m", software: ["MYOB", "Xero"], target_arena: "finance_outsourcing", signals: [], fit: 4, outsourcing_readiness: 3, incumbent: "emapta", status: "contacted", owner: "BizDev", why_company: "Growing practice; uses offshore staff already (displacement opportunity).", why_service: "Currently staffing-only; may value supervised managed service.", why_now: "Incumbent contract renewal expected Q1 (to confirm).", contacts: [
    { id: "c3", name: "Director (to identify)", role: "Director", department: "Leadership", seniority: "C-level", influence: "decision_maker", relationship: "connected", lawful_basis: "legitimate_interest", verified: false, source_type: "crm" },
  ] },
  { id: "acc-3", name: "Meridian Logistics Asia", sample: true, country: "SG", industry: "Logistics", segment: "Mid-market", headcount: 380, revenue_band: "SGD 50–100m", software: ["NetSuite"], target_arena: "finance_outsourcing", signals: ["sig-5"], fit: 4, outsourcing_readiness: 4, status: "researching", owner: "BizDev", why_company: "Multi-entity APAC finance with SG wage pressure.", why_service: "Dedicated finance centre for AP/AR and consolidation.", why_now: "New CFO appointed; ERP rollout underway.", contacts: [
    { id: "c4", name: "CFO (new — to verify)", role: "Chief Financial Officer", department: "Finance", seniority: "C-level", influence: "decision_maker", relationship: "none", lawful_basis: "legitimate_interest", verified: false, source_type: "press_release" },
    { id: "c5", name: "Financial Controller (to identify)", role: "Financial Controller", department: "Finance", seniority: "VP/Director", influence: "influencer", relationship: "none", lawful_basis: "legitimate_interest", verified: false, source_type: "company_website" },
  ] },
  { id: "acc-4", name: "Tasman Property Group", sample: true, country: "AU", industry: "Real estate", segment: "Mid-market", headcount: 210, revenue_band: "AUD 20–50m", software: ["Xero", "Dext"], target_arena: "finance_outsourcing", signals: [], fit: 3, outsourcing_readiness: 3, status: "new", owner: "BizDev", why_company: "Trust accounting volume; seasonal peaks.", why_service: "AP and trust reconciliations suit offshore delivery.", why_now: "No strong trigger yet — nurture.", contacts: [] },
  { id: "acc-5", name: "Kestrel Health Tech", sample: true, country: "SG", industry: "HealthTech", segment: "Scale-ups", headcount: 140, revenue_band: "SGD 10–20m", software: ["Xero", "GitHub", "AWS"], target_arena: "tech_outsourcing", signals: ["sig-7"], fit: 4, outsourcing_readiness: 4, incumbent: "deel", status: "new", owner: "BizDev", why_company: "Funded scale-up with engineering hiring backlog.", why_service: "Dedicated engineering pod plus regional EOR.", why_now: "Series B closed; hiring plan doubling engineering.", contacts: [
    { id: "c6", name: "CTO (to identify)", role: "CTO", department: "Engineering", seniority: "C-level", influence: "decision_maker", relationship: "none", lawful_basis: "legitimate_interest", verified: false, source_type: "press_release" },
  ] },
  { id: "acc-6", name: "Andaman Retail Holdings", sample: true, country: "MY", industry: "Retail", segment: "Mid-market", headcount: 900, revenue_band: "MYR 200–500m", software: ["SAP B1"], target_arena: "eor_payroll", signals: ["sig-8"], fit: 4, outsourcing_readiness: 3, status: "engaged", owner: "BizDev", why_company: "Regional expansion into Indonesia.", why_service: "EOR bridge + advisory before entity set-up.", why_now: "Indonesia launch announced for next quarter.", contacts: [
    { id: "c7", name: "Head of HR (to identify)", role: "Head of HR", department: "HR", seniority: "VP/Director", influence: "champion", relationship: "conversing", lawful_basis: "existing_relationship", verified: true, source_type: "crm" },
  ] },
  { id: "acc-7", name: "Lumen Analytics", sample: true, country: "UK", industry: "Software", segment: "Scale-ups", headcount: 75, revenue_band: "GBP 5–10m", software: ["QuickBooks", "HubSpot"], target_arena: "finance_outsourcing", signals: [], fit: 3, outsourcing_readiness: 2, status: "new", owner: "BizDev", why_company: "Lean finance team, growing quickly.", why_service: "Outsourced month-end close.", why_now: "Weak — monitor for funding / CFO hire.", contacts: [] },
  { id: "acc-8", name: "Sample GLC Shared Services", sample: true, country: "MY", industry: "Conglomerate", segment: "Enterprise", headcount: 4000, revenue_band: "MYR 1bn+", software: ["SAP S/4HANA"], target_arena: "finance_outsourcing", signals: ["sig-11"], fit: 3, outsourcing_readiness: 4, incumbent: "scicom", status: "opportunity", owner: "BizDev", why_company: "Large back-office volume.", why_service: "Finance shared services (AP, GL).", why_now: "Open tender closing soon.", contacts: [] },
  { id: "acc-9", name: "Coral Bay Accounting", sample: true, country: "AU", industry: "Accounting practice", segment: "Accounting firms", headcount: 12, revenue_band: "AUD 1–2m", software: ["Xero"], target_arena: "finance_outsourcing", signals: [], fit: 4, outsourcing_readiness: 4, status: "new", owner: "BizDev", why_company: "Small firm, owner-led, capacity-constrained.", why_service: "Single managed bookkeeper to start.", why_now: "Owner posting about burnout / capacity (sample).", contacts: [] },
  { id: "acc-10", name: "Pacific Freight Brokers", sample: true, country: "SG", industry: "Logistics", segment: "SME", headcount: 60, revenue_band: "SGD 5–10m", software: ["Xero"], target_arena: "eor_payroll", signals: [], fit: 3, outsourcing_readiness: 3, status: "new", owner: "BizDev", why_company: "Hiring in MY/ID without entities.", why_service: "Regional EOR + payroll.", why_now: "Medium — expansion plans mentioned (sample).", contacts: [] },
];

// ─────────────────── Opportunities (generated) ───────────────────
// Deterministic pseudo-random pipeline so funnel/win-loss analytics have shape.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const STAGES: FunnelStage[] = ["target", "connection_sent", "connected", "messaged", "replied", "meeting", "qualified", "proposal", "won", "lost"];
const LOSS: LossReason[] = ["price", "no_urgency", "local_provider_preference", "capability_gap", "offshore_risk", "went_in_house", "deferred_hiring"];
const COMBOS: { arena: Arena; country: CountryCode; segment: Segment; w: number }[] = [
  { arena: "finance_outsourcing", country: "AU", segment: "Accounting firms", w: 0.32 },
  { arena: "finance_outsourcing", country: "AU", segment: "SME", w: 0.12 },
  { arena: "eor_payroll", country: "MY", segment: "SME", w: 0.16 },
  { arena: "eor_payroll", country: "MY", segment: "Mid-market", w: 0.1 },
  { arena: "finance_outsourcing", country: "SG", segment: "Mid-market", w: 0.12 },
  { arena: "tech_outsourcing", country: "SG", segment: "Scale-ups", w: 0.1 },
  { arena: "advisory", country: "MY", segment: "SME", w: 0.08 },
];
const COMP_BY_ARENA: Record<Arena, string[]> = {
  finance_outsourcing: ["emapta", "toa-global", "sub-inhouse", "sub-local-practice", "staffcloud"],
  eor_payroll: ["deel", "remote", "bipo", "multiplier", "boardroom"],
  tech_outsourcing: ["sub-inhouse", "fusemachines", "sourcefit"],
  advisory: ["boardroom", "links-intl", "sub-local-practice"],
};
const VARIANTS = ["Cost-of-vacancy", "Peer case study", "Compliance trigger", "Founder note"];

export const opportunities: Opportunity[] = (() => {
  const r = rng(42);
  const out: Opportunity[] = [];
  for (let i = 0; i < 400; i++) {
    let x = r();
    const combo = COMBOS.find((c) => (x -= c.w) < 0) ?? COMBOS[0];
    const intel = r() < 0.45;
    // Progress through funnel with stage-specific pass rates; intel-assisted converts better.
    const pass = [0.9, 0.65, 0.95, 0.45, 0.6, 0.7, 0.75, 0.4].map((p) => Math.min(0.97, p * (intel ? 1.06 : 1)));
    let idx = 0;
    while (idx < pass.length && r() < pass[idx]) idx++;
    let stage: FunnelStage = STAGES[idx];
    let loss: LossReason | undefined;
    if (stage === "proposal" && r() < 0.85) {
      stage = "lost";
      const lr = r();
      loss = LOSS[Math.floor(Math.pow(lr, 1.4) * LOSS.length)];
    }
    const month = 1 + Math.floor(r() * 10);
    const arenaVal = { finance_outsourcing: 60000, eor_payroll: 25000, tech_outsourcing: 90000, advisory: 18000 }[combo.arena];
    const comps = COMP_BY_ARENA[combo.arena];
    out.push({
      id: `opp-${i + 1}`,
      account_id: accounts[i % accounts.length].id,
      arena: combo.arena,
      country: combo.country,
      segment: combo.segment,
      stage,
      value_usd: Math.round(arenaVal * (0.5 + r() * 1.5)),
      gross_margin: +(({ finance_outsourcing: 0.36, eor_payroll: 0.27, tech_outsourcing: 0.32, advisory: 0.5 }[combo.arena]) + (r() - 0.5) * 0.12).toFixed(3),
      competitor_id: r() < 0.75 ? comps[Math.floor(r() * comps.length)] : undefined,
      loss_reason: loss,
      message_variant: VARIANTS[Math.floor(r() * VARIANTS.length)],
      intel_assisted: intel,
      created_at: `2026-${String(month).padStart(2, "0")}-${String(1 + Math.floor(r() * 27)).padStart(2, "0")}`,
      closed_at: stage === "won" || stage === "lost" ? `2026-${String(Math.min(10, month + 1)).padStart(2, "0")}-15` : undefined,
    });
  }
  return out;
})();

// ───────────────────────── Tasks ─────────────────────────
export const tasks: Task[] = [
  { id: "t1", title: "Finalize the four primary service-market combinations", owner: "Management", role: "Strategy", status: "doing", due: "2026-10-31", priority: "critical" },
  { id: "t2", title: "Create competitor master list (direct / indirect / substitute)", owner: "Analyst", role: "Intelligence", status: "done", due: "2026-10-31", priority: "high" },
  { id: "t3", title: "Define ~100 core fields and evidence standards", owner: "Analyst", role: "Intelligence", status: "doing", due: "2026-10-31", priority: "high" },
  { id: "t4", title: "Audit existing CRM, quotes, pricing and win/loss data", owner: "BD Lead", role: "BizDev", status: "todo", due: "2026-10-31", priority: "high" },
  { id: "t5", title: "Produce first five verified competitor battlecards", owner: "Analyst", role: "Intelligence", status: "doing", due: "2026-10-31", priority: "high" },
  { id: "t6", title: "Research and validate 20 competitors", owner: "Analyst", role: "Intelligence", status: "todo", due: "2026-11-08", priority: "high" },
  { id: "t7", title: "Prepare matched-role pricing in AU, MY and SG", owner: "Finance", role: "Finance", status: "todo", due: "2026-11-08", priority: "critical" },
  { id: "t8", title: "Establish company and decision-maker enrichment workflow", owner: "BD Lead", role: "BizDev", status: "todo", due: "2026-11-08", priority: "medium" },
  { id: "t9", title: "Connect competitor change monitoring and regulatory feeds", owner: "Engineer", role: "Engineering", status: "todo", due: "2026-11-08", priority: "medium" },
  { id: "t10", title: "Launch internal intelligence MVP dashboard", owner: "Engineer", role: "Engineering", status: "done", due: "2026-11-23", priority: "high" },
  { id: "t11", title: "Produce weekly competitor & market intelligence brief", owner: "Analyst", role: "Intelligence", status: "todo", due: "2026-11-23", priority: "medium" },
  { id: "t12", title: "Test intelligence-driven prospecting on 20 priority accounts", owner: "BD Lead", role: "BizDev", status: "todo", due: "2026-11-23", priority: "high" },
  { id: "t13", title: "Move data layer to Neon PostgreSQL (schema in /db)", owner: "Engineer", role: "Engineering", status: "todo", due: "2026-11-23", priority: "medium" },
];

export const decisions: Decision[] = [
  { id: "d1", date: "2026-10-24", title: "Lead with AU finance outsourcing for accounting firms", context: "Highest attractiveness score; aligns with specialist capability proposition (blueprint Priority 1).", decision: "Concentrate first 30 days of research and outbound on AU accounting firms.", owner: "Management", evidence: ["blueprint §13", "markets: au-finance_outsourcing-accounting-firms"], review_on: "2026-11-21" },
  { id: "d2", date: "2026-10-24", title: "Rate competitors by service × country × segment", context: "Single overall rank hides where rivals are actually strong.", decision: "No single global competitor rank. Threat scored per arena and published with evidence coverage.", owner: "Strategy", evidence: ["blueprint §2 design principle"], review_on: "2026-12-19" },
];

// ───────────────────────── Sources ─────────────────────────
export const sources: Source[] = [
  { id: "src-hnpl", name: "Hexamatics Nepal website", url: "https://www.hnpl.business", type: "company_website", licence: "public", refresh: "monthly", owner: "Analyst", last_checked: D, reliability: "high" },
  ...competitors
    .filter((c) => c.website)
    .map<Source>((c) => ({ id: `src-${c.id}`, name: `${c.name} website`, url: c.website, type: "company_website", licence: "public", refresh: c.tier === "tier1" ? "weekly" : "monthly", owner: "Analyst", last_checked: c.tier === "tier1" ? D : "2026-09-30", reliability: "medium" })),
  { id: "src-crayon", name: "Crayon (CI monitoring) — evaluate", url: "https://www.crayon.co/", type: "licensed_feed", licence: "licensed", refresh: "daily", owner: "Engineer", last_checked: "—", reliability: "medium" },
  { id: "src-klue", name: "Klue (battlecards) — evaluate", url: "https://klue.com/", type: "licensed_feed", licence: "licensed", refresh: "daily", owner: "Engineer", last_checked: "—", reliability: "medium" },
  { id: "src-similarweb", name: "Similarweb (traffic)", url: "https://www.similarweb.com/", type: "licensed_feed", licence: "licensed", refresh: "monthly", owner: "Engineer", last_checked: "—", reliability: "medium" },
  { id: "src-semrush", name: "Semrush (SEO / keyword gaps)", url: "https://www.semrush.com/", type: "licensed_feed", licence: "licensed", refresh: "weekly", owner: "Engineer", last_checked: "—", reliability: "medium" },
  { id: "src-apollo", name: "Apollo (account / contact enrichment)", url: "https://www.apollo.io/", type: "licensed_feed", licence: "licensed", refresh: "weekly", owner: "BD Lead", last_checked: "—", reliability: "medium" },
  { id: "src-clay", name: "Clay (enrichment workflows)", url: "https://www.clay.com/", type: "licensed_feed", licence: "licensed", refresh: "weekly", owner: "BD Lead", last_checked: "—", reliability: "medium" },
  { id: "src-visualping", name: "Visualping (page-change alerts)", url: "https://visualping.io/", type: "licensed_feed", licence: "licensed", refresh: "daily", owner: "Engineer", last_checked: "—", reliability: "high" },
  { id: "src-builtwith", name: "BuiltWith (tech stack)", url: "https://www.builtwith.com/", type: "licensed_feed", licence: "licensed", refresh: "monthly", owner: "Engineer", last_checked: "—", reliability: "medium" },
  { id: "src-alphasense", name: "AlphaSense (company research)", url: "https://www.alphasense.com/", type: "licensed_feed", licence: "licensed", refresh: "ad-hoc", owner: "Strategy", last_checked: "—", reliability: "high" },
  { id: "src-contify", name: "Contify (market intel feeds)", url: "https://www.contify.com/", type: "licensed_feed", licence: "licensed", refresh: "daily", owner: "Analyst", last_checked: "—", reliability: "medium" },
  { id: "src-crm", name: "Hexa CRM (internal)", url: "", type: "crm", licence: "internal", refresh: "daily", owner: "BD Lead", last_checked: "—", reliability: "high" },
];

// ─────────────────────── Observations ───────────────────────
export const observations: Observation[] = [
  { id: "o1", entity_id: "hexa", field: "certification", observed_value: "ISO 27001", source_url: "https://www.hnpl.business", source_type: "company_website", observed_at: D, confidence: "medium", verification_status: "pending", analyst: "Analyst" },
  { id: "o2", entity_id: "hexa", field: "certification", observed_value: "ISO 9001", source_url: "https://www.hnpl.business", source_type: "company_website", observed_at: D, confidence: "medium", verification_status: "pending", analyst: "Analyst" },
  { id: "o3", entity_id: "hexa", field: "accreditation", observed_value: "ACCA Approved Employer", source_url: "https://www.hnpl.business", source_type: "company_website", observed_at: D, confidence: "medium", verification_status: "pending", analyst: "Analyst" },
  { id: "o4", entity_id: "deel", market: "MY", service_line: "eor_payroll", field: "published_price", observed_value: "599", unit: "per employee / month", currency: "USD", source_url: "https://www.deel.com/", source_type: "pricing_page", observed_at: D, confidence: "medium", verification_status: "pending", analyst: "Analyst" },
  { id: "o5", entity_id: "remote", service_line: "eor_payroll", field: "published_price", observed_value: "699", unit: "per employee / month", currency: "USD", source_url: "https://remote.com/", source_type: "pricing_page", observed_at: D, confidence: "medium", verification_status: "pending", analyst: "Analyst" },
  { id: "o6", entity_id: "emapta", service_line: "finance_outsourcing", field: "positioning", observed_value: "Dedicated offshore teams; salary-based pricing", source_url: "https://emapta.com/", source_type: "company_website", observed_at: D, confidence: "medium", verification_status: "pending", analyst: "Analyst" },
  { id: "o7", entity_id: "daythree", service_line: "tech_outsourcing", field: "positioning", observed_value: "Technology-enabled BPS, AI, analytics, CX", source_url: "https://www.daythree.com/", source_type: "company_website", observed_at: D, confidence: "medium", verification_status: "unverified", analyst: "Analyst" },
  { id: "o8", entity_id: "scicom", service_line: "finance_outsourcing", field: "positioning", observed_value: "Enterprise BPO/CX, multilingual, automation", source_url: "https://scicom-intl.com/", source_type: "company_website", observed_at: D, confidence: "medium", verification_status: "unverified", analyst: "Analyst" },
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
