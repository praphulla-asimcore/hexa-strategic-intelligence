// Core domain model for Hexa Strategic Intelligence.
// Mirrors the blueprint's 12 intelligence modules and the minimum provenance schema.

export type Arena = "eor_payroll" | "finance_outsourcing" | "tech_outsourcing" | "advisory";
export type CountryCode = "AU" | "MY" | "SG" | "NP" | "ID" | "BD" | "UK" | "US";
export type Segment = "SME" | "Mid-market" | "Enterprise" | "Accounting firms" | "Scale-ups";
export type Confidence = "high" | "medium" | "low";
export type Verification = "verified" | "pending" | "unverified" | "disputed";
export type CompetitorTier = "tier1" | "tier2" | "substitute";
export type CompetitorKind = "direct" | "indirect" | "substitute";
export type Urgency = "critical" | "high" | "medium" | "low";

/** Minimum provenance schema attached to every observation. */
export interface Provenance {
  source_url?: string;
  source_type: SourceType;
  observed_at: string; // ISO date
  effective_date?: string;
  confidence: Confidence;
  verification_status: Verification;
  analyst: string;
  last_reviewed_at?: string;
}

export type SourceType =
  | "company_website"
  | "pricing_page"
  | "press_release"
  | "job_posting"
  | "regulator"
  | "licensed_feed"
  | "crm"
  | "analyst_estimate"
  | "customer_interview"
  | "competitor_quote"
  | "internal";

export interface Competitor {
  id: string;
  name: string;
  website: string;
  tier: CompetitorTier;
  kind: CompetitorKind;
  hq: string;
  ownership?: string;
  size_band: string;
  arenas: Arena[];
  countries: CountryCode[];
  segments: Segment[];
  positioning: string;
  implication: string;
  certifications: string[];
  strengths: string[];
  weaknesses: string[];
  // Threat-score inputs, each 1–5
  threat_inputs: {
    customer_overlap: number;
    service_overlap: number;
    market_presence: number;
    pricing_pressure: number;
    growth_signals: number;
  };
  /** Share of the ~100 core fields populated with evidence (0–1). */
  evidence_coverage: number;
  battlecard: Battlecard;
  provenance: Provenance;
}

export interface Battlecard {
  why_we_win: string[];
  why_we_lose: string[];
  objections: { objection: string; response: string }[];
  landmines: string[]; // questions to plant with buyers
  proof_points: string[];
}

/** Coverage intensity of a competitor in a service × country cell, 0–3. */
export interface CoverageCell {
  competitor_id: string;
  arena: Arena;
  country: CountryCode;
  intensity: 0 | 1 | 2 | 3;
}

export interface MarketCombo {
  id: string;
  country: CountryCode;
  arena: Arena;
  segment: Segment;
  // Inputs scored 1–5
  demand: number;
  margin: number;
  accessibility: number;
  intensity: number; // competitive intensity: higher is worse
  readiness: number; // Hexa delivery readiness
  addressable_usd_m?: number;
  growth_pct?: number;
  regulatory_risk: Confidence; // reuse low/medium/high
  notes: string;
  // Observed outcomes used to back-test weights
  win_rate?: number; // 0–1
  contribution_margin?: number; // 0–1
  provenance: Provenance;
}

export type PriceType = "published" | "external_estimate" | "competitor_quote" | "hexa_deal";

export interface PricingObservation {
  id: string;
  entity_id: string; // competitor id or "hexa"
  arena: Arena;
  country: CountryCode;
  service: string;
  price_type: PriceType;
  observed_value: number;
  unit: string; // e.g. "per employee / month"
  currency: string;
  scope: string[]; // included services, used for scope normalization
  min_term_months?: number;
  setup_fee?: number;
  deposit?: string;
  notes?: string;
  provenance: Provenance;
}

export interface SalaryBenchmark {
  id: string;
  role: string;
  country: CountryCode;
  currency: string;
  annual_low: number;
  annual_mid: number;
  annual_high: number;
  oncost_pct: number; // statutory + benefits as % of salary
  time_to_hire_days: number;
  availability: "scarce" | "tight" | "balanced" | "abundant";
  provenance: Provenance;
}

