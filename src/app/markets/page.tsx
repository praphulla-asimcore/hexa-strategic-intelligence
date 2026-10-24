"use client";

import { useMemo, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, LabelList } from "recharts";
import { useIntel } from "@/lib/store";
import { useFocusParam } from "@/lib/hooks";
import { DEFAULT_WEIGHTS, backtest, marketBreakdown, marketScore } from "@/lib/scoring";
import { rivalsFor } from "@/lib/insights";
import { ARENAS, ARENA_LABEL, ARENA_SHORT, COUNTRY_FLAG, COUNTRY_LABEL } from "@/lib/labels";
import type { Arena, CountryCode, MarketCombo, Segment } from "@/lib/types";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, ProvenanceLine, ScoreBar, Select, Slider, Table, Tabs, Td, Textarea, Th, pct } from "@/components/ui";

const COUNTRIES: CountryCode[] = ["AU", "MY", "SG", "ID", "NP", "BD", "UK", "US"];
const SEGMENTS: Segment[] = ["SME", "Mid-market", "Enterprise", "Accounting firms", "Scale-ups"];

export default function Markets() {
  const { state, set } = useIntel();
  const [focus, setFocus] = useFocusParam();
  const [view, setView] = useState<"rank" | "heat" | "bubble">("rank");
  const [adding, setAdding] = useState(false);
  const w = state.weights.market;

  const ranked = useMemo(() => state.markets.map((m) => ({ m, score: marketScore(m, w) })).sort((a, b) => b.score - a.score), [state.markets, w]);
  const bt = backtest(state.markets, w);
  const btDefault = backtest(state.markets, DEFAULT_WEIGHTS.market);
  const sel = state.markets.find((m) => m.id === focus);
  const setW = (k: keyof typeof w, v: number) => set("weights", (x) => ({ ...x, market: { ...x.market, [k]: v } }));
  const total = Object.values(w).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Markets"
        subtitle="Attractiveness by country × service × customer segment. Score = 20 × (demand·w + margin·w + access·w + (6 − intensity)·w + readiness·w). Weights are design assumptions — test them against actual win rates and margins."
        actions={<Button variant="primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add combination</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Model weights" subtitle={`Normalised automatically (current sum ${total.toFixed(2)})`} actions={<Button size="sm" variant="ghost" onClick={() => set("weights", (x) => ({ ...x, market: DEFAULT_WEIGHTS.market }))}><RotateCcw className="h-3 w-3" /> Default</Button>}>
          <div className="space-y-3">
            <Slider label="Market demand" min={0} max={0.6} step={0.05} value={w.demand} onChange={(v) => setW("demand", v)} format={(v) => pct(v / total)} />
            <Slider label="Margin potential" min={0} max={0.6} step={0.05} value={w.margin} onChange={(v) => setW("margin", v)} format={(v) => pct(v / total)} />
            <Slider label="Customer accessibility" min={0} max={0.6} step={0.05} value={w.accessibility} onChange={(v) => setW("accessibility", v)} format={(v) => pct(v / total)} />
            <Slider label="Low competitive intensity" min={0} max={0.6} step={0.05} value={w.intensity} onChange={(v) => setW("intensity", v)} format={(v) => pct(v / total)} />
            <Slider label="Delivery readiness" min={0} max={0.6} step={0.05} value={w.readiness} onChange={(v) => setW("readiness", v)} format={(v) => pct(v / total)} />
          </div>
        </Card>
        <Card title="Weight validation" subtitle="Correlation of score with observed win-rate × contribution margin">
          <div className="flex items-end gap-6">
            <div>
              <div className="text-3xl font-semibold tabular-nums text-ink">{isNaN(bt.r) ? "—" : bt.r.toFixed(2)}</div>
              <div className="text-xs text-muted">Pearson r, current weights (n={bt.n})</div>
            </div>
            <div>
              <div className="text-lg font-semibold tabular-nums text-muted">{isNaN(btDefault.r) ? "—" : btDefault.r.toFixed(2)}</div>
              <div className="text-xs text-muted">default weights</div>
            </div>
          </div>
          <div className="mt-3 h-36">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid />
                <XAxis type="number" dataKey="score" domain={["auto", "auto"]} name="Score" />
                <YAxis type="number" dataKey="outcome" name="Win × margin" tickFormatter={(v) => v.toFixed(2)} />
                <Tooltip />
                <Scatter data={bt.points} fill="var(--chart-1)" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-muted">Outcome data here is illustrative. With n &lt; 20, treat r as directional only.</p>
        </Card>
        <Card title={sel ? "Selected combination" : "Score breakdown"} subtitle={sel ? `${COUNTRY_LABEL[sel.country]} · ${ARENA_LABEL[sel.arena]} · ${sel.segment}` : "Select a row to inspect"}>
          {sel ? <Detail m={sel} /> : <p className="text-sm text-muted">Click any combination to see its factor breakdown, mapped rivals and edit its inputs.</p>}
        </Card>
      </div>

      <Tabs value={view} onChange={setView} tabs={[{ value: "rank", label: "Ranking", count: ranked.length }, { value: "heat", label: "Country × service heatmap" }, { value: "bubble", label: "Size vs attractiveness" }]} />

      {view === "rank" && (
        <Card pad={false}>
          <Table>
            <thead>
              <tr>
                <Th>#</Th><Th>Combination</Th><Th className="w-44">Score</Th><Th>Demand</Th><Th>Margin</Th><Th>Access</Th><Th>Intensity</Th><Th>Readiness</Th><Th>TAM</Th><Th>Reg. risk</Th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ m, score }, i) => (
                <tr key={m.id} onClick={() => setFocus(m.id)} className={`cursor-pointer hover:bg-surface-2 ${focus === m.id ? "bg-brand-50" : ""}`}>
                  <Td className="text-muted">{i + 1}</Td>
                  <Td>
                    <div className="font-medium text-ink">{COUNTRY_FLAG[m.country]} {COUNTRY_LABEL[m.country]} · {ARENA_SHORT[m.arena]}</div>
                    <div className="text-xs text-muted">{m.segment}</div>
                  </Td>
                  <Td><ScoreBar value={score} /></Td>
                  {[m.demand, m.margin, m.accessibility, m.intensity, m.readiness].map((v, j) => (
                    <Td key={j} className="text-center tabular-nums">{v}</Td>
                  ))}
                  <Td className="tabular-nums">{m.addressable_usd_m ? `$${m.addressable_usd_m}m` : "—"}</Td>
                  <Td><Badge tone={m.regulatory_risk === "high" ? "red" : m.regulatory_risk === "medium" ? "amber" : "green"}>{m.regulatory_risk}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {view === "heat" && <Heatmap ranked={ranked} onPick={setFocus} />}

      {view === "bubble" && (
        <Card title="Addressable size vs attractiveness" subtitle="Bubble size = margin potential. Upper-right: large and attractive.">
          <div className="h-[420px]">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 0 }}>
                <CartesianGrid />
                <XAxis type="number" dataKey="tam" scale="log" domain={[5, 1200]} name="TAM $m" label={{ value: "Addressable demand (US$m, log)", position: "insideBottom", offset: -10 }} />
                <YAxis type="number" dataKey="score" domain={[40, 90]} name="Score" />
                <ZAxis type="number" dataKey="margin" range={[80, 500]} />
                <Tooltip />
                <Scatter data={ranked.map(({ m, score }) => ({ name: `${m.country} ${ARENA_SHORT[m.arena]} ${m.segment}`, tam: m.addressable_usd_m ?? 5, score, margin: m.margin }))} fill="var(--chart-1)" fillOpacity={0.5}>
                  <LabelList dataKey="name" position="top" style={{ fontSize: 9, fill: "var(--muted)" }} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <AddMarket open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function Heatmap({ ranked, onPick }: { ranked: { m: MarketCombo; score: number }[]; onPick: (id: string) => void }) {
  return (
    <Card title="Best segment score per country × service" subtitle="Blank = combination not yet researched" pad={false}>
      <Table>
        <thead>
          <tr><Th>Service</Th>{COUNTRIES.map((c) => <Th key={c} className="text-center">{COUNTRY_FLAG[c]} {c}</Th>)}</tr>
        </thead>
        <tbody>
          {ARENAS.map((a) => (
            <tr key={a}>
              <Td className="font-medium text-ink">{ARENA_LABEL[a]}</Td>
              {COUNTRIES.map((c) => {
                const best = ranked.filter((r) => r.m.arena === a && r.m.country === c).sort((x, y) => y.score - x.score)[0];
                if (!best) return <Td key={c} className="text-center text-subtle">·</Td>;
                const t = (best.score - 40) / 50;
                return (
                  <Td key={c} className="text-center">
                    <button onClick={() => onPick(best.m.id)} className="w-full rounded-md px-2 py-2 text-sm font-semibold tabular-nums text-ink" style={{ background: `color-mix(in srgb, var(--good) ${Math.max(8, t * 70)}%, transparent)` }} title={best.m.segment}>
                      {best.score.toFixed(0)}
                      <div className="text-[9px] font-normal text-muted">{best.m.segment}</div>
                    </button>
                  </Td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function Detail({ m }: { m: MarketCombo }) {
  const { state, set } = useIntel();
  const br = marketBreakdown(m, state.weights.market);
  const rivals = rivalsFor(state, m.arena, m.country).slice(0, 5);
  const upd = (patch: Partial<MarketCombo>) => set("markets", (xs) => xs.map((x) => (x.id === m.id ? { ...x, ...patch } : x)));
  return (
    <div className="space-y-3">
      <div className="h-32">
        <ResponsiveContainer>
          <BarChart data={br} margin={{ left: -20 }}>
            <XAxis dataKey="factor" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip formatter={(v: number) => v.toFixed(1)} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>{br.map((_, i) => <Cell key={i} fill={`var(--chart-${(i % 5) + 1})`} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-ink-2">{m.notes}</p>
      <div className="flex flex-wrap gap-1">{rivals.map(({ c, t }) => <Badge key={c.id} tone={t.score >= 70 ? "red" : "amber"}>{c.name} {t.score}</Badge>)}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {(["demand", "margin", "accessibility", "intensity", "readiness"] as const).map((k) => (
          <Slider key={k} label={k} min={1} max={5} step={1} value={m[k]} onChange={(v) => upd({ [k]: v })} />
        ))}
      </div>
      <ProvenanceLine p={m.provenance} />
    </div>
  );
}

function AddMarket({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { set } = useIntel();
  const [f, setF] = useState({ country: "AU" as CountryCode, arena: "finance_outsourcing" as Arena, segment: "SME" as Segment, notes: "", tam: "" });
  return (
    <Modal open={open} onClose={onClose} title="Add market combination">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Country"><Select value={f.country} onChange={(v) => setF({ ...f, country: v })} options={COUNTRIES.map((c) => ({ value: c, label: COUNTRY_LABEL[c] }))} /></Field>
        <Field label="Service"><Select value={f.arena} onChange={(v) => setF({ ...f, arena: v })} options={ARENAS.map((a) => ({ value: a, label: ARENA_SHORT[a] }))} /></Field>
        <Field label="Segment"><Select value={f.segment} onChange={(v) => setF({ ...f, segment: v })} options={SEGMENTS.map((s) => ({ value: s, label: s }))} /></Field>
        <div className="sm:col-span-3"><Field label="Addressable demand (US$m)"><Input type="number" value={f.tam} onChange={(e) => setF({ ...f, tam: e.target.value })} /></Field></div>
        <div className="sm:col-span-3"><Field label="Notes"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => {
            const id = `${f.country}-${f.arena}-${f.segment}`.toLowerCase().replace(/\s+/g, "-");
            set("markets", (xs) => (xs.some((x) => x.id === id) ? xs : [...xs, { id, country: f.country, arena: f.arena, segment: f.segment, demand: 3, margin: 3, accessibility: 3, intensity: 3, readiness: 3, addressable_usd_m: f.tam ? +f.tam : undefined, regulatory_risk: "medium", notes: f.notes || "New — score inputs to research", provenance: { source_type: "analyst_estimate", observed_at: new Date().toISOString().slice(0, 10), confidence: "low", verification_status: "unverified", analyst: "You" } }]));
            onClose();
          }}
        >
          Add
        </Button>
      </div>
    </Modal>
  );
}
