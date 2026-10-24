import type {
  Account,
  Arena,
  Competitor,
  Confidence,
  FunnelStage,
  LossReason,
  MarketCombo,
  Opportunity,
  Signal,
  Weights,
} from "./types";
import { FUNNEL_ORDER } from "./labels";

export const DEFAULT_WEIGHTS: Weights = {
  market: { demand: 0.3, margin: 0.25, accessibility: 0.15, intensity: 0.15, readiness: 0.15 },
  threat: { customer_overlap: 0.3, service_overlap: 0.25, market_presence: 0.2, pricing_pressure: 0.15, growth_signals: 0.1 },
  propensity: { fit: 0.3, readiness: 0.2, signals: 0.25, access: 0.15, displacement: 0.1 },
};

const normalize = <T extends Record<string, number>>(w: T): T => {
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / total])) as T;
};

// ───────────────── 6.1 Market attractiveness ─────────────────
/** Score out of 100 = 20 × Σ(weight × input), with competitive intensity inverted (6 − x). */
export function marketScore(m: MarketCombo, weights: Weights["market"] = DEFAULT_WEIGHTS.market): number {
  const w = normalize(weights);
  const raw =
    m.demand * w.demand +
    m.margin * w.margin +
    m.accessibility * w.accessibility +
    (6 - m.intensity) * w.intensity +
    m.readiness * w.readiness;
  return Math.round(20 * raw * 10) / 10;
}

export function marketBreakdown(m: MarketCombo, weights: Weights["market"] = DEFAULT_WEIGHTS.market) {
  const w = normalize(weights);
  return [
    { factor: "Demand", value: 20 * m.demand * w.demand },
    { factor: "Margin", value: 20 * m.margin * w.margin },
    { factor: "Access", value: 20 * m.accessibility * w.accessibility },
    { factor: "Low rivalry", value: 20 * (6 - m.intensity) * w.intensity },
    { factor: "Readiness", value: 20 * m.readiness * w.readiness },
  ];
}

// ───────────────── 6.2 Competitor threat ─────────────────
export interface ThreatResult {
  score: number; // 0–100
  confidence: Confidence;
  coverage: number; // 0–1
  insufficient: boolean;
  /** Upper bound when evidence is thin: assume unknown inputs could be max. */
  ceiling: number;
}

export function threatScore(c: Competitor, weights: Weights["threat"] = DEFAULT_WEIGHTS.threat): ThreatResult {
  const w = normalize(weights);
  const t = c.threat_inputs;
  const raw =
    t.customer_overlap * w.customer_overlap +
    t.service_overlap * w.service_overlap +
    t.market_presence * w.market_presence +
    t.pricing_pressure * w.pricing_pressure +
    t.growth_signals * w.growth_signals;
  const score = Math.round(20 * raw);
  const coverage = c.evidence_coverage;
  const verifiedBoost = c.provenance.verification_status === "verified" ? 0.2 : c.provenance.verification_status === "pending" ? 0.1 : 0;
  const q = coverage + verifiedBoost;
  const confidence: Confidence = q >= 0.7 ? "high" : q >= 0.45 ? "medium" : "low";
  // Insufficient data must not imply low risk: compute a ceiling blending toward 100 by missing evidence.
  const ceiling = Math.round(score + (100 - score) * (1 - coverage) * 0.6);
  return { score, confidence, coverage, insufficient: coverage < 0.3, ceiling };
}

// ───────────────── 6.4 Account propensity ─────────────────
export interface PropensityResult {
  score: number;
  parts: { factor: string; value: number }[];
  tier: "A" | "B" | "C";
}