export interface Account {
  id: string;
  name: string;
  sample: boolean; // illustrative seed record
  country: CountryCode;
  industry: string;
  segment: Segment;
  headcount: number;
  revenue_band: string;
  software: string[];
  target_arena: Arena;
  signals: string[]; // signal ids
  fit: number; // ICP fit 1–5
  outsourcing_readiness: number; // 1–5
  incumbent?: string; // competitor id
  status: "new" | "researching" | "contacted" | "engaged" | "opportunity" | "customer" | "disqualified";
  owner: string;
  why_company: string;
  why_service: string;
  why_now: string;
  contacts: Contact[];
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  department: string;
  seniority: "C-level" | "VP/Director" | "Manager" | "Individual";
  influence: "decision_maker" | "champion" | "influencer" | "gatekeeper";
  relationship: "none" | "connected" | "conversing" | "trusted";
  lawful_basis: "legitimate_interest" | "consent" | "existing_relationship";
  verified: boolean;
  source_type: SourceType;
}

export type SignalType =
  | "funding"
  | "leadership_hire"
  | "hiring_spike"
  | "layoffs"
  | "expansion"
  | "tender"
  | "contract"
  | "launch"
  | "pricing_change"
  | "regulatory"
  | "web_change"
  | "partnership";

export interface Signal {
  id: string;
  type: SignalType;
  title: string;
  summary: string;
  entity_id: string; // competitor, account or market id
  entity_kind: "competitor" | "account" | "market";
  country?: CountryCode;
  arena?: Arena;
  urgency: Urgency;
  impact: number; // 1–5
  owner: string;
  due_date: string;
  status: "new" | "triaged" | "actioned" | "dismissed";
  recommended_action: string;
  provenance: Provenance;
}

export type FunnelStage =
  | "target"
  | "connection_sent"
  | "connected"
  | "messaged"
  | "replied"
  | "meeting"
  | "qualified"
  | "proposal"
  | "won"
  | "lost";

export interface Opportunity {
  id: string;
  account_id: string;
  arena: Arena;
  country: CountryCode;
  segment: Segment;
  stage: FunnelStage;
  value_usd: number; // annual contract value
  gross_margin: number; // 0–1
  competitor_id?: string;
  loss_reason?: LossReason;
  message_variant: string;
  intel_assisted: boolean;
  created_at: string;
  closed_at?: string;
}

export type LossReason =
  | "price"
  | "no_urgency"
  | "local_provider_preference"
  | "capability_gap"
  | "offshore_risk"
  | "went_in_house"
  | "deferred_hiring";

export interface Task {
  id: string;
  title: string;
  owner: string;
  role: "Strategy" | "Intelligence" | "BizDev" | "Finance" | "Engineering";
  status: "todo" | "doing" | "done";
  due: string;
  priority: Urgency;
  linked?: string; // entity id
}

export interface Decision {
  id: string;
  date: string;
  title: string;
  context: string;
  decision: string;
  owner: string;
  evidence: string[]; // source ids / urls
  review_on: string;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  type: SourceType;
  licence: "public" | "licensed" | "internal" | "restricted";
  refresh: "daily" | "weekly" | "monthly" | "ad-hoc";
  owner: string;
  last_checked: string;
  reliability: Confidence;
}

export interface Observation extends Provenance {
  id: string;
  entity_id: string;
  market?: CountryCode;
  service_line?: Arena;
  field: string;
  observed_value: string;
  unit?: string;
  currency?: string;
}

export interface Weights {
  market: { demand: number; margin: number; accessibility: number; intensity: number; readiness: number };
  threat: {
    customer_overlap: number;
    service_overlap: number;
    market_presence: number;
    pricing_pressure: number;
    growth_signals: number;
  };
  propensity: { fit: number; readiness: number; signals: number; access: number; displacement: number };
}
