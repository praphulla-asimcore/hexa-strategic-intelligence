"use client";

import Link from "next/link";
import { ArrowRight, Bell, Building2, CheckCircle2, Globe2, ShieldAlert, Swords, Target, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useIntel } from "@/lib/store";
import { kpis, rankedMarkets, recommendations, whereToWin } from "@/lib/insights";
import { threatScore } from "@/lib/scoring";
import { ARENA_SHORT, COUNTRY_FLAG, COUNTRY_LABEL, ARENA_LABEL, STAGE_LABEL } from "@/lib/labels";
import { Badge, Card, ConfidenceBadge, PageHeader, ScoreBar, Stat, UrgencyBadge, fmtUsd, pct } from "@/components/ui";

export default function Overview() {
  const { state } = useIntel();
  const k = kpis(state);
  const win = whereToWin(state, 3);
  const recs = recommendations(state).slice(0, 6);
  const mk = rankedMarkets(state).slice(0, 8).map(({ m, score }) => ({ name: `${m.country} ${ARENA_SHORT[m.arena]} · ${m.segment}`, score }));
  const threats = state.competitors
    .filter((c) => c.tier !== "substitute")
    .map((c) => ({ c, t: threatScore(c, state.weights.threat) }))
    .sort((a, b) => b.t.score - a.t.score)
    .slice(0, 6);
  const sigs = [...state.signals].filter((s) => s.status !== "dismissed").sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5);

  const targets = [
    { label: "Priority competitor profiles verified", value: `${k.verifiedProfiles + k.pending}/20`, ok: k.verifiedProfiles >= 20, note: `${k.verifiedProfiles} verified, ${k.pending} pending` },
    { label: "Completeness of required fields", value: pct(k.avgCoverage), ok: k.avgCoverage >= 0.85, note: "target 85%+" },
    { label: "Traceable evidence (high-impact obs.)", value: pct(k.traceablePct), ok: k.traceablePct >= 1, note: "target 100%" },
    { label: "Qualified accounts in pilot", value: `${k.qualified}`, ok: k.qualified >= 20, note: "target 20+" },
    { label: "Closed opps with win/loss reason", value: pct(k.withReasonPct), ok: k.withReasonPct >= 0.9, note: "target 90%+" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive overview"
        subtitle="Where can Hexa win profitable business next, against whom, at what price, and what must we do? Every figure links back to evidence and confidence."
        actions={
          <Link href="/brief" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink-2 shadow-sm hover:bg-chip">
            Monday brief <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Stat label="Competitors monitored" value={k.monitored} sub={`${k.verifiedProfiles} verified`} icon={<Swords className="h-4 w-4" />} />
        <Stat label="Evidence coverage" value={pct(k.avgCoverage)} tone={k.avgCoverage < 0.5 ? "warn" : "good"} sub="avg. fields populated" icon={<ShieldAlert className="h-4 w-4" />} />
        <Stat label="Markets ranked" value={k.combos} sub="country × service × segment" icon={<Globe2 className="h-4 w-4" />} />
        <Stat label="New signals" value={k.newSignals} tone={k.newSignals > 5 ? "warn" : "default"} sub="awaiting triage" icon={<Bell className="h-4 w-4" />} />
        <Stat label="Qualified accounts" value={k.qualified} sub="tier A + B propensity" icon={<Building2 className="h-4 w-4" />} />
        <Stat label="Open pipeline" value={fmtUsd(k.pipelineValue)} sub={`${fmtUsd(k.pipelineGP)} expected GP`} icon={<TrendingUp className="h-4 w-4" />} />
        <Stat label="Win rate" value={pct(k.winRate)} sub={`${fmtUsd(k.wonGP)} won GP`} icon={<Target className="h-4 w-4" />} />
        <Stat label="Intel-assisted lift" value={`${k.lift.gpLift >= 0 ? "+" : ""}${pct(k.lift.gpLift)}`} tone={k.lift.gpLift > 0 ? "good" : "bad"} sub="GP / target vs control" icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <Card title="Where to win next" subtitle="Top-ranked market combinations with rivals, price position, target accounts and the next action.">
        <div className="grid gap-4 lg:grid-cols-3">
          {win.map((w, i) => (
            <div key={w.m.id} className="flex flex-col rounded-lg border border-line bg-surface-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">#{i + 1} opportunity</div>
                  <div className="mt-0.5 font-semibold text-ink">
                    {COUNTRY_FLAG[w.m.country]} {COUNTRY_LABEL[w.m.country]} · {ARENA_LABEL[w.m.arena]}
                  </div>
                  <div className="text-xs text-muted">{w.m.segment}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold tabular-nums text-ink">{w.score.toFixed(0)}</div>
                  <div className="text-[10px] text-muted">/ 100</div>
                </div>
              </div>
              <dl className="mt-3 space-y-2 text-xs">
                <div>
                  <dt className="font-medium text-muted">Against whom</dt>
                  <dd className="mt-0.5 flex flex-wrap gap-1">
                    {w.rivals.length ? w.rivals.map(({ c, t }) => (
                      <Link key={c.id} href={`/competitors/${c.id}`}>
                        <Badge tone={t.score >= 70 ? "red" : t.score >= 55 ? "amber" : "slate"}>
                          {c.name} · {t.score}
                        </Badge>
                      </Link>
                    )) : <span className="text-muted">No mapped rivals</span>}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted">At what price</dt>
                  <dd className="mt-0.5 text-ink-2">
                    {w.price ? (
                      <>
                        Hexa {w.price.currency} {w.price.hexa.toLocaleString()} {w.price.unit}
                        {w.price.premium != null && (
                          <> — <b className={w.price.premium > 0 ? "text-warn" : "text-good"}>{w.price.premium > 0 ? "+" : ""}{pct(w.price.premium)}</b> vs avg. observed rival; scope {w.price.scope} vs {w.price.compScope?.toFixed(1)} items</>
                        )}
                      </>
                    ) : (
                      <span className="text-muted">No Hexa price on file</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted">Who to target</dt>
                  <dd className="mt-0.5 text-ink-2">{w.accounts.length ? w.accounts.map(({ a, p }) => `${a.name} (${p.score})`).join(", ") : <span className="text-muted">Build account list</span>}</dd>
                </div>
              </dl>
              <div className="mt-auto pt-3">
                <div className="rounded-md bg-brand-50 px-3 py-2 text-xs text-brand-700">{w.action}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="What to do next" subtitle="Rule-based recommendations ranked by urgency and impact" actions={<Link href="/strategy" className="text-xs font-medium text-brand-600 hover:underline">All →</Link>} pad={false}>
          <ul className="divide-y divide-line">
            {recs.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                <UrgencyBadge u={r.urgency} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{r.href ? <Link href={r.href} className="hover:underline">{r.title}</Link> : r.title}</div>
                  <div className="mt-0.5 text-xs text-muted">{r.rationale}</div>
                </div>
                <span className="whitespace-nowrap text-[11px] text-muted">{r.owner}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="xl:col-span-2" title="Market attractiveness" subtitle="Top 8 combinations (weights editable in Markets)">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={mk} layout="vertical" margin={{ left: 0, right: 16 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {mk.map((d, i) => (
                    <Cell key={i} fill={d.score >= 70 ? "var(--chart-2)" : d.score >= 60 ? "var(--chart-1)" : "var(--chart-3)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Competitive threat" subtitle="Score with confidence; thin evidence shows a risk ceiling" pad={false}>
          <ul className="divide-y divide-line">
            {threats.map(({ c, t }) => (
              <li key={c.id} className="px-5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/competitors/${c.id}`} className="text-sm font-medium text-ink hover:underline">{c.name}</Link>
                  <ConfidenceBadge c={t.confidence} />
                </div>
                <div className="mt-1">
                  <ScoreBar value={t.score} />
                </div>
                {t.insufficient && <div className="mt-0.5 text-[11px] text-warn">Insufficient evidence — could be up to {t.ceiling}</div>}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="What changed" subtitle="Signals by due date" actions={<Link href="/alerts" className="text-xs font-medium text-brand-600 hover:underline">Alerts →</Link>} pad={false}>
          <ul className="divide-y divide-line">
            {sigs.map((s) => (
              <li key={s.id} className="px-5 py-2.5">
                <div className="flex items-center gap-2">
                  <UrgencyBadge u={s.urgency} />
                  <span className="truncate text-sm font-medium text-ink">{s.title}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted">{s.owner} · due {s.due_date}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="90-day measurement framework" subtitle="Blueprint §12 targets">
          <ul className="space-y-3">
            {targets.map((t) => (
              <li key={t.label} className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-ink-2">{t.label}</div>
                  <div className="text-[11px] text-muted">{t.note}</div>
                </div>
                <Badge tone={t.ok ? "green" : "amber"}>{t.value}</Badge>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-2 text-xs font-medium text-muted">Funnel snapshot</div>
            <div className="flex flex-wrap gap-1">
              {k.funnel.filter((_, i) => i % 2 === 0 || i === k.funnel.length - 1).map((f) => (
                <Badge key={f.stage} tone="blue">{STAGE_LABEL[f.stage]}: {f.count}</Badge>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
