"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ExternalLink, Plus, Printer, Trash2 } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { useIntel } from "@/lib/store";
import { groupWinRate, threatScore } from "@/lib/scoring";
import { ARENA_LABEL, COUNTRY_FLAG, LOSS_LABEL, PRICE_TYPE_LABEL } from "@/lib/labels";
import type { Battlecard, Competitor, Verification } from "@/lib/types";
import { Badge, Button, Card, ConfidenceBadge, Empty, Input, PageHeader, ProvenanceLine, Select, Slider, Stat, UrgencyBadge, pct } from "@/components/ui";

export default function CompetitorDetail() {
  const { id } = useParams<{ id: string }>();
  const { state, set } = useIntel();
  const c = state.competitors.find((x) => x.id === id);
  if (!c) return <Empty>Competitor not found. <Link href="/competitors" className="text-brand-600">Back</Link></Empty>;

  const t = threatScore(c, state.weights.threat);
  const update = (patch: Partial<Competitor>) => set("competitors", (xs) => xs.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
  const prices = state.pricing.filter((p) => p.entity_id === c.id);
  const sigs = state.signals.filter((s) => s.entity_id === c.id);
  const obs = state.observations.filter((o) => o.entity_id === c.id);
  const deals = state.opportunities.filter((o) => o.competitor_id === c.id);
  const h2h = groupWinRate(deals, () => "all")[0];
  const losses = deals.filter((o) => o.loss_reason).reduce<Record<string, number>>((acc, o) => ((acc[o.loss_reason!] = (acc[o.loss_reason!] ?? 0) + 1), acc), {});
  const radar = [
    { k: "Customer overlap", v: c.threat_inputs.customer_overlap },
    { k: "Service overlap", v: c.threat_inputs.service_overlap },
    { k: "Presence", v: c.threat_inputs.market_presence },
    { k: "Price pressure", v: c.threat_inputs.pricing_pressure },
    { k: "Growth", v: c.threat_inputs.growth_signals },
  ];

  return (
    <div className="space-y-6">
      <Link href="/competitors" className="no-print inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Competitors</Link>
      <PageHeader
        title={c.name}
        subtitle={c.positioning}
        actions={
          <>
            {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-ink-2 shadow-sm hover:bg-chip">Website <ExternalLink className="h-3.5 w-3.5" /></a>}
            <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print battlecard</Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Badge tone={c.tier === "tier1" ? "red" : c.tier === "tier2" ? "amber" : "violet"}>{c.tier}</Badge>
        <Badge>{c.kind}</Badge>
        {c.arenas.map((a) => <Badge key={a} tone="blue">{ARENA_LABEL[a]}</Badge>)}
        {c.countries.map((k) => <Badge key={k}>{COUNTRY_FLAG[k]} {k}</Badge>)}
      </div>
      <ProvenanceLine p={c.provenance} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Threat score" value={t.score} tone={t.score >= 70 ? "bad" : t.score >= 55 ? "warn" : "default"} sub={t.insufficient ? `ceiling ${t.ceiling} (thin evidence)` : "weighted 1–5 inputs"} />
        <Stat label="Confidence" value={<ConfidenceBadge c={t.confidence} />} sub={`${Math.round(c.evidence_coverage * 100)}% fields evidenced`} />
        <Stat label="Head-to-head win rate" value={h2h?.closed ? pct(h2h.winRate) : "—"} sub={`${h2h?.closed ?? 0} closed deals`} />
        <Stat label="HQ / size" value={<span className="text-base">{c.hq}</span>} sub={c.size_band} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Threat inputs" subtitle="Adjust as evidence arrives; score recalculates">
          <div className="h-48">
            <ResponsiveContainer>
              <RadarChart data={radar} outerRadius="70%">
                <PolarGrid stroke="var(--line)" />
                <PolarAngleAxis dataKey="k" tick={{ fontSize: 10, fill: "var(--muted)" }} />
                <Radar dataKey="v" stroke="var(--chart-6)" fill="var(--chart-6)" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {(Object.keys(c.threat_inputs) as (keyof Competitor["threat_inputs"])[]).map((k) => (
              <Slider key={k} label={k.replace(/_/g, " ")} min={1} max={5} step={1} value={c.threat_inputs[k]} onChange={(v) => update({ threat_inputs: { ...c.threat_inputs, [k]: v } })} />
            ))}
            <Slider label="Evidence coverage" min={0} max={1} step={0.05} value={c.evidence_coverage} onChange={(v) => update({ evidence_coverage: v })} format={(v) => pct(v)} />
            <Select
              label="Verification"
              value={c.provenance.verification_status}
              onChange={(v: Verification) => update({ provenance: { ...c.provenance, verification_status: v, last_reviewed_at: new Date().toISOString().slice(0, 10) } })}
              options={["verified", "pending", "unverified", "disputed"].map((v) => ({ value: v as Verification, label: v }))}
            />
          </div>
        </Card>

        <Card className="lg:col-span-2" title="Battlecard" subtitle="Sales-ready positioning. Edit inline; every claim should cite evidence.">
          <div className="mb-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-700"><b>Implication for Hexa:</b> {c.implication}</div>
          <div className="grid gap-5 md:grid-cols-2">
            <ListEditor title="Why we win" tone="green" items={c.battlecard.why_we_win} onChange={(v) => update({ battlecard: { ...c.battlecard, why_we_win: v } })} />
            <ListEditor title="Why we lose" tone="red" items={c.battlecard.why_we_lose} onChange={(v) => update({ battlecard: { ...c.battlecard, why_we_lose: v } })} />
            <ListEditor title="Their strengths" tone="amber" items={c.strengths} onChange={(v) => update({ strengths: v })} />
            <ListEditor title="Their weaknesses (hypotheses)" tone="blue" items={c.weaknesses} onChange={(v) => update({ weaknesses: v })} />
            <ListEditor title="Landmine questions" tone="violet" items={c.battlecard.landmines} onChange={(v) => update({ battlecard: { ...c.battlecard, landmines: v } })} />
            <ListEditor title="Proof points" tone="slate" items={c.battlecard.proof_points} onChange={(v) => update({ battlecard: { ...c.battlecard, proof_points: v } })} />
          </div>
          <Objections card={c.battlecard} onChange={(b) => update({ battlecard: b })} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Pricing observations" pad={false}>
          {prices.length ? (
            <ul className="divide-y divide-line">
              {prices.map((p) => (
                <li key={p.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">{p.currency} {p.observed_value.toLocaleString()}</span>
                    <Badge tone="blue">{PRICE_TYPE_LABEL[p.price_type]}</Badge>
                  </div>
                  <div className="text-xs text-muted">{p.service} · {p.unit} · {p.country}</div>
                  <div className="mt-1 flex flex-wrap gap-1">{p.scope.map((s) => <Badge key={s}>{s}</Badge>)}</div>
                </li>
              ))}
            </ul>
          ) : <div className="p-5"><Empty>No price observations yet</Empty></div>}
        </Card>
        <Card title="Signals" pad={false}>
          {sigs.length ? (
            <ul className="divide-y divide-line">
              {sigs.map((s) => (
                <li key={s.id} className="px-5 py-3">
                  <div className="flex items-center gap-2"><UrgencyBadge u={s.urgency} /><span className="text-sm font-medium text-ink">{s.title}</span></div>
                  <div className="mt-0.5 text-xs text-muted">{s.recommended_action}</div>
                </li>
              ))}
            </ul>
          ) : <div className="p-5"><Empty>No signals</Empty></div>}
        </Card>
        <Card title="Win/loss vs this competitor">
          {Object.keys(losses).length ? (
            <ul className="space-y-2">
              {Object.entries(losses).sort((a, b) => b[1] - a[1]).map(([r, n]) => (
                <li key={r} className="flex justify-between text-sm"><span className="text-ink-2">{LOSS_LABEL[r as keyof typeof LOSS_LABEL]}</span><Badge tone="red">{n}</Badge></li>
              ))}
            </ul>
          ) : <Empty>No recorded losses</Empty>}
          <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
            Evidence log: {obs.length} observation{obs.length === 1 ? "" : "s"} · <Link href="/research" className="text-brand-600 hover:underline">add evidence</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ListEditor({ title, items, onChange, tone }: { title: string; items: string[]; onChange: (v: string[]) => void; tone: "green" | "red" | "amber" | "blue" | "violet" | "slate" }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <div className="mb-1.5"><Badge tone={tone}>{title}</Badge></div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="group flex items-start gap-2 text-sm text-ink-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-subtle" />
            <span className="flex-1">{it}</span>
            <button className="no-print text-subtle opacity-0 hover:text-bad group-hover:opacity-100" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
      <form className="no-print mt-1.5 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { onChange([...items, draft.trim()]); setDraft(""); } }}>
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add…" className="py-1 text-xs" />
        <Button size="sm" type="submit"><Plus className="h-3 w-3" /></Button>
      </form>
    </div>
  );
}

function Objections({ card, onChange }: { card: Battlecard; onChange: (b: Battlecard) => void }) {
  const [o, setO] = useState("");
  const [r, setR] = useState("");
  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Objection handling</div>
      <div className="space-y-2">
        {card.objections.map((x, i) => (
          <div key={i} className="group rounded-lg border border-line p-3">
            <div className="flex justify-between gap-2">
              <div className="text-sm font-medium text-ink">{x.objection}</div>
              <button className="no-print text-subtle opacity-0 hover:text-bad group-hover:opacity-100" onClick={() => onChange({ ...card, objections: card.objections.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="mt-1 text-sm text-ink-2">→ {x.response}</div>
          </div>
        ))}
      </div>
      <form className="no-print mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]" onSubmit={(e) => { e.preventDefault(); if (o && r) { onChange({ ...card, objections: [...card.objections, { objection: o, response: r }] }); setO(""); setR(""); } }}>
        <Input value={o} onChange={(e) => setO(e.target.value)} placeholder="Objection" />
        <Input value={r} onChange={(e) => setR(e.target.value)} placeholder="Response" />
        <Button type="submit">Add</Button>
      </form>
    </div>
  );
}
