"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import { useIntel, uid, today } from "@/lib/store";
import { ARENAS, ARENA_SHORT } from "@/lib/labels";
import type { Arena, Confidence, CountryCode, Observation, SourceType, Verification } from "@/lib/types";
import { Badge, Button, Card, ConfidenceBadge, Field, Input, Modal, PageHeader, Select, Stat, Table, Tabs, Td, Th, VerificationBadge, pct } from "@/components/ui";

const SOURCE_TYPES: SourceType[] = ["company_website", "pricing_page", "press_release", "job_posting", "regulator", "licensed_feed", "crm", "analyst_estimate", "customer_interview", "competitor_quote", "internal"];

export default function Research() {
  const { state, set } = useIntel();
  const [view, setView] = useState<"evidence" | "queue" | "sources" | "schema">("evidence");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const entityName = (id: string) => (id === "hexa" ? "Hexa" : state.competitors.find((c) => c.id === id)?.name ?? state.accounts.find((a) => a.id === id)?.name ?? id);

  // Verification queue: anything not verified, plus stale review dates (> 30 days).
  const queue = useMemo(() => {
    const stale = (d?: string) => !d || (Date.now() - new Date(d).getTime()) / 864e5 > 30;
    return [
      ...state.competitors.filter((c) => c.provenance.verification_status !== "verified").map((c) => ({ kind: "Competitor profile", id: c.id, name: c.name, status: c.provenance.verification_status, conf: c.provenance.confidence, stale: stale(c.provenance.last_reviewed_at), tier: c.tier })),
      ...state.pricing.filter((p) => p.provenance.verification_status !== "verified").map((p) => ({ kind: "Price observation", id: p.id, name: `${entityName(p.entity_id)} — ${p.service}`, status: p.provenance.verification_status, conf: p.provenance.confidence, stale: stale(p.provenance.last_reviewed_at), tier: p.entity_id === "hexa" ? "internal" : "pricing" })),
      ...state.observations.filter((o) => o.verification_status !== "verified").map((o) => ({ kind: "Observation", id: o.id, name: `${entityName(o.entity_id)} — ${o.field}`, status: o.verification_status, conf: o.confidence, stale: stale(o.last_reviewed_at), tier: "evidence" })),
    ].sort((a, b) => (a.tier === "tier1" ? -1 : 0) - (b.tier === "tier1" ? -1 : 0));
  }, [state]);

  const obs = state.observations.filter((o) => !q || `${entityName(o.entity_id)} ${o.field} ${o.observed_value}`.toLowerCase().includes(q.toLowerCase()));
  const verify = (o: Observation, v: Verification) => set("observations", (xs) => xs.map((x) => (x.id === o.id ? { ...x, verification_status: v, last_reviewed_at: today() } : x)));

  return (
    <div className="space-y-6">
      <PageHeader title="Research & evidence" subtitle="Append-only observations with the minimum provenance schema. Every high-impact claim must trace to a source." actions={<Button variant="primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Log observation</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Observations" value={state.observations.length} />
        <Stat label="With source URL" value={pct(state.observations.filter((o) => o.source_url).length / (state.observations.length || 1))} tone="good" />
        <Stat label="Awaiting verification" value={queue.length} tone={queue.length > 10 ? "warn" : "default"} />
        <Stat label="Registered sources" value={state.sources.length} sub={`${state.sources.filter((s) => s.licence === "licensed").length} licensed`} />
      </div>
      <Tabs value={view} onChange={setView} tabs={[{ value: "evidence", label: "Evidence log", count: obs.length }, { value: "queue", label: "Verification queue", count: queue.length }, { value: "sources", label: "Source registry", count: state.sources.length }, { value: "schema", label: "Data model" }]} />

      {view === "evidence" && (
        <Card pad={false} title="Observations" actions={<Input placeholder="Search evidence…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 py-1.5" />}>
          <Table>
            <thead><tr><Th>Entity</Th><Th>Field</Th><Th>Value</Th><Th>Market / service</Th><Th>Source</Th><Th>Observed</Th><Th>Evidence</Th><Th>Review</Th></tr></thead>
            <tbody>
              {[...obs].reverse().map((o) => (
                <tr key={o.id}>
                  <Td className="font-medium text-ink">{entityName(o.entity_id)}</Td>
                  <Td className="text-xs">{o.field}</Td>
                  <Td>{o.currency ? `${o.currency} ` : ""}{o.observed_value}{o.unit ? <div className="text-[11px] text-muted">{o.unit}</div> : null}</Td>
                  <Td className="text-xs">{[o.market, o.service_line && ARENA_SHORT[o.service_line]].filter(Boolean).join(" · ") || "—"}</Td>
                  <Td className="text-xs">{o.source_url ? <a href={o.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">{o.source_type.replace(/_/g, " ")} <ExternalLink className="h-3 w-3" /></a> : o.source_type.replace(/_/g, " ")}</Td>
                  <Td className="whitespace-nowrap text-xs">{o.observed_at}<div className="text-muted">{o.analyst}</div></Td>
                  <Td><div className="flex flex-col gap-1"><ConfidenceBadge c={o.confidence} /><VerificationBadge v={o.verification_status} /></div></Td>
                  <Td>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => verify(o, "verified")}>Verify</Button>
                      <Button size="sm" variant="ghost" onClick={() => verify(o, "disputed")}>Dispute</Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {view === "queue" && (
        <Card pad={false} title="Analyst review queue" subtitle="Unverified or stale (> 30 days since review). Tier 1 first.">
          <Table>
            <thead><tr><Th>Type</Th><Th>Item</Th><Th>Status</Th><Th>Confidence</Th><Th>Stale</Th></tr></thead>
            <tbody>
              {queue.map((x) => (
                <tr key={x.kind + x.id}>
                  <Td className="text-xs">{x.kind}</Td>
                  <Td className="font-medium text-ink">{x.name} {x.tier === "tier1" && <Badge tone="red">tier 1</Badge>}</Td>
                  <Td><VerificationBadge v={x.status} /></Td>
                  <Td><ConfidenceBadge c={x.conf} /></Td>
                  <Td>{x.stale ? <Badge tone="amber">needs review</Badge> : <Badge tone="green">fresh</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {view === "sources" && (
        <Card pad={false} title="Source registry" subtitle="Verify data-use, scraping, retention and redistribution rights for every licensed source.">
          <Table>
            <thead><tr><Th>Source</Th><Th>Type</Th><Th>Licence</Th><Th>Refresh</Th><Th>Owner</Th><Th>Last checked</Th><Th>Reliability</Th></tr></thead>
            <tbody>
              {state.sources.map((s) => (
                <tr key={s.id}>
                  <Td>{s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-ink hover:underline">{s.name}</a> : <span className="font-medium text-ink">{s.name}</span>}</Td>
                  <Td className="text-xs">{s.type.replace(/_/g, " ")}</Td>
                  <Td><Badge tone={s.licence === "licensed" ? "violet" : s.licence === "internal" ? "blue" : "slate"}>{s.licence}</Badge></Td>
                  <Td className="text-xs">{s.refresh}</Td>
                  <Td className="text-xs">{s.owner}</Td>
                  <Td className="text-xs">{s.last_checked}</Td>
                  <Td><ConfidenceBadge c={s.reliability} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {view === "schema" && <SchemaView />}

      <AddObservation open={adding} onClose={() => setAdding(false)} onAdd={(o) => set("observations", (xs) => [...xs, o])} />
    </div>
  );
}

function SchemaView() {
  const modules = [
    ["1. Competitor profile", "Who competes directly with us?", "competitors"],
    ["2. Pricing", "How should Hexa price?", "pricing_observations"],
    ["3. Competitor strategy", "Where are rivals going?", "competitors · signals"],
    ["4. Digital intelligence", "How do rivals acquire leads?", "observations (field: seo/traffic) — connect Semrush / Similarweb"],
    ["5. Customer intelligence", "Which accounts should we target?", "accounts"],
    ["6. Decision-makers", "Who should sales contact?", "contacts (with lawful basis)"],
    ["7. Market intelligence", "Which markets are attractive?", "market_segments"],
    ["8. Talent intelligence", "Where can Hexa deliver?", "salary_benchmarks"],
    ["9. Financial intelligence", "How large / profitable?", "market_segments · opportunities"],
    ["10. Sales intelligence", "What converts?", "opportunities · sales_activities"],
    ["11. Delivery intelligence", "Can we deliver profitably?", "delivery_costs (margin model)"],
    ["12. Signals", "What should we act on now?", "signals"],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="12 intelligence modules" pad={false}>
        <Table>
          <thead><tr><Th>Module</Th><Th>Decision</Th><Th>Stored in</Th></tr></thead>
          <tbody>{modules.map(([m, d, s]) => <tr key={m}><Td className="font-medium text-ink">{m}</Td><Td className="text-xs">{d}</Td><Td className="font-mono text-[11px]">{s}</Td></tr>)}</tbody>
        </Table>
      </Card>
      <Card title="Minimum provenance schema" subtitle="Attached to every observation. Full PostgreSQL DDL in /db/schema.sql.">
        <pre className="overflow-x-auto rounded-lg bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink-2">{`entity_id
market
service_line
observed_value
unit
currency
source_url
source_type
observed_at
effective_date
confidence           -- high | medium | low
verification_status  -- verified | pending | unverified | disputed
analyst
last_reviewed_at`}</pre>
        <p className="mt-3 text-xs text-muted">Price types are kept separate: publicly advertised, external estimate, negotiated competitor quote and actual Hexa deal — each with commercial scope.</p>
      </Card>
    </div>
  );
}

function AddObservation({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (o: Observation) => void }) {
  const { state } = useIntel();
  const [f, setF] = useState({ entity_id: "hexa", field: "", observed_value: "", unit: "", currency: "", market: "" as CountryCode | "", service_line: "" as Arena | "", source_url: "", source_type: "company_website" as SourceType, effective_date: "", confidence: "medium" as Confidence });
  return (
    <Modal open={open} onClose={onClose} title="Log observation">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Entity"><Select value={f.entity_id} onChange={(v) => setF({ ...f, entity_id: v })} options={[{ value: "hexa", label: "Hexa" }, ...state.competitors.map((c) => ({ value: c.id, label: c.name })), ...state.accounts.map((a) => ({ value: a.id, label: `Account: ${a.name}` }))]} /></Field>
        <Field label="Field"><Input value={f.field} onChange={(e) => setF({ ...f, field: e.target.value })} placeholder="e.g. published_price, headcount" /></Field>
        <Field label="Observed value"><Input value={f.observed_value} onChange={(e) => setF({ ...f, observed_value: e.target.value })} /></Field>
        <Field label="Unit"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
        <Field label="Currency"><Input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} /></Field>
        <Field label="Market"><Select value={f.market} onChange={(v) => setF({ ...f, market: v })} options={[{ value: "", label: "—" }, ...(["AU", "MY", "SG", "ID", "NP", "UK", "US"] as CountryCode[]).map((c) => ({ value: c, label: c }))]} /></Field>
        <Field label="Service line"><Select value={f.service_line} onChange={(v) => setF({ ...f, service_line: v })} options={[{ value: "", label: "—" }, ...ARENAS.map((a) => ({ value: a, label: ARENA_SHORT[a] }))]} /></Field>
        <Field label="Source type"><Select value={f.source_type} onChange={(v) => setF({ ...f, source_type: v })} options={SOURCE_TYPES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))} /></Field>
        <Field label="Source URL"><Input value={f.source_url} onChange={(e) => setF({ ...f, source_url: e.target.value })} /></Field>
        <Field label="Effective date"><Input type="date" value={f.effective_date} onChange={(e) => setF({ ...f, effective_date: e.target.value })} /></Field>
        <Field label="Confidence"><Select value={f.confidence} onChange={(v) => setF({ ...f, confidence: v })} options={["high", "medium", "low"].map((c) => ({ value: c as Confidence, label: c }))} /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => {
          if (!f.field || !f.observed_value) return;
          onAdd({ id: uid("o"), entity_id: f.entity_id, field: f.field, observed_value: f.observed_value, unit: f.unit || undefined, currency: f.currency || undefined, market: f.market || undefined, service_line: f.service_line || undefined, source_url: f.source_url || undefined, source_type: f.source_type, observed_at: today(), effective_date: f.effective_date || undefined, confidence: f.confidence, verification_status: "unverified", analyst: "You" });
          onClose();
        }}>Log</Button>
      </div>
    </Modal>
  );
}
