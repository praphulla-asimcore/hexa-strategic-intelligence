import type { IntelState } from "./store";
import { rankedAccounts, rankedMarkets, recommendations, whereToWin } from "./insights";
import { threatScore, winLoss } from "./scoring";
import { ARENA_LABEL, COUNTRY_LABEL, LOSS_LABEL, PRICE_TYPE_LABEL } from "./labels";

/** Offline, rule-based analyst used when no LLM key is configured. Grounded only in platform data. */
export function localAnswer(s: IntelState, q: string): string {
  const t = q.toLowerCase();
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const comp = s.competitors.find((c) => {
    const name = c.name.toLowerCase();
    if (c.tier === "substitute") return t.includes(name);
    const first = name.split(/[\s(]/)[0];
    return t.includes(name) || (first.length >= 3 && new RegExp(`\\b${esc(first)}\\b`).test(t));
  });
  const out: string[] = [];

  const central = /win (profitable )?business next|where can hexa win|what must we do|central question/.test(t);

  if (comp && !central) {
    const th = threatScore(comp, s.weights.threat);
    out.push(`**${comp.name}** (${comp.tier}, ${comp.kind}) — threat **${th.score}/100**, ${th.confidence} confidence, ${Math.round(th.coverage * 100)}% evidence coverage${th.insufficient ? ` (thin evidence; could be up to ${th.ceiling})` : ""}.`);
    out.push(`Positioning: ${comp.positioning}`);
    out.push(`Implication for Hexa: ${comp.implication}`);
    if (comp.battlecard.why_we_win.length) out.push(`Why we win:\n${comp.battlecard.why_we_win.map((x) => `- ${x}`).join("\n")}`);
    if (comp.battlecard.objections.length) out.push(`Key objection: ${comp.battlecard.objections[0].objection} → ${comp.battlecard.objections[0].response}`);
    const p = s.pricing.filter((x) => x.entity_id === comp.id);
    if (p.length) out.push(`Pricing on file:\n${p.map((x) => `- ${x.currency} ${x.observed_value} ${x.unit} (${PRICE_TYPE_LABEL[x.price_type]}, ${x.provenance.verification_status})`).join("\n")}`);
    out.push(`Source: ${comp.website || "—"} · status ${comp.provenance.verification_status}`);
    return out.join("\n\n");
  }

  if (!central && /price|pricing|quote|fee|margin|cost/.test(t)) {
    out.push("**Pricing position (scope matters more than headline):**");
    for (const a of ["eor_payroll", "finance_outsourcing"] as const) {
      const xs = s.pricing.filter((p) => p.arena === a);
      if (!xs.length) continue;
      out.push(`*${ARENA_LABEL[a]}*\n${xs.map((p) => `- ${p.entity_id === "hexa" ? "Hexa" : s.competitors.find((c) => c.id === p.entity_id)?.name}: ${p.currency} ${p.observed_value.toLocaleString()} ${p.unit} — ${p.scope.length} scope items (${PRICE_TYPE_LABEL[p.price_type]}, ${p.provenance.verification_status})`).join("\n")}`);
    }
    out.push("Use Pricing → Contribution margin model to test price against delivery cost and in-house alternative. Competitor rates need re-verification before commercial use.");
    return out.join("\n\n");
  }

  if (!central && /account|target|prospect|who should|outreach|decision.?maker|firms/.test(t)) {
    const country = (Object.keys(COUNTRY_LABEL) as (keyof typeof COUNTRY_LABEL)[]).find((k) => t.includes(COUNTRY_LABEL[k].toLowerCase()));
    const xs = rankedAccounts(s).filter(({ a }) => !country || a.country === country).slice(0, 10);
    out.push(`**Top ${xs.length} accounts by propensity${country ? ` in ${COUNTRY_LABEL[country]}` : ""}:**`);
    out.push(xs.map(({ a, p }) => `- **${a.name}** — ${p.score} (tier ${p.tier}). Why now: ${a.why_now} Verified decision-maker: ${a.contacts.some((c) => c.verified && c.influence === "decision_maker") ? "yes" : "no"}.`).join("\n"));
    if (!xs.length) out.push("No accounts yet — use Accounts → Find accounts (Apollo) to import real targets.");
    return out.join("\n\n");
  }

  if (!central && /loss|lose|lost|win rate|won|convert/.test(t)) {
    const wl = winLoss(s.opportunities);
    out.push(`**Win/loss:** ${wl.won} of ${wl.closed} closed deals won (${(wl.winRate * 100).toFixed(1)}%).`);
    out.push(`Top loss reasons:\n${wl.reasons.slice(0, 5).map((r) => `- ${LOSS_LABEL[r.reason]}: ${r.count}`).join("\n")}`);
    if (!wl.closed) out.push("No closed deals logged yet — log deals and outcomes in Sales.");
    return out.join("\n\n");
  }

  if (!central && /signal|changed?|alert|happen|moves?/.test(t)) {
    const xs = s.signals.filter((x) => x.status !== "dismissed").slice(0, 8);
    out.push("**What changed / needs attention:**");
    out.push(xs.map((x) => `- [${x.urgency}] ${x.title} → ${x.recommended_action} (${x.owner}, due ${x.due_date})`).join("\n"));
    return out.join("\n\n");
  }

  if (!central && /market|country|where|attractive|segment/.test(t)) {
    out.push("**Market attractiveness ranking:**");
    out.push(rankedMarkets(s).slice(0, 8).map(({ m, score }) => `- ${COUNTRY_LABEL[m.country]} · ${ARENA_LABEL[m.arena]} · ${m.segment}: **${score.toFixed(0)}** — ${m.notes}`).join("\n"));
    out.push("Weights are design assumptions; check Markets → Weight validation.");
    return out.join("\n\n");
  }

  // Default: the central question.
  out.push("**Where can Hexa win profitable business next?** (based on current platform evidence)");
  whereToWin(s, 3).forEach((w, i) => {
    out.push(`${i + 1}. **${COUNTRY_LABEL[w.m.country]} · ${ARENA_LABEL[w.m.arena]} · ${w.m.segment}** — score ${w.score.toFixed(0)}\n   - Against: ${w.rivals.map(({ c, t }) => `${c.name} (${t.score}, ${t.confidence} conf.)`).join(", ") || "—"}\n   - Price: ${w.price ? `Hexa ${w.price.currency} ${w.price.hexa} ${w.price.unit}${w.price.premium != null ? `, ${(w.price.premium * 100).toFixed(0)}% vs observed rivals` : ""}` : "no Hexa price on file"}\n   - Targets: ${w.accounts.map(({ a }) => a.name).join(", ") || "build list"}\n   - Action: ${w.action}`);
  });
  const recs = recommendations(s).slice(0, 4);
  out.push(`**What must we do:**\n${recs.map((r) => `- ${r.title} (${r.owner}, ${r.urgency})`).join("\n")}`);
  out.push("_Uncertainty: market and threat scores are analyst judgements; facts marked pending/unverified need confirmation._");
  return out.join("\n\n");
}
