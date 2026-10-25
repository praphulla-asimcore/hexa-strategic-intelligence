import type { IntelState } from "./store";
import type { Arena, Urgency } from "./types";
import { ARENA_LABEL, COUNTRY_LABEL, LOSS_LABEL } from "./labels";
import { funnel, intelLift, marketScore, propensity, threatScore, winLoss } from "./scoring";

export interface Recommendation {
  id: string;
  title: string;
  rationale: string;
  owner: string;
  urgency: Urgency;
  impact: number; // 1–5
  evidence: string[];
  href?: string;
}

export function rankedMarkets(s: IntelState) {
  return [...s.markets]
    .map((m) => ({ m, score: marketScore(m, s.weights.market) }))
    .sort((a, b) => b.score - a.score);
}

export function rankedAccounts(s: IntelState) {
  return s.accounts
    .filter((a) => a.status !== "disqualified" && a.status !== "customer")
    .map((a) => ({ a, p: propensity(a, s.signals, s.weights.propensity) }))
    .sort((x, y) => y.p.score - x.p.score);
}

export function rivalsFor(s: IntelState, arena: Arena, country: string) {
  return s.competitors
    .filter((c) => c.arenas.includes(arena) && c.countries.includes(country as never))
    .map((c) => ({ c, t: threatScore(c, s.weights.threat) }))
    .sort((a, b) => b.t.score - a.t.score);
}

/** Answers the central question for the top N market combinations. */
export function whereToWin(s: IntelState, n = 3) {
  return rankedMarkets(s)
    .slice(0, n)
    .map(({ m, score }) => {
      const rivals = rivalsFor(s, m.arena, m.country).slice(0, 3);
      const hexa = s.pricing.find((p) => p.entity_id === "hexa" && p.arena === m.arena);
      const comps = s.pricing.filter((p) => p.entity_id !== "hexa" && p.arena === m.arena && p.currency === hexa?.currency);
      const avgComp = comps.length ? comps.reduce((a, p) => a + p.observed_value, 0) / comps.length : undefined;
      const accounts = rankedAccounts(s)
        .filter(({ a }) => a.country === m.country && a.target_arena === m.arena)
        .slice(0, 3);
      return {
        m,
        score,
        rivals,
        price: hexa
          ? { hexa: hexa.observed_value, currency: hexa.currency, unit: hexa.unit, avgComp, premium: avgComp ? hexa.observed_value / avgComp - 1 : undefined, scope: hexa.scope.length, compScope: comps.length ? comps.reduce((a, p) => a + p.scope.length, 0) / comps.length : undefined }
          : undefined,
        accounts,
        action: `Prioritise ${ARENA_LABEL[m.arena].toLowerCase()} for ${m.segment.toLowerCase()} in ${COUNTRY_LABEL[m.country]}${rivals[0] ? `; position against ${rivals[0].c.name}` : ""}${accounts[0] ? `; start with ${accounts[0].a.name}` : ""}.`,
      };
    });
}

