"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus } from "lucide-react";
import { useIntel, uid, today } from "@/lib/store";
import { funnel, groupWinRate, intelLift, winLoss } from "@/lib/scoring";
import { ARENA_SHORT, COUNTRY_LABEL, LOSS_LABEL, STAGE_LABEL } from "@/lib/labels";
import type { Arena, CountryCode, FunnelStage, LossReason, Opportunity, Segment } from "@/lib/types";
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Stat, Table, Td, Th, fmtUsd, pct } from "@/components/ui";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--muted)"];

export default function Sales() {
  const { state, set } = useIntel();
  const [logging, setLogging] = useState(false);
  const [arena, setArena] = useState<Arena | "all">("all");
  const [country, setCountry] = useState<CountryCode | "all">("all");
  const opps = useMemo(() => state.opportunities.filter((o) => (arena === "all" || o.arena === arena) && (country === "all" || o.country === country)), [state.opportunities, arena, country]);
  const f = funnel(opps);
  const wl = winLoss(opps);
  const lift = intelLift(opps);
  const name = (id: string) => state.competitors.find((c) => c.id === id)?.name ?? id;

  const bySeg = groupWinRate(opps, (o) => `${o.country} ${ARENA_SHORT[o.arena]} · ${o.segment}`).sort((a, b) => b.gp - a.gp);
  const byMsg = groupWinRate(opps, (o) => o.message_variant).sort((a, b) => b.winRate - a.winRate);
  const byComp = groupWinRate(opps, (o) => o.competitor_id).filter((r) => r.closed >= 2).sort((a, b) => a.winRate - b.winRate);
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11 + i);
    const m = d.toISOString().slice(0, 7);
    const xs = opps.filter((o) => o.closed_at?.startsWith(m));
    const won = xs.filter((o) => o.stage === "won");
    return { month: m, won: won.length, lost: xs.length - won.length, gp: Math.round(won.reduce((a, o) => a + o.value_usd * o.gross_margin, 0)) };
  });
  const countries = [...new Set(state.opportunities.map((o) => o.country))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales & win/loss"
        subtitle="Live pipeline logged by BD: full funnel from target account to gross profit, segmented by market, message, offer and competitor. Every closed deal needs a win/loss reason."
        actions={<Button variant="primary" onClick={() => setLogging(true)}><Plus className="h-4 w-4" /> Log deal</Button>}
      />
      <Pipeline opps={state.opportunities} onChange={(fn) => set("opportunities", fn)} />
      <div className="flex flex-wrap gap-3">
        <Select label="Service" value={arena} onChange={setArena} options={[{ value: "all", label: "All" }, ...(Object.keys(ARENA_SHORT) as Arena[]).map((a) => ({ value: a, label: ARENA_SHORT[a] }))]} />
        <Select label="Country" value={country} onChange={setCountry} options={[{ value: "all", label: "All" }, ...countries.map((c) => ({ value: c, label: c }))]} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Targets" value={opps.length} />
        <Stat label="Closed" value={wl.closed} sub={`${wl.won} won`} />
        <Stat label="Win rate" value={wl.closed ? pct(wl.winRate) : "—"} sub={wl.closed ? undefined : "no closed deals yet"} />
        <Stat label="Won gross profit" value={fmtUsd(wl.wonGP)} sub={`${fmtUsd(wl.wonValue)} ACV`} tone="good" />
        <Stat label="Intel-assisted win rate" value={wl.closed ? pct(lift.assisted.winRate) : "—"} sub={`control ${pct(lift.control.winRate)}`} tone={lift.assisted.winRate > lift.control.winRate ? "good" : "warn"} />
        <Stat label="GP per target lift" value={lift.control.gpPerTarget ? `${lift.gpLift >= 0 ? "+" : ""}${pct(lift.gpLift)}` : "—"} sub={`n=${lift.assisted.n} vs ${lift.control.n}`} tone={lift.gpLift > 0 ? "good" : "bad"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Outbound funnel" subtitle="Count reaching each stage and step conversion">
          <div className="space-y-1.5">
            {f.map((s, i) => (
              <div key={s.stage} className="flex items-center gap-3">
                <div className="w-36 shrink-0 text-xs text-ink-2">{STAGE_LABEL[s.stage]}</div>
                <div className="relative h-7 flex-1 overflow-hidden rounded bg-chip">
                  <div className="h-full rounded" style={{ width: `${(s.count / (f[0].count || 1)) * 100}%`, background: `color-mix(in srgb, var(--chart-1) ${90 - i * 7}%, var(--chart-2))` }} />
                  <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-white mix-blend-difference">{s.count}</span>
                </div>
                <div className="w-14 text-right text-xs tabular-nums text-muted">{i === 0 ? "" : pct(s.conv)}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Loss reasons" subtitle={`${pct(wl.withReason)} of closed deals have a reason recorded`}>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={wl.reasons.map((r) => ({ name: LOSS_LABEL[r.reason], value: r.count }))} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {wl.reasons.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {wl.reasons.map((r, i) => (
              <li key={r.reason} className="flex items-center justify-between"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{LOSS_LABEL[r.reason]}</span><span className="tabular-nums text-muted">{r.count}</span></li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Closed deals by month">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="won" stackId="a" fill="var(--chart-2)" />
                <Bar dataKey="lost" stackId="a" fill="var(--chart-6)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Won gross profit trend">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={monthly}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => fmtUsd(v)} />
                <Tooltip formatter={(v: number) => fmtUsd(v)} />
                <Line dataKey="gp" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="By market segment" pad={false}>
          <SegTable rows={bySeg.map((r) => ({ ...r, label: r.key }))} />
        </Card>
        <Card title="By message variant" subtitle="Which outreach converts" pad={false}>
          <SegTable rows={byMsg.map((r) => ({ ...r, label: r.key }))} />
        </Card>
        <Card title="Head-to-head vs competitor" subtitle="Lowest win rate first" pad={false}>
          <SegTable rows={byComp.map((r) => ({ ...r, label: name(r.key) }))} />
        </Card>
      </div>
      <LogDeal open={logging} onClose={() => setLogging(false)} onAdd={(o) => set("opportunities", (xs) => [o, ...xs])} />
    </div>
  );
}

function SegTable({ rows }: { rows: { label: string; total: number; closed: number; winRate: number; gp: number }[] }) {
  return (
    <Table>
      <thead><tr><Th>Segment</Th><Th>Opps</Th><Th>Win</Th><Th>GP</Th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <Td className="text-xs font-medium text-ink">{r.label}</Td>
            <Td className="tabular-nums">{r.total}</Td>
            <Td className="tabular-nums">{r.closed ? pct(r.winRate) : "—"}</Td>
            <Td className="tabular-nums">{fmtUsd(r.gp)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

const STAGES: FunnelStage[] = ["target", "connection_sent", "connected", "messaged", "replied", "meeting", "qualified", "proposal", "won", "lost"];

function Pipeline({ opps, onChange }: { opps: Opportunity[]; onChange: (fn: (xs: Opportunity[]) => Opportunity[]) => void }) {
  const { state } = useIntel();
  const acct = (id: string) => state.accounts.find((a) => a.id === id)?.name ?? id;
  const open = opps.filter((o) => o.stage !== "won" && o.stage !== "lost");
  const upd = (id: string, patch: Partial<Opportunity>) => onChange((xs) => xs.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  if (!opps.length)
    return <Empty>No deals logged yet. Use “Log deal” for every active opportunity — the funnel, win/loss analysis, forecast and the market-weight back-test all run from this data.</Empty>;
  return (
    <Card title="Pipeline" subtitle={`${open.length} open · ${opps.length - open.length} closed. Change the stage inline; closing as lost requires a reason.`} pad={false}>
      <Table>
        <thead><tr><Th>Account</Th><Th>Market</Th><Th>ACV (USD)</Th><Th>GM</Th><Th>Stage</Th><Th>Loss reason</Th><Th>Competitor</Th><Th>Intel</Th></tr></thead>
        <tbody>
          {opps.slice(0, 100).map((o) => (
            <tr key={o.id}>
              <Td className="font-medium text-ink">{acct(o.account_id)}</Td>
              <Td className="text-xs">{o.country} · {ARENA_SHORT[o.arena]} · {o.segment}</Td>
              <Td className="tabular-nums">{fmtUsd(o.value_usd)}</Td>
              <Td className="tabular-nums">{pct(o.gross_margin)}</Td>
              <Td>
                <Select value={o.stage} onChange={(v) => upd(o.id, { stage: v, closed_at: v === "won" || v === "lost" ? today() : undefined, loss_reason: v === "lost" ? o.loss_reason ?? "price" : undefined })} options={STAGES.map((st) => ({ value: st, label: STAGE_LABEL[st] }))} />
              </Td>
              <Td>{o.stage === "lost" ? <Select value={o.loss_reason ?? "price"} onChange={(v) => upd(o.id, { loss_reason: v })} options={(Object.keys(LOSS_LABEL) as LossReason[]).map((r) => ({ value: r, label: LOSS_LABEL[r] }))} /> : <span className="text-subtle">—</span>}</Td>
              <Td className="text-xs">{state.competitors.find((c) => c.id === o.competitor_id)?.name ?? "—"}</Td>
              <Td>{o.intel_assisted ? <Badge tone="violet">assisted</Badge> : <Badge>control</Badge>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function LogDeal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (o: Opportunity) => void }) {
  const { state } = useIntel();
  const first = state.accounts[0];
  const [f, setF] = useState({ account_id: first?.id ?? "", arena: (first?.target_arena ?? "finance_outsourcing") as Arena, country: (first?.country ?? "AU") as CountryCode, segment: (first?.segment ?? "Accounting firms") as Segment, stage: "meeting" as FunnelStage, value: "", gm: "35", competitor: "", variant: "Cost-of-vacancy", intel: true });
  const pickAccount = (id: string) => {
    const a = state.accounts.find((x) => x.id === id);
    setF({ ...f, account_id: id, arena: a?.target_arena ?? f.arena, country: a?.country ?? f.country, segment: a?.segment ?? f.segment });
  };
  return (
    <Modal open={open} onClose={onClose} title="Log deal">
      {!state.accounts.length ? (
        <p className="text-sm text-muted">Add the account first (Accounts → Find accounts or Add manually).</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Account"><Select value={f.account_id} onChange={pickAccount} options={state.accounts.map((a) => ({ value: a.id, label: a.name }))} /></Field></div>
            <Field label="Service"><Select value={f.arena} onChange={(v) => setF({ ...f, arena: v })} options={(Object.keys(ARENA_SHORT) as Arena[]).map((a) => ({ value: a, label: ARENA_SHORT[a] }))} /></Field>
            <Field label="Country"><Select value={f.country} onChange={(v) => setF({ ...f, country: v })} options={(Object.keys(COUNTRY_LABEL) as CountryCode[]).map((c) => ({ value: c, label: COUNTRY_LABEL[c] }))} /></Field>
            <Field label="Segment"><Select value={f.segment} onChange={(v) => setF({ ...f, segment: v })} options={(["SME", "Mid-market", "Enterprise", "Accounting firms", "Scale-ups"] as Segment[]).map((x) => ({ value: x, label: x }))} /></Field>
            <Field label="Stage"><Select value={f.stage} onChange={(v) => setF({ ...f, stage: v })} options={STAGES.map((st) => ({ value: st, label: STAGE_LABEL[st] }))} /></Field>
            <Field label="Annual contract value (USD)"><Input type="number" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
            <Field label="Expected gross margin %"><Input type="number" value={f.gm} onChange={(e) => setF({ ...f, gm: e.target.value })} /></Field>
            <Field label="Main competitor"><Select value={f.competitor} onChange={(v) => setF({ ...f, competitor: v })} options={[{ value: "", label: "None / unknown" }, ...state.competitors.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
            <Field label="Message / offer"><Input value={f.variant} onChange={(e) => setF({ ...f, variant: e.target.value })} /></Field>
            <Field label="Sourced using this platform?"><Select value={f.intel ? "y" : "n"} onChange={(v) => setF({ ...f, intel: v === "y" })} options={[{ value: "y", label: "Yes — intel-assisted" }, { value: "n", label: "No — control" }]} /></Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={() => {
              if (!f.account_id || !f.value) return;
              onAdd({ id: uid("opp"), account_id: f.account_id, arena: f.arena, country: f.country, segment: f.segment, stage: f.stage, value_usd: +f.value, gross_margin: +f.gm / 100, competitor_id: f.competitor || undefined, message_variant: f.variant, intel_assisted: f.intel, created_at: today(), closed_at: f.stage === "won" || f.stage === "lost" ? today() : undefined, loss_reason: f.stage === "lost" ? "price" : undefined });
              onClose();
            }}>Log deal</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
