"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useIntel } from "@/lib/store";
import { funnel, groupWinRate, intelLift, winLoss } from "@/lib/scoring";
import { ARENA_SHORT, LOSS_LABEL, STAGE_LABEL } from "@/lib/labels";
import type { Arena, CountryCode } from "@/lib/types";
import { Card, PageHeader, Select, Stat, Table, Td, Th, fmtUsd, pct } from "@/components/ui";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--muted)"];

export default function Sales() {
  const { state } = useIntel();
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
  const monthly = Array.from({ length: 10 }, (_, i) => {
    const m = `2026-${String(i + 1).padStart(2, "0")}`;
    const xs = opps.filter((o) => o.closed_at?.startsWith(m));
    const won = xs.filter((o) => o.stage === "won");
    return { month: m.slice(5), won: won.length, lost: xs.length - won.length, gp: Math.round(won.reduce((a, o) => a + o.value_usd * o.gross_margin, 0)) };
  });
  const countries = [...new Set(state.opportunities.map((o) => o.country))];

  return (
    <div className="space-y-6">
      <PageHeader title="Sales & win/loss" subtitle="Full outbound funnel from target account to gross profit, segmented by market, message, offer and competitor. Pipeline shown is illustrative seed data — connect CRM to replace." />
      <div className="flex flex-wrap gap-3">
        <Select label="Service" value={arena} onChange={setArena} options={[{ value: "all", label: "All" }, ...(Object.keys(ARENA_SHORT) as Arena[]).map((a) => ({ value: a, label: ARENA_SHORT[a] }))]} />
        <Select label="Country" value={country} onChange={setCountry} options={[{ value: "all", label: "All" }, ...countries.map((c) => ({ value: c, label: c }))]} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Targets" value={opps.length} />
        <Stat label="Closed" value={wl.closed} sub={`${wl.won} won`} />
        <Stat label="Win rate" value={pct(wl.winRate)} />
        <Stat label="Won gross profit" value={fmtUsd(wl.wonGP)} sub={`${fmtUsd(wl.wonValue)} ACV`} tone="good" />
        <Stat label="Intel-assisted win rate" value={pct(lift.assisted.winRate)} sub={`control ${pct(lift.control.winRate)}`} tone={lift.assisted.winRate > lift.control.winRate ? "good" : "warn"} />
        <Stat label="GP per target lift" value={`${lift.gpLift >= 0 ? "+" : ""}${pct(lift.gpLift)}`} sub={`n=${lift.assisted.n} vs ${lift.control.n}`} tone={lift.gpLift > 0 ? "good" : "bad"} />
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
