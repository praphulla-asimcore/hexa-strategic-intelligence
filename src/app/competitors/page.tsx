"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Cell, LabelList } from "recharts";
import { useIntel, uid, today } from "@/lib/store";
import { threatScore } from "@/lib/scoring";
import { ARENAS, ARENA_LABEL, ARENA_SHORT, ARENA_CRITERIA, COUNTRY_FLAG } from "@/lib/labels";
import type { Arena, Competitor, CompetitorKind, CompetitorTier, CountryCode } from "@/lib/types";
import { Badge, Button, Card, ConfidenceBadge, Field, Input, Modal, PageHeader, ScoreBar, Select, Table, Tabs, Td, Textarea, Th, VerificationBadge } from "@/components/ui";

const COUNTRIES: CountryCode[] = ["AU", "MY", "SG", "ID", "NP", "BD", "UK", "US"];
type View = "list" | "matrix" | "map" | "arenas";

export default function Competitors() {
  const { state, set } = useIntel();
  const [view, setView] = useState<View>("list");
  const [tier, setTier] = useState<CompetitorTier | "all">("all");
  const [arena, setArena] = useState<Arena | "all">("all");
  const [country, setCountry] = useState<CountryCode | "all">("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const rows = useMemo(
    () =>
      state.competitors
        .filter((c) => tier === "all" || c.tier === tier)
        .filter((c) => arena === "all" || c.arenas.includes(arena))
        .filter((c) => country === "all" || c.countries.includes(country))
        .filter((c) => !q || `${c.name} ${c.positioning}`.toLowerCase().includes(q.toLowerCase()))
        .map((c) => ({ c, t: threatScore(c, state.weights.threat) }))
        .sort((a, b) => b.t.score - a.t.score),
    [state, tier, arena, country, q],
  );

  return (
    <div>
      <PageHeader
        title="Competitors"
        subtitle="Rated by service × country × segment — never a single overall rank. Threat scores publish confidence and evidence coverage."
        actions={<Button variant="primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add competitor</Button>}
      />
      <Tabs
        value={view}
        onChange={setView}
        tabs={[
          { value: "list", label: "Watchlist", count: rows.length },
          { value: "matrix", label: "Coverage matrix" },
          { value: "map", label: "Positioning map" },
          { value: "arenas", label: "By arena" },
        ]}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-56" />
        <Select label="Tier" value={tier} onChange={setTier} options={[{ value: "all", label: "All" }, { value: "tier1", label: "Tier 1" }, { value: "tier2", label: "Tier 2" }, { value: "substitute", label: "Substitutes" }]} />
        <Select label="Arena" value={arena} onChange={setArena} options={[{ value: "all", label: "All" }, ...ARENAS.map((a) => ({ value: a, label: ARENA_LABEL[a] }))]} />
        <Select label="Country" value={country} onChange={setCountry} options={[{ value: "all", label: "All" }, ...COUNTRIES.map((c) => ({ value: c, label: `${COUNTRY_FLAG[c]} ${c}` }))]} />
      </div>

      {view === "list" && (
        <Card pad={false}>
          <Table>
            <thead>
              <tr>
                <Th>Competitor</Th>
                <Th>Type</Th>
                <Th>Arenas</Th>
                <Th>Coverage</Th>
                <Th className="w-44">Threat</Th>
                <Th>Evidence</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, t }) => (
                <tr key={c.id} className="hover:bg-surface-2">
                  <Td>
                    <Link href={`/competitors/${c.id}`} className="font-medium text-ink hover:underline">{c.name}</Link>
                    <div className="max-w-md text-xs text-muted">{c.positioning}</div>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1">
                      <Badge tone={c.tier === "tier1" ? "red" : c.tier === "tier2" ? "amber" : "violet"}>{c.tier === "substitute" ? "substitute" : c.tier.replace("tier", "Tier ")}</Badge>
                      <span className="text-[11px] text-muted">{c.kind}</span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">{c.arenas.map((a) => <Badge key={a}>{ARENA_SHORT[a]}</Badge>)}</div>
                  </Td>
                  <Td className="whitespace-nowrap text-xs">{c.countries.map((x) => COUNTRY_FLAG[x]).join(" ")}</Td>
                  <Td>
                    <ScoreBar value={t.score} />
                    {t.insufficient && <div className="mt-0.5 text-[10px] text-warn">thin evidence · ceiling {t.ceiling}</div>}
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1">
                      <ConfidenceBadge c={t.confidence} />
                      <span className="text-[11px] text-muted">{Math.round(c.evidence_coverage * 100)}% fields</span>
                    </div>
                  </Td>
                  <Td><VerificationBadge v={c.provenance.verification_status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {view === "matrix" && <Matrix comps={rows.map((r) => r.c)} />}
      {view === "map" && <PositionMap rows={rows} />}
      {view === "arenas" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {ARENAS.map((a) => {
            const list = rows.filter((r) => r.c.arenas.includes(a)).slice(0, 6);
            return (
              <Card key={a} title={ARENA_LABEL[a]} subtitle={`Buying criteria: ${ARENA_CRITERIA[a]}`} pad={false}>
                <ul className="divide-y divide-line">
                  {list.map(({ c, t }) => (
                    <li key={c.id} className="flex items-center gap-3 px-5 py-2">
                      <Link href={`/competitors/${c.id}`} className="w-48 truncate text-sm font-medium text-ink hover:underline">{c.name}</Link>
                      <div className="flex-1"><ScoreBar value={t.score} /></div>
                      <ConfidenceBadge c={t.confidence} />
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}

      <AddCompetitor open={adding} onClose={() => setAdding(false)} onAdd={(c) => set("competitors", (xs) => [...xs, c])} />
    </div>
  );
}

function Matrix({ comps }: { comps: Competitor[] }) {
  const [arena, setArena] = useState<Arena>("finance_outsourcing");
  const list = comps.filter((c) => c.arenas.includes(arena));
  const counts = COUNTRIES.map((k) => list.filter((c) => c.countries.includes(k)).length);
  const max = Math.max(1, ...counts);
  return (
    <Card title="Service × country coverage" subtitle="Who is present where. Cell shading = competitor market presence (1–5)." actions={<Select value={arena} onChange={setArena} options={ARENAS.map((a) => ({ value: a, label: ARENA_LABEL[a] }))} />} pad={false}>
      <Table>
        <thead>
          <tr>
            <Th>Competitor</Th>
            {COUNTRIES.map((k) => <Th key={k} className="text-center">{COUNTRY_FLAG[k]} {k}</Th>)}
          </tr>
        </thead>
        <tbody>
          <tr className="bg-surface-2">
            <Td className="text-xs font-semibold">Rivals present</Td>
            {counts.map((n, i) => (
              <Td key={i} className="text-center">
                <span className="inline-block min-w-8 rounded px-1.5 py-0.5 text-xs font-semibold" style={{ background: `color-mix(in srgb, var(--bad) ${(n / max) * 45}%, transparent)` }}>{n}</span>
              </Td>
            ))}
          </tr>
          {list.map((c) => (
            <tr key={c.id}>
              <Td><Link href={`/competitors/${c.id}`} className="text-sm font-medium text-ink hover:underline">{c.name}</Link></Td>
              {COUNTRIES.map((k) => {
                const on = c.countries.includes(k);
                return (
                  <Td key={k} className="text-center">
                    {on ? (
                      <span className="inline-block h-5 w-8 rounded" title={`Presence ${c.threat_inputs.market_presence}/5`} style={{ background: `color-mix(in srgb, var(--brand-600) ${20 + c.threat_inputs.market_presence * 15}%, transparent)` }} />
                    ) : (
                      <span className="text-subtle">·</span>
                    )}
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

function PositionMap({ rows }: { rows: { c: Competitor; t: ReturnType<typeof threatScore> }[] }) {
  const data = rows.map(({ c, t }) => ({
    name: c.name,
    x: c.threat_inputs.service_overlap + (c.threat_inputs.customer_overlap - 3) * 0.15,
    y: c.threat_inputs.market_presence + (c.threat_inputs.growth_signals - 3) * 0.15,
    z: t.score,
    tier: c.tier,
  }));
  const color = (t: string) => (t === "tier1" ? "var(--chart-6)" : t === "tier2" ? "var(--chart-1)" : "var(--chart-4)");
  return (
    <Card title="Positioning map" subtitle="X: service overlap with Hexa · Y: market presence · bubble: threat score. Top-right = defend; top-left = monitor; bottom-right = attack.">
      <div className="h-[460px]">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 0 }}>
            <CartesianGrid />
            <XAxis type="number" dataKey="x" domain={[0.5, 5.5]} name="Service overlap" label={{ value: "Service overlap →", position: "insideBottom", offset: -10 }} />
            <YAxis type="number" dataKey="y" domain={[0.5, 5.5]} name="Market presence" label={{ value: "Presence →", angle: -90, position: "insideLeft" }} />
            <ZAxis type="number" dataKey="z" range={[60, 600]} name="Threat" />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v: number) => v.toFixed?.(1) ?? v} />
            <Scatter data={data}>
              {data.map((d, i) => <Cell key={i} fill={color(d.tier)} fillOpacity={0.55} stroke={color(d.tier)} />)}
              <LabelList dataKey="name" position="top" style={{ fontSize: 10, fill: "var(--muted)" }} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-3 text-xs text-muted">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "var(--chart-6)" }} />Tier 1</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "var(--chart-1)" }} />Tier 2</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "var(--chart-4)" }} />Substitute</span>
      </div>
    </Card>
  );
}

function AddCompetitor({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (c: Competitor) => void }) {
  const [f, setF] = useState({ name: "", website: "", tier: "tier2" as CompetitorTier, kind: "direct" as CompetitorKind, arena: "finance_outsourcing" as Arena, countries: "AU, SG", positioning: "" });
  const submit = () => {
    if (!f.name) return;
    onAdd({
      id: uid("comp"),
      name: f.name,
      website: f.website,
      tier: f.tier,
      kind: f.kind,
      hq: "To verify",
      size_band: "To verify",
      arenas: [f.arena],
      countries: f.countries.split(/[,\s]+/).filter(Boolean).map((x) => x.toUpperCase()) as CountryCode[],
      segments: ["SME"],
      positioning: f.positioning || "To research",
      implication: "To assess",
      certifications: [],
      strengths: [],
      weaknesses: [],
      threat_inputs: { customer_overlap: 3, service_overlap: 3, market_presence: 3, pricing_pressure: 3, growth_signals: 3 },
      evidence_coverage: 0.05,
      battlecard: { why_we_win: [], why_we_lose: [], objections: [], landmines: [], proof_points: [] },
      provenance: { source_url: f.website, source_type: "company_website", observed_at: today(), confidence: "low", verification_status: "unverified", analyst: "You" },
    });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Add competitor">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Website"><Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" /></Field>
        <Field label="Tier"><Select value={f.tier} onChange={(v) => setF({ ...f, tier: v })} options={[{ value: "tier1", label: "Tier 1" }, { value: "tier2", label: "Tier 2" }, { value: "substitute", label: "Substitute" }]} /></Field>
        <Field label="Kind"><Select value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={[{ value: "direct", label: "Direct" }, { value: "indirect", label: "Indirect" }, { value: "substitute", label: "Substitute" }]} /></Field>
        <Field label="Primary arena"><Select value={f.arena} onChange={(v) => setF({ ...f, arena: v })} options={ARENAS.map((a) => ({ value: a, label: ARENA_LABEL[a] }))} /></Field>
        <Field label="Countries" hint="Comma-separated codes, e.g. AU, MY"><Input value={f.countries} onChange={(e) => setF({ ...f, countries: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="Positioning"><Textarea rows={2} value={f.positioning} onChange={(e) => setF({ ...f, positioning: e.target.value })} /></Field></div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={submit}>Add</Button>
      </div>
    </Modal>
  );
}