export function recommendations(s: IntelState): Recommendation[] {
  const recs: Recommendation[] = [];
  const top = rankedMarkets(s);

  // 1. Markets with high attractiveness but low delivery readiness → capacity investment.
  top
    .filter(({ m, score }) => score >= 65 && m.readiness <= 3)
    .slice(0, 2)
    .forEach(({ m, score }) =>
      recs.push({
        id: `rec-ready-${m.id}`,
        title: `Build delivery readiness for ${COUNTRY_LABEL[m.country]} ${ARENA_LABEL[m.arena]}`,
        rationale: `Attractiveness ${score.toFixed(0)}/100 but readiness only ${m.readiness}/5. Validate skills and hiring lead time before scaling outbound.`,
        owner: "Delivery / Finance",
        urgency: "medium",
        impact: 4,
        evidence: [m.id],
        href: "/markets",
      }),
    );

  // 2. High-threat competitors with thin evidence → research.
  s.competitors
    .map((c) => ({ c, t: threatScore(c, s.weights.threat) }))
    .filter(({ t }) => t.score >= 65 && t.coverage < 0.4)
    .slice(0, 3)
    .forEach(({ c, t }) =>
      recs.push({
        id: `rec-research-${c.id}`,
        title: `Close evidence gap on ${c.name}`,
        rationale: `Threat ${t.score}/100 with only ${(t.coverage * 100).toFixed(0)}% evidence coverage — potential ceiling ${t.ceiling}. Thin data must not be read as low risk.`,
        owner: "Intelligence analyst",
        urgency: "high",
        impact: 4,
        evidence: [c.id],
        href: `/competitors/${c.id}`,
      }),
    );

  // 3. Critical/high unactioned signals.
  s.signals
    .filter((x) => (x.urgency === "critical" || x.urgency === "high") && x.status !== "actioned" && x.status !== "dismissed")
    .slice(0, 4)
    .forEach((x) =>
      recs.push({
        id: `rec-sig-${x.id}`,
        title: x.recommended_action,
        rationale: `${x.title} — due ${x.due_date}.`,
        owner: x.owner,
        urgency: x.urgency,
        impact: x.impact,
        evidence: [x.id, ...(x.provenance.source_url ? [x.provenance.source_url] : [])],
        href: `/alerts?focus=${x.id}`,
      }),
    );

  // 4. Dominant loss reason.
  const wl = winLoss(s.opportunities);
  const topLoss = wl.reasons[0];
  if (topLoss && wl.closed > 0 && topLoss.count / wl.closed > 0.12) {
    recs.push({
      id: "rec-loss",
      title: `Address top loss reason: ${LOSS_LABEL[topLoss.reason]}`,
      rationale: `${topLoss.count} of ${wl.closed} closed deals lost to "${LOSS_LABEL[topLoss.reason]}". ${topLoss.reason === "price" ? "Run scope-normalised price comparison and refresh pricing objection handling." : "Update battlecards and qualification criteria."}`,
      owner: topLoss.reason === "price" ? "Finance" : "BizDev",
      urgency: "high",
      impact: 4,
      evidence: ["sales: win/loss"],
      href: "/sales",
    });
  }

  // 5. Top accounts with no verified decision-maker.
  rankedAccounts(s)
    .filter(({ a, p }) => p.tier === "A" && !a.contacts.some((c) => c.verified && c.influence === "decision_maker"))
    .slice(0, 2)
    .forEach(({ a, p }) =>
      recs.push({
        id: `rec-dm-${a.id}`,
        title: `Verify decision-maker at ${a.name}`,
        rationale: `Tier-A propensity (${p.score}) but no verified decision-maker. ${a.why_now}`,
        owner: "BizDev",
        urgency: "high",
        impact: 3,
        evidence: [a.id],
        href: `/accounts?focus=${a.id}`,
      }),
    );

  // 6. Unverified pricing used in comparisons.
  const unverified = s.pricing.filter((p) => p.provenance.verification_status !== "verified" && p.entity_id !== "hexa").length;
  if (unverified)
    recs.push({
      id: "rec-price-verify",
      title: `Verify ${unverified} competitor price observations`,
      rationale: "Pricing comparisons use unverified observations. Re-verify headline rates and tag scope before commercial use.",
      owner: "Finance",
      urgency: "medium",
      impact: 3,
      evidence: ["pricing"],
      href: "/pricing",
    });

  const order: Record<Urgency, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return recs.sort((a, b) => order[a.urgency] - order[b.urgency] || b.impact - a.impact);
}