export function propensity(a: Account, allSignals: Signal[], weights: Weights["propensity"] = DEFAULT_WEIGHTS.propensity): PropensityResult {
  const w = normalize(weights);
  const linked = allSignals.filter((s) => a.signals.includes(s.id) || s.entity_id === a.id);
  const signalStrength = Math.min(5, linked.reduce((acc, s) => acc + s.impact * (s.urgency === "critical" ? 1.2 : s.urgency === "high" ? 1 : 0.7), 0));
  const access =
    a.contacts.length === 0
      ? 1
      : Math.min(
          5,
          1 +
            a.contacts.filter((c) => c.influence === "decision_maker").length +
            a.contacts.filter((c) => c.verified).length +
            a.contacts.filter((c) => c.relationship !== "none").length,
        );
  const displacement = !a.incumbent ? 4 : a.incumbent.startsWith("sub-") ? 4.5 : 2.5;
  const parts = [
    { factor: "ICP fit", value: 20 * a.fit * w.fit },
    { factor: "Readiness", value: 20 * a.outsourcing_readiness * w.readiness },
    { factor: "Signals", value: 20 * Math.max(1, signalStrength) * w.signals },
    { factor: "Access", value: 20 * access * w.access },
    { factor: "Displaceable", value: 20 * displacement * w.displacement },
  ];
  const score = Math.round(parts.reduce((s, p) => s + p.value, 0));
  return { score, parts, tier: score >= 75 ? "A" : score >= 60 ? "B" : "C" };
}

// ───────────────── 6.3 Price & contribution margin ─────────────────
export interface MarginInputs {
  buyerSalaryAnnual: number; // buyer-country in-house salary, local currency
  buyerOncostPct: number;
  buyerRecruitCostPct: number; // agency fee etc, annualised share
  buyerFx: number; // to USD
  nepalSalaryAnnual: number; // NPR
  nepalOncostPct: number;
  nepalFx: number;
  supervisionPct: number; // supervision cost as % of direct salary
  infraMonthlyUsd: number; // seat, IT
  softwareMonthlyUsd: number;
  trainingMonthlyUsd: number;
  utilization: number; // 0–1 billable
  attritionPct: number; // annual
  replacementMonths: number; // months of cost lost per replacement
  priceMonthly: number; // Hexa proposal price, local buyer currency
  competitorPriceMonthly?: number;
}

export interface MarginResult {
  inHouseMonthlyUsd: number;
  deliveryCostMonthlyUsd: number;
  priceMonthlyUsd: number;
  contributionUsd: number;
  marginPct: number;
  clientSavingPct: number;
  competitorGapPct?: number;
  breakdown: { name: string; value: number }[];
  breakevenPriceUsd: number;
}

export function marginModel(i: MarginInputs): MarginResult {
  const inHouseMonthlyUsd = ((i.buyerSalaryAnnual * (1 + i.buyerOncostPct + i.buyerRecruitCostPct)) / 12) * i.buyerFx;
  const salaryUsd = ((i.nepalSalaryAnnual * (1 + i.nepalOncostPct)) / 12) * i.nepalFx;
  const supervision = salaryUsd * i.supervisionPct;
  const attrition = ((salaryUsd + supervision) * i.attritionPct * i.replacementMonths) / 12;
  const direct = salaryUsd + supervision + i.infraMonthlyUsd + i.softwareMonthlyUsd + i.trainingMonthlyUsd + attrition;
  // Non-billable capacity is carried by billable time.
  const deliveryCostMonthlyUsd = direct / Math.max(0.3, i.utilization);
  const priceMonthlyUsd = i.priceMonthly * i.buyerFx;
  const contributionUsd = priceMonthlyUsd - deliveryCostMonthlyUsd;
  const competitorUsd = i.competitorPriceMonthly ? i.competitorPriceMonthly * i.buyerFx : undefined;
  return {
    inHouseMonthlyUsd,
    deliveryCostMonthlyUsd,
    priceMonthlyUsd,
    contributionUsd,
    marginPct: priceMonthlyUsd ? contributionUsd / priceMonthlyUsd : 0,
    clientSavingPct: inHouseMonthlyUsd ? 1 - priceMonthlyUsd / inHouseMonthlyUsd : 0,
    competitorGapPct: competitorUsd ? priceMonthlyUsd / competitorUsd - 1 : undefined,
    breakevenPriceUsd: deliveryCostMonthlyUsd,
    breakdown: [
      { name: "Salary + statutory", value: salaryUsd / Math.max(0.3, i.utilization) },
      { name: "Supervision", value: supervision / Math.max(0.3, i.utilization) },
      { name: "Infrastructure", value: i.infraMonthlyUsd / Math.max(0.3, i.utilization) },
      { name: "Software", value: i.softwareMonthlyUsd / Math.max(0.3, i.utilization) },
      { name: "Training", value: i.trainingMonthlyUsd / Math.max(0.3, i.utilization) },
      { name: "Attrition", value: attrition / Math.max(0.3, i.utilization) },
    ],
  };
}

