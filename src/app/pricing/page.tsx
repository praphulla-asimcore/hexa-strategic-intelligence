"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, Minus, Plus } from "lucide-react";
import { useIntel, uid, today } from "@/lib/store";
import { BASE_SHOCK, SCENARIO_PRESETS, applyShock, forecast, marginModel, winLoss, type MarginInputs, type Shock } from "@/lib/scoring";
import { ARENAS, ARENA_LABEL, ARENA_SHORT, COUNTRY_LABEL, PRICE_TYPE_LABEL } from "@/lib/labels";
import type { Arena, CountryCode, PriceType, PricingObservation } from "@/lib/types";
import { Badge, Button, Card, ConfidenceBadge, Field, Input, Modal, PageHeader, Select, Slider, Stat, Table, Tabs, Td, Th, VerificationBadge, fmtUsd, pct } from "@/components/ui";

type View = "bench" | "margin" | "scenario";

export default function Pricing() {
  const [view, setView] = useState<View>("bench");
  return (
    <div>
      <PageHeader
        title="Pricing & scenarios"
        subtitle="Compare equivalent scope, not headline rates. Published prices, external estimates, competitor quotes and actual Hexa deals are kept as separate types."
      />
      <Tabs value={view} onChange={setView} tabs={[{ value: "bench", label: "Benchmarks & scope" }, { value: "margin", label: "Contribution margin model" }, { value: "scenario", label: "Scenario engine & forecast" }]} />
      {view === "bench" && <Benchmarks />}
      {view === "margin" && <MarginView />}
      {view === "scenario" && <ScenarioView />}
    </div>
  );
}

