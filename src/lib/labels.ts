import type { Arena, CountryCode, FunnelStage, LossReason, SignalType, PriceType, Urgency } from "./types";

export const ARENA_LABEL: Record<Arena, string> = {
  eor_payroll: "EOR & Payroll",
  finance_outsourcing: "Finance Outsourcing",
  tech_outsourcing: "Technology Outsourcing",
  advisory: "Business Setup & Advisory",
};

export const ARENA_SHORT: Record<Arena, string> = {
  eor_payroll: "EOR",
  finance_outsourcing: "Finance",
  tech_outsourcing: "Tech",
  advisory: "Advisory",
};

export const ARENA_CRITERIA: Record<Arena, string> = {
  eor_payroll: "Country coverage, compliance capability, software experience, fees, implementation",
  finance_outsourcing: "Capability, qualifications, quality, cost, reporting and supervision",
  tech_outsourcing: "Engineering talent, execution, scope, security, cost",
  advisory: "Local knowledge, delivery speed, accountability, regulatory credibility",
};

export const ARENAS: Arena[] = ["finance_outsourcing", "eor_payroll", "tech_outsourcing", "advisory"];

export const COUNTRY_LABEL: Record<CountryCode, string> = {
  AU: "Australia",
  MY: "Malaysia",
  SG: "Singapore",
  NP: "Nepal",
  ID: "Indonesia",
  BD: "Bangladesh",
  UK: "United Kingdom",
  US: "United States",
};

export const COUNTRY_FLAG: Record<CountryCode, string> = {
  AU: "🇦🇺",
  MY: "🇲🇾",
  SG: "🇸🇬",
  NP: "🇳🇵",
  ID: "🇮🇩",
  BD: "🇧🇩",
  UK: "🇬🇧",
  US: "🇺🇸",
};

export const STAGE_LABEL: Record<FunnelStage, string> = {
  target: "Target account",
  connection_sent: "Connection request",
  connected: "Accepted connection",
  messaged: "Message",
  replied: "Reply",
  meeting: "Meeting",
  qualified: "Qualified opp.",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

export const FUNNEL_ORDER: FunnelStage[] = [
  "target",
  "connection_sent",
  "connected",
  "messaged",
  "replied",
  "meeting",
  "qualified",
  "proposal",
  "won",
];

export const LOSS_LABEL: Record<LossReason, string> = {
  price: "Price",
  no_urgency: "No urgency",
  local_provider_preference: "Local provider preference",
  capability_gap: "Capability gap",
  offshore_risk: "Perceived offshore risk",
  went_in_house: "Went in-house",
  deferred_hiring: "Deferred hiring",
};

export const SIGNAL_LABEL: Record<SignalType, string> = {
  funding: "Funding",
  leadership_hire: "Leadership hire",
  hiring_spike: "Hiring spike",
  layoffs: "Layoffs",
  expansion: "Expansion",
  tender: "Tender",
  contract: "Contract",
  launch: "Launch",
  pricing_change: "Pricing change",
  regulatory: "Regulatory",
  web_change: "Website change",
  partnership: "Partnership",
};

export const PRICE_TYPE_LABEL: Record<PriceType, string> = {
  published: "Publicly advertised",
  external_estimate: "External estimate",
  competitor_quote: "Negotiated competitor quote",
  hexa_deal: "Actual Hexa deal",
};

export const URGENCY_ORDER: Record<Urgency, number> = { critical: 0, high: 1, medium: 2, low: 3 };