export function kpis(s: IntelState) {
  const verifiedProfiles = s.competitors.filter((c) => c.provenance.verification_status === "verified").length;
  const pending = s.competitors.filter((c) => c.provenance.verification_status === "pending").length;
  const avgCoverage = s.competitors.reduce((a, c) => a + c.evidence_coverage, 0) / s.competitors.length;
  const wl = winLoss(s.opportunities);
  const qualified = rankedAccounts(s).filter(({ p }) => p.tier !== "C").length;
  const lift = intelLift(s.opportunities);
  const pipeline = s.opportunities.filter((o) => ["meeting", "qualified", "proposal"].includes(o.stage));
  const overdueTasks = s.tasks.filter((t) => t.status !== "done" && t.due < new Date().toISOString().slice(0, 10)).length;
  const highImpactObs = s.observations.length;
  const traceable = s.observations.filter((o) => !!o.source_url).length;
  return {
    monitored: s.competitors.length,
    verifiedProfiles,
    pending,
    avgCoverage,
    combos: s.markets.length,
    newSignals: s.signals.filter((x) => x.status === "new").length,
    qualified,
    winRate: wl.winRate,
    wonGP: wl.wonGP,
    pipelineValue: pipeline.reduce((a, o) => a + o.value_usd, 0),
    pipelineGP: pipeline.reduce((a, o) => a + o.value_usd * o.gross_margin, 0),
    openTasks: s.tasks.filter((t) => t.status !== "done").length,
    overdueTasks,
    lift,
    traceablePct: highImpactObs ? traceable / highImpactObs : 0,
    withReasonPct: wl.withReason,
    funnel: funnel(s.opportunities),
  };
}

/** Plain-text context fed to the AI analyst; keeps answers grounded in platform data. */
export function buildContext(s: IntelState) {
  const markets = rankedMarkets(s)
    .map(({ m, score }) => `- ${m.id}: score ${score} | demand ${m.demand} margin ${m.margin} access ${m.accessibility} intensity ${m.intensity} readiness ${m.readiness} | TAM~$${m.addressable_usd_m}m | ${m.notes} [${m.provenance.verification_status}]`)
    .join("\n");
  const comps = s.competitors
    .map((c) => {
      const t = threatScore(c, s.weights.threat);
      return `- ${c.name} (${c.tier}, ${c.kind}) arenas=${c.arenas.join("/")} countries=${c.countries.join("/")} threat=${t.score} conf=${t.confidence} coverage=${Math.round(t.coverage * 100)}% | ${c.positioning} | Implication: ${c.implication} | url=${c.website} [${c.provenance.verification_status}]`;
    })
    .join("\n");
  const prices = s.pricing
    .map((p) => `- ${p.entity_id} ${p.service} ${p.country}: ${p.currency} ${p.observed_value} ${p.unit} (${p.price_type}; scope: ${p.scope.join(", ")}) [${p.provenance.verification_status}, ${p.provenance.confidence}]`)
    .join("\n");
  const accts = rankedAccounts(s)
    .map(({ a, p }) => `- ${a.name} ${a.country} ${a.segment} propensity=${p.score} tier=${p.tier} | why company: ${a.why_company} | why service: ${a.why_service} | why now: ${a.why_now} | incumbent=${a.incumbent ?? "none"}`)
    .join("\n");
  const sigs = s.signals.map((x) => `- [${x.urgency}] ${x.title} → ${x.recommended_action} (owner ${x.owner}, due ${x.due_date}, ${x.status})`).join("\n");
  const wl = winLoss(s.opportunities);
  return `MARKETS (ranked):\n${markets}\n\nCOMPETITORS:\n${comps}\n\nPRICING OBSERVATIONS:\n${prices}\n\nACCOUNTS (ranked):\n${accts}\n\nSIGNALS:\n${sigs}\n\nWIN/LOSS: closed=${wl.closed} won=${wl.won} winRate=${(wl.winRate * 100).toFixed(1)}% topLoss=${wl.reasons
    .slice(0, 3)
    .map((r) => `${r.reason}:${r.count}`)
    .join(", ")}\n\nNOTE: facts show verification status; market/threat scores are analyst judgements; pipeline contains only deals logged by the team (may be empty).`;
}