function Benchmarks() {
  const { state, set } = useIntel();
  const FX_TO_USD = state.fx;
  const [arena, setArena] = useState<Arena>("eor_payroll");
  const [adding, setAdding] = useState(false);
  const obs = state.pricing.filter((p) => p.arena === arena);
  const name = (id: string) => (id === "hexa" ? "Hexa" : state.competitors.find((c) => c.id === id)?.name ?? id);
  const scopeItems = [...new Set(obs.flatMap((p) => p.scope))];
  const chart = obs.map((p) => ({ name: name(p.entity_id), usd: Math.round(p.observed_value * (FX_TO_USD[p.currency] ?? 1)), perScope: Math.round((p.observed_value * (FX_TO_USD[p.currency] ?? 1)) / p.scope.length), hexa: p.entity_id === "hexa" }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select label="Service" value={arena} onChange={setArena} options={ARENAS.map((a) => ({ value: a, label: ARENA_LABEL[a] }))} />
        <Button variant="primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add price observation</Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Headline vs scope-adjusted (USD / month)" subtitle="Scope-adjusted = price ÷ number of included scope items. Crude, but exposes headline-rate traps.">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="usd" name="Headline USD" radius={[4, 4, 0, 0]}>{chart.map((c, i) => <Cell key={i} fill={c.hexa ? "var(--chart-2)" : "var(--chart-1)"} />)}</Bar>
                <Bar dataKey="perScope" name="Per scope item" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Scope comparison" subtitle="What each price actually includes" pad={false}>
          <Table>
            <thead><tr><Th>Scope item</Th>{obs.map((p) => <Th key={p.id} className="text-center">{name(p.entity_id)}</Th>)}</tr></thead>
            <tbody>
              {scopeItems.map((s) => (
                <tr key={s}>
                  <Td className="text-xs">{s}</Td>
                  {obs.map((p) => <Td key={p.id} className="text-center">{p.scope.includes(s) ? <Check className="mx-auto h-4 w-4 text-good" /> : <Minus className="mx-auto h-4 w-4 text-subtle" />}</Td>)}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
      <Card title="Observations" pad={false}>
        <Table>
          <thead><tr><Th>Entity</Th><Th>Service</Th><Th>Type</Th><Th>Price</Th><Th>USD</Th><Th>Market</Th><Th>Evidence</Th><Th>Notes</Th></tr></thead>
          <tbody>
            {obs.map((p) => (
              <tr key={p.id}>
                <Td className="font-medium text-ink">{name(p.entity_id)}</Td>
                <Td className="text-xs">{p.service}</Td>
                <Td><Badge tone={p.price_type === "hexa_deal" ? "green" : p.price_type === "published" ? "blue" : p.price_type === "competitor_quote" ? "violet" : "amber"}>{PRICE_TYPE_LABEL[p.price_type]}</Badge></Td>
                <Td className="whitespace-nowrap tabular-nums">{p.currency} {p.observed_value.toLocaleString()}<div className="text-[11px] text-muted">{p.unit}</div></Td>
                <Td className="tabular-nums">{fmtUsd(p.observed_value * (FX_TO_USD[p.currency] ?? 1))}</Td>
                <Td>{p.country}</Td>
                <Td><div className="flex flex-col gap-1"><ConfidenceBadge c={p.provenance.confidence} /><VerificationBadge v={p.provenance.verification_status} /></div></Td>
                <Td className="max-w-xs text-xs text-muted">{p.notes}{p.provenance.source_url && <> · <a className="text-brand-600 hover:underline" href={p.provenance.source_url} target="_blank" rel="noreferrer">source</a></>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <AddPrice open={adding} onClose={() => setAdding(false)} arena={arena} onAdd={(p) => set("pricing", (xs) => [...xs, p])} />
    </div>
  );
}

function AddPrice({ open, onClose, arena, onAdd }: { open: boolean; onClose: () => void; arena: Arena; onAdd: (p: PricingObservation) => void }) {
  const { state } = useIntel();
  const FX_TO_USD = state.fx;
  const [f, setF] = useState({ entity: "hexa", service: "", type: "published" as PriceType, value: "", unit: "per employee / month", currency: "USD", country: "MY" as CountryCode, scope: "", url: "" });
  return (
    <Modal open={open} onClose={onClose} title={`Add price — ${ARENA_LABEL[arena]}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Entity"><Select value={f.entity} onChange={(v) => setF({ ...f, entity: v })} options={[{ value: "hexa", label: "Hexa" }, ...state.competitors.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
        <Field label="Price type"><Select value={f.type} onChange={(v) => setF({ ...f, type: v })} options={(Object.keys(PRICE_TYPE_LABEL) as PriceType[]).map((k) => ({ value: k, label: PRICE_TYPE_LABEL[k] }))} /></Field>
        <Field label="Service"><Input value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })} /></Field>
        <Field label="Country"><Select value={f.country} onChange={(v) => setF({ ...f, country: v })} options={(["AU", "MY", "SG", "ID", "NP", "UK", "US"] as CountryCode[]).map((c) => ({ value: c, label: c }))} /></Field>
        <Field label="Value"><Input type="number" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
        <Field label="Currency"><Select value={f.currency} onChange={(v) => setF({ ...f, currency: v })} options={Object.keys(FX_TO_USD).map((c) => ({ value: c, label: c }))} /></Field>
        <Field label="Unit"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
        <Field label="Source URL"><Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="Scope items" hint="Comma-separated: what the price includes"><Input value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} /></Field></div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => {
          if (!f.value) return;
          onAdd({ id: uid("p"), entity_id: f.entity, arena, country: f.country, service: f.service || ARENA_LABEL[arena], price_type: f.type, observed_value: +f.value, unit: f.unit, currency: f.currency, scope: f.scope.split(",").map((s) => s.trim()).filter(Boolean), provenance: { source_url: f.url || undefined, source_type: f.type === "hexa_deal" ? "internal" : f.type === "competitor_quote" ? "competitor_quote" : f.type === "published" ? "pricing_page" : "analyst_estimate", observed_at: today(), confidence: f.url ? "medium" : "low", verification_status: "unverified", analyst: "You" } });
          onClose();
        }}>Add</Button>
      </div>
    </Modal>
  );
}

// ─────────────────────── Margin model ───────────────────────
function useRoleInputs() {
  const { state } = useIntel();
  const FX_TO_USD = state.fx;
  const roles = [...new Set(state.salaries.map((s) => s.role))];
  const [role, setRole] = useState(roles[0]);
  const buyerOpts = state.salaries.filter((s) => s.role === role && s.country !== "NP");
  const [buyer, setBuyer] = useState<string>(buyerOpts[0]?.id ?? "");
  const b = state.salaries.find((s) => s.id === buyer) ?? buyerOpts[0];
  const np = state.salaries.find((s) => s.role === role && s.country === "NP");
  const hexaPrice = state.pricing.find((p) => p.entity_id === "hexa" && p.currency === b?.currency);
  const compPrice = state.pricing.find((p) => p.entity_id !== "hexa" && p.currency === b?.currency && p.arena === hexaPrice?.arena);
  const [ov, setOv] = useState<Partial<MarginInputs>>({});
  const base: MarginInputs | null =
    b && np
      ? {
          buyerSalaryAnnual: b.annual_mid,
          buyerOncostPct: b.oncost_pct,
          buyerRecruitCostPct: 0.05,
          buyerFx: FX_TO_USD[b.currency] ?? 1,
          nepalSalaryAnnual: np.annual_mid,
          nepalOncostPct: np.oncost_pct,
          nepalFx: FX_TO_USD.NPR,
          supervisionPct: 0.15,
          infraMonthlyUsd: 180,
          softwareMonthlyUsd: 60,
          trainingMonthlyUsd: 40,
          utilization: 0.85,
          attritionPct: 0.18,
          replacementMonths: 2,
          priceMonthly: hexaPrice?.observed_value ?? Math.round((b.annual_mid / 12) * 0.45),
          competitorPriceMonthly: compPrice?.observed_value,
        }
      : null;
  const inputs = base ? { ...base, ...ov } : null;
  return { roles, role, setRole: (r: string) => { setRole(r); setBuyer(""); setOv({}); }, buyerOpts, buyer: b?.id ?? "", setBuyer, b, np, inputs, setOv, ov, compName: compPrice ? state.competitors.find((c) => c.id === compPrice.entity_id)?.name : undefined };
}

function MarginView() {
  const r = useRoleInputs();
  if (!r.inputs || !r.b) return <Card><p className="text-sm text-muted">Add a matching buyer-country and Nepal salary benchmark to model this role.</p></Card>;
  const i = r.inputs;
  const res = marginModel(i);
  const cur = r.b.currency;
  const o = (k: keyof MarginInputs, v: number) => r.setOv({ ...r.ov, [k]: v });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Select label="Role" value={r.role} onChange={r.setRole} options={r.roles.map((x) => ({ value: x, label: x }))} />
        <Select label="Buyer market" value={r.buyer} onChange={r.setBuyer} options={r.buyerOpts.map((s) => ({ value: s.id, label: COUNTRY_LABEL[s.country] }))} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="In-house cost (buyer)" value={fmtUsd(res.inHouseMonthlyUsd)} sub="USD / month, fully loaded" />
        <Stat label="Hexa price" value={fmtUsd(res.priceMonthlyUsd)} sub={`${cur} ${i.priceMonthly.toLocaleString()}`} />
        <Stat label="Delivery cost" value={fmtUsd(res.deliveryCostMonthlyUsd)} sub="incl. non-billable capacity" />
        <Stat label="Contribution" value={fmtUsd(res.contributionUsd)} tone={res.contributionUsd > 0 ? "good" : "bad"} sub={`${pct(res.marginPct, 1)} margin`} />
        <Stat label="Client saving" value={pct(res.clientSavingPct)} tone={res.clientSavingPct > 0.3 ? "good" : "warn"} sub="vs in-house" />
        <Stat label={`vs ${r.compName ?? "competitor"}`} value={res.competitorGapPct != null ? `${res.competitorGapPct > 0 ? "+" : ""}${pct(res.competitorGapPct)}` : "—"} tone={res.competitorGapPct != null && res.competitorGapPct > 0.15 ? "warn" : "default"} sub="price premium (headline)" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Commercial inputs">
          <div className="space-y-3">
            <Slider label={`Hexa price (${cur}/month)`} min={Math.round(res.breakevenPriceUsd / i.buyerFx * 0.6)} max={Math.round(res.inHouseMonthlyUsd / i.buyerFx)} step={50} value={i.priceMonthly} onChange={(v) => o("priceMonthly", v)} format={(v) => v.toLocaleString()} />
            <Slider label={`Buyer in-house salary (${cur}/yr)`} min={r.b.annual_low} max={r.b.annual_high} step={1000} value={i.buyerSalaryAnnual} onChange={(v) => o("buyerSalaryAnnual", v)} format={(v) => v.toLocaleString()} />
            <Slider label="Nepal salary (NPR/yr)" min={r.np!.annual_low} max={r.np!.annual_high} step={10000} value={i.nepalSalaryAnnual} onChange={(v) => o("nepalSalaryAnnual", v)} format={(v) => v.toLocaleString()} />
            <Slider label="Utilization" min={0.5} max={1} step={0.01} value={i.utilization} onChange={(v) => o("utilization", v)} format={(v) => pct(v)} />
          </div>
        </Card>
        <Card title="Delivery cost inputs">
          <div className="space-y-3">
            <Slider label="Supervision (% of salary)" min={0} max={0.4} step={0.01} value={i.supervisionPct} onChange={(v) => o("supervisionPct", v)} format={(v) => pct(v)} />
            <Slider label="Infrastructure (USD/mo)" min={50} max={500} step={10} value={i.infraMonthlyUsd} onChange={(v) => o("infraMonthlyUsd", v)} />
            <Slider label="Software (USD/mo)" min={0} max={300} step={10} value={i.softwareMonthlyUsd} onChange={(v) => o("softwareMonthlyUsd", v)} />
            <Slider label="Training (USD/mo)" min={0} max={200} step={10} value={i.trainingMonthlyUsd} onChange={(v) => o("trainingMonthlyUsd", v)} />
            <Slider label="Annual attrition" min={0} max={0.5} step={0.01} value={i.attritionPct} onChange={(v) => o("attritionPct", v)} format={(v) => pct(v)} />
          </div>
        </Card>
        <Card title="Unit economics (USD / billable month)">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={[...res.breakdown, { name: "Contribution", value: res.contributionUsd }]} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmtUsd(v)} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {[...res.breakdown, { name: "c", value: res.contributionUsd }].map((d, k) => <Cell key={k} fill={k === res.breakdown.length ? (res.contributionUsd > 0 ? "var(--chart-2)" : "var(--chart-6)") : "var(--chart-1)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted">Break-even price: {fmtUsd(res.breakevenPriceUsd)}. Salary benchmarks are public-source estimates (see Research) — replace with Hexa&apos;s actual payroll costs. Set Hexa&apos;s price via Benchmarks → Add price observation.</p>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────── Scenarios ───────────────────────
function ScenarioView() {
  const { state } = useIntel();
  const r = useRoleInputs();
  const [shock, setShock] = useState<Shock>(BASE_SHOCK);
  const [winOverride, setWin] = useState<number | null>(null);
  const wl = winLoss(state.opportunities);
  const fc = useMemo(() => forecast(state.opportunities, winOverride ?? wl.winRate), [state.opportunities, winOverride, wl.winRate]);
  if (!r.inputs) return null;
  const base = marginModel(r.inputs);
  const custom = marginModel(applyShock(r.inputs, shock));
  const presets = SCENARIO_PRESETS.map((p) => ({ ...p, res: marginModel(applyShock(r.inputs!, { ...BASE_SHOCK, ...p.shock })) }));

  // Tornado: margin delta from ± moves of each driver
  const drivers: { name: string; lo: Partial<Shock>; hi: Partial<Shock> }[] = [
    { name: "Nepal salary ±10%", lo: { salaryRisePct: 10 }, hi: { salaryRisePct: -10 } },
    { name: "Utilization ±10pt", lo: { utilization: 0.75 }, hi: { utilization: 0.95 } },
    { name: "FX ±8%", lo: { fxMovePct: 8 }, hi: { fxMovePct: -8 } },
    { name: "Competitor price ±15%", lo: { competitorPriceCutPct: 15, priceMatchPct: 1 }, hi: { competitorPriceCutPct: -15, priceMatchPct: 1 } },
    { name: "Automation 0–20%", lo: { automationSavingPct: 0 }, hi: { automationSavingPct: 20 } },
  ];
  const tornado = drivers
    .map((d) => ({
      name: d.name,
      low: (marginModel(applyShock(r.inputs!, { ...BASE_SHOCK, ...d.lo })).marginPct - base.marginPct) * 100,
      high: (marginModel(applyShock(r.inputs!, { ...BASE_SHOCK, ...d.hi })).marginPct - base.marginPct) * 100,
    }))
    .sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Select label="Role" value={r.role} onChange={r.setRole} options={r.roles.map((x) => ({ value: x, label: x }))} />
        <Select label="Buyer market" value={r.buyer} onChange={r.setBuyer} options={r.buyerOpts.map((s) => ({ value: s.id, label: COUNTRY_LABEL[s.country] }))} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Custom scenario" subtitle="Stack shocks and compare to base">
          <div className="space-y-3">
            <Slider label="Nepal salary change" min={-10} max={25} step={1} value={shock.salaryRisePct} onChange={(v) => setShock({ ...shock, salaryRisePct: v })} format={(v) => `${v > 0 ? "+" : ""}${v}%`} />
            <Slider label="Competitor price cut" min={-10} max={30} step={1} value={shock.competitorPriceCutPct} onChange={(v) => setShock({ ...shock, competitorPriceCutPct: v })} format={(v) => `${v}%`} />
            <Slider label="Share of cut Hexa matches" min={0} max={1} step={0.1} value={shock.priceMatchPct} onChange={(v) => setShock({ ...shock, priceMatchPct: v })} format={(v) => pct(v)} />
            <Slider label="Utilization" min={0.5} max={1} step={0.01} value={shock.utilization} onChange={(v) => setShock({ ...shock, utilization: v })} format={(v) => pct(v)} />
            <Slider label="Buyer currency weakens vs USD" min={-10} max={15} step={1} value={shock.fxMovePct} onChange={(v) => setShock({ ...shock, fxMovePct: v })} format={(v) => `${v}%`} />
            <Slider label="Automation effort saving" min={0} max={30} step={1} value={shock.automationSavingPct} onChange={(v) => setShock({ ...shock, automationSavingPct: v })} format={(v) => `${v}%`} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Margin" value={pct(custom.marginPct, 1)} tone={custom.marginPct < base.marginPct ? "bad" : "good"} sub={`base ${pct(base.marginPct, 1)}`} />
            <Stat label="Contribution / FTE" value={fmtUsd(custom.contributionUsd)} sub={`base ${fmtUsd(base.contributionUsd)}`} />
          </div>
        </Card>
        <Card className="lg:col-span-2" title="Sensitivity (tornado)" subtitle="Change in margin percentage points from base for each driver">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={tornado} layout="vertical" stackOffset="sign" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}pt`} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)} pt`} />
                <ReferenceLine x={0} stroke="var(--muted)" />
                <Bar dataKey="low" name="Adverse" fill="var(--chart-6)" stackId="a" />
                <Bar dataKey="high" name="Favourable" fill="var(--chart-2)" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Table>
            <thead><tr><Th>Preset scenario</Th><Th>Margin</Th><Th>Δ vs base</Th><Th>Contribution/FTE</Th><Th>Client saving</Th></tr></thead>
            <tbody>
              {presets.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-surface-2" onClick={() => setShock({ ...BASE_SHOCK, ...p.shock })}>
                  <Td className="font-medium text-ink">{p.name}</Td>
                  <Td className="tabular-nums">{pct(p.res.marginPct, 1)}</Td>
                  <Td className={`tabular-nums ${p.res.marginPct < base.marginPct - 0.001 ? "text-bad" : p.res.marginPct > base.marginPct + 0.001 ? "text-good" : ""}`}>{((p.res.marginPct - base.marginPct) * 100).toFixed(1)} pt</Td>
                  <Td className="tabular-nums">{fmtUsd(p.res.contributionUsd)}</Td>
                  <Td className="tabular-nums">{pct(p.res.clientSavingPct)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
      <Card title="12-month revenue forecast from open pipeline" subtitle={`${fc.open} open opportunities weighted by stage × win rate. Downside / base / upside.`} actions={<div className="w-56"><Slider label="Win rate assumption" min={0.1} max={0.7} step={0.01} value={winOverride ?? wl.winRate} onChange={setWin} format={(v) => pct(v)} /></div>}>
        <div className="mb-4 grid grid-cols-3 gap-3">
          {fc.cases.map((c) => <Stat key={c.name} label={c.name} value={fmtUsd(c.revenue)} sub={`${fmtUsd(c.gp)} gross contribution`} tone={c.name === "Downside" ? "warn" : c.name === "Upside" ? "good" : "default"} />)}
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <AreaChart data={fc.series}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => fmtUsd(v)} />
              <Tooltip formatter={(v: number) => fmtUsd(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area dataKey="Upside" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.15} />
              <Area dataKey="Base" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.2} />
              <Area dataKey="Downside" stroke="var(--chart-6)" fill="var(--chart-6)" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <p className="text-xs text-muted">Markets with priced Hexa offers: {ARENAS.filter((a) => state.pricing.some((p) => p.entity_id === "hexa" && p.arena === a)).map((a) => ARENA_SHORT[a]).join(", ")}.</p>
    </div>
  );
}