// ───────────────── 6.6 Scenarios ─────────────────
export interface Shock {
  salaryRisePct: number;
  competitorPriceCutPct: number;
  utilization: number;
  fxMovePct: number; // + = buyer currency weakens vs USD
  automationSavingPct: number;
  priceMatchPct: number; // how much of competitor cut Hexa matches (0–1)
}

export const BASE_SHOCK: Shock = { salaryRisePct: 0, competitorPriceCutPct: 0, utilization: 0.85, fxMovePct: 0, automationSavingPct: 0, priceMatchPct: 0.5 };

export function applyShock(i: MarginInputs, s: Shock): MarginInputs {
  const priceCut = (s.competitorPriceCutPct / 100) * s.priceMatchPct;
  return {
    ...i,
    nepalSalaryAnnual: i.nepalSalaryAnnual * (1 + s.salaryRisePct / 100) * (1 - s.automationSavingPct / 100),
    utilization: s.utilization,
    buyerFx: i.buyerFx * (1 - s.fxMovePct / 100),
    priceMonthly: i.priceMonthly * (1 - priceCut),
    competitorPriceMonthly: i.competitorPriceMonthly ? i.competitorPriceMonthly * (1 - s.competitorPriceCutPct / 100) : undefined,
  };
}

export const SCENARIO_PRESETS: { id: string; name: string; shock: Partial<Shock> }[] = [
  { id: "base", name: "Base case", shock: {} },
  { id: "salary10", name: "Nepal salaries +10%", shock: { salaryRisePct: 10 } },
  { id: "eorcut", name: "Competitors cut price 15%", shock: { competitorPriceCutPct: 15, priceMatchPct: 0.6 } },
  { id: "util", name: "Utilization falls to 70%", shock: { utilization: 0.7 } },
  { id: "fx", name: "Buyer currency −8% vs USD", shock: { fxMovePct: 8 } },
  { id: "auto", name: "Automation saves 15% effort", shock: { automationSavingPct: 15 } },
  { id: "down", name: "Combined downside", shock: { salaryRisePct: 10, competitorPriceCutPct: 10, utilization: 0.75, fxMovePct: 5 } },
  { id: "up", name: "Upside (automation + utilization)", shock: { automationSavingPct: 12, utilization: 0.9 } },
];

/** 12-month revenue + contribution forecast from open pipeline under base/upside/downside. */
export function forecast(opps: Opportunity[], winRate: number) {
  const open = opps.filter((o) => ["qualified", "proposal", "meeting"].includes(o.stage));
  const stageProb: Partial<Record<FunnelStage, number>> = { meeting: 0.35, qualified: 0.55, proposal: 1 };
  const expected = open.reduce(
    (acc, o) => {
      const p = (stageProb[o.stage] ?? 0) * winRate;
      acc.rev += o.value_usd * p;
      acc.gp += o.value_usd * o.gross_margin * p;
      return acc;
    },
    { rev: 0, gp: 0 },
  );
  const cases = [
    { name: "Downside", f: 0.7, m: -0.04 },
    { name: "Base", f: 1, m: 0 },
    { name: "Upside", f: 1.3, m: 0.03 },
  ];
  const months = Array.from({ length: 12 }, (_, k) => k + 1);
  return {
    open: open.length,
    cases: cases.map((c) => ({ name: c.name, revenue: expected.rev * c.f, gp: expected.gp * c.f + expected.rev * c.f * c.m })),
    // Monthly recognised revenue: expected ACV phases in linearly as deals close over 6 months.
    series: months.map((m) => {
      const ramp = Math.min(1, m / 6);
      const row: Record<string, number | string> = { month: `M${m}` };
      for (const c of cases) row[c.name] = Math.round(((expected.rev * c.f) / 12) * ramp);
      return row;
    }),
  };
}

// ───────────────── 6.5 Funnel / win-loss ─────────────────
export function funnel(opps: Opportunity[]) {
  const reached = (o: Opportunity, s: FunnelStage) => {
    const idx = o.stage === "lost" ? FUNNEL_ORDER.indexOf("proposal") : FUNNEL_ORDER.indexOf(o.stage);
    return idx >= FUNNEL_ORDER.indexOf(s);
  };
  return FUNNEL_ORDER.map((s, i) => {
    const count = opps.filter((o) => reached(o, s)).length;
    const prev = i === 0 ? count : opps.filter((o) => reached(o, FUNNEL_ORDER[i - 1])).length;
    return { stage: s, count, conv: prev ? count / prev : 0 };
  });
}

export function winLoss(opps: Opportunity[]) {
  const closed = opps.filter((o) => o.stage === "won" || o.stage === "lost");
  const won = closed.filter((o) => o.stage === "won");
  const reasons = new Map<LossReason, number>();
  closed.forEach((o) => o.loss_reason && reasons.set(o.loss_reason, (reasons.get(o.loss_reason) ?? 0) + 1));
  return {
    closed: closed.length,
    won: won.length,
    winRate: closed.length ? won.length / closed.length : 0,
    wonValue: won.reduce((a, o) => a + o.value_usd, 0),
    wonGP: won.reduce((a, o) => a + o.value_usd * o.gross_margin, 0),
    reasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    withReason: closed.filter((o) => o.stage === "won" || o.loss_reason).length / (closed.length || 1),
  };
}

export function groupWinRate<K extends string>(opps: Opportunity[], key: (o: Opportunity) => K | undefined) {
  const m = new Map<K, { won: number; closed: number; gp: number; total: number }>();
  for (const o of opps) {
    const k = key(o);
    if (!k) continue;
    const r = m.get(k) ?? { won: 0, closed: 0, gp: 0, total: 0 };
    r.total++;
    if (o.stage === "won" || o.stage === "lost") r.closed++;
    if (o.stage === "won") {
      r.won++;
      r.gp += o.value_usd * o.gross_margin;
    }
    m.set(k, r);
  }
  return [...m.entries()].map(([k, r]) => ({ key: k, ...r, winRate: r.closed ? r.won / r.closed : 0 }));
}

/** Intel-assisted vs control: conversion from target → meeting and win rate. */
export function intelLift(opps: Opportunity[]) {
  const calc = (xs: Opportunity[]) => {
    const meeting = xs.filter((o) => FUNNEL_ORDER.indexOf(o.stage === "lost" ? "proposal" : o.stage) >= FUNNEL_ORDER.indexOf("meeting")).length;
    const wl = winLoss(xs);
    return { n: xs.length, meetingRate: xs.length ? meeting / xs.length : 0, winRate: wl.winRate, gpPerTarget: xs.length ? wl.wonGP / xs.length : 0 };
  };
  const a = calc(opps.filter((o) => o.intel_assisted));
  const c = calc(opps.filter((o) => !o.intel_assisted));
  return { assisted: a, control: c, gpLift: c.gpPerTarget ? a.gpPerTarget / c.gpPerTarget - 1 : 0 };
}

// ───────────────── Weight validation ─────────────────
export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    dx = 0,
    dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : NaN;
}

/** Back-test: does the attractiveness score track observed win-rate × contribution margin? */
export function backtest(markets: MarketCombo[], weights: Weights["market"]) {
  const rows = markets.filter((m) => m.win_rate != null && m.contribution_margin != null);
  const xs = rows.map((m) => marketScore(m, weights));
  const ys = rows.map((m) => (m.win_rate ?? 0) * (m.contribution_margin ?? 0));
  return { n: rows.length, r: pearson(xs, ys), points: rows.map((m, i) => ({ id: m.id, score: xs[i], outcome: ys[i] })) };
}

export function arenaThreat(competitors: Competitor[], arena: Arena, w?: Weights["threat"]) {
  return competitors
    .filter((c) => c.arenas.includes(arena))
    .map((c) => ({ c, t: threatScore(c, w) }))
    .sort((a, b) => b.t.score - a.t.score);
}
