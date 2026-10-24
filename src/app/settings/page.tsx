"use client";

import { useRef, useState } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { useIntel, type IntelState } from "@/lib/store";
import { DEFAULT_WEIGHTS } from "@/lib/scoring";
import { HEXA } from "@/lib/data/seed";
import { Badge, Button, Card, PageHeader, Slider, pct } from "@/components/ui";

export default function Settings() {
  const { state, set, reset, replace } = useIntel();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const tw = state.weights.threat;
  const pw = state.weights.propensity;
  const sumT = Object.values(tw).reduce((a, b) => a + b, 0);
  const sumP = Object.values(pw).reduce((a, b) => a + b, 0);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hexa-intel-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportCsv = (key: "competitors" | "accounts" | "observations" | "signals") => {
    const rows = state[key] as unknown as Record<string, unknown>[];
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const esc = (v: unknown) => `"${(typeof v === "object" ? JSON.stringify(v) : String(v ?? "")).replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${key}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Models & data" subtitle="Scoring weights, data import/export and platform configuration. Data persists in this browser until the PostgreSQL backend (db/schema.sql) is connected." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Competitor threat weights" subtitle={`Blueprint default 30/25/20/15/10 · normalised (sum ${sumT.toFixed(2)})`} actions={<Button size="sm" variant="ghost" onClick={() => set("weights", (w) => ({ ...w, threat: DEFAULT_WEIGHTS.threat }))}><RotateCcw className="h-3 w-3" /> Default</Button>}>
          <div className="space-y-3">
            {(Object.keys(tw) as (keyof typeof tw)[]).map((k) => (
              <Slider key={k} label={k.replace(/_/g, " ")} min={0} max={0.5} step={0.05} value={tw[k]} onChange={(v) => set("weights", (w) => ({ ...w, threat: { ...w.threat, [k]: v } }))} format={(v) => pct(v / sumT)} />
            ))}
          </div>
        </Card>
        <Card title="Account propensity weights" subtitle={`Normalised (sum ${sumP.toFixed(2)})`} actions={<Button size="sm" variant="ghost" onClick={() => set("weights", (w) => ({ ...w, propensity: DEFAULT_WEIGHTS.propensity }))}><RotateCcw className="h-3 w-3" /> Default</Button>}>
          <div className="space-y-3">
            {(Object.keys(pw) as (keyof typeof pw)[]).map((k) => (
              <Slider key={k} label={k} min={0} max={0.5} step={0.05} value={pw[k]} onChange={(v) => set("weights", (w) => ({ ...w, propensity: { ...w.propensity, [k]: v } }))} format={(v) => pct(v / sumP)} />
            ))}
          </div>
        </Card>
        <Card title="Data" subtitle="Export for backup or analysis; import a previously exported JSON">
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportJson}><Download className="h-4 w-4" /> Export all (JSON)</Button>
            {(["competitors", "accounts", "observations", "signals"] as const).map((k) => <Button key={k} size="sm" variant="ghost" onClick={() => exportCsv(k)}>{k}.csv</Button>)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => file.current?.click()}><Upload className="h-4 w-4" /> Import JSON</Button>
            <Button variant="danger" onClick={() => { if (confirm("Reset all data to seed? Your edits in this browser will be lost.")) { reset(); setMsg("Reset to seed data."); } }}><RotateCcw className="h-4 w-4" /> Reset to seed</Button>
            <input ref={file} type="file" accept="application/json" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const parsed = JSON.parse(await f.text()) as IntelState;
                if (!Array.isArray(parsed.competitors)) throw new Error("Not a platform export");
                replace(parsed);
                setMsg(`Imported ${f.name}.`);
              } catch (err) {
                setMsg(`Import failed: ${(err as Error).message}`);
              }
            }} />
          </div>
          {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
            {(["competitors", "markets", "accounts", "pricing", "signals", "observations", "opportunities", "tasks", "sources"] as const).map((k) => (
              <div key={k} className="rounded bg-surface-2 p-2"><dt className="text-muted">{k}</dt><dd className="font-semibold tabular-nums text-ink">{state[k].length}</dd></div>
            ))}
          </dl>
        </Card>
        <Card title="Hexa positioning" subtitle="Maintain verified documentation and claim dates for differentiators">
          <div className="space-y-3">
            {HEXA.models.map((m) => (
              <div key={m.title} className="rounded-lg bg-surface-2 p-3">
                <div className="text-sm font-semibold text-ink">{m.title} — {m.subtitle}</div>
                <div className="text-xs text-muted">{m.services}</div>
              </div>
            ))}
            <div className="flex flex-wrap gap-1">{HEXA.differentiators.map((d) => <Badge key={d} tone="green">{d}</Badge>)}</div>
            <div className="text-xs text-muted">Integrate rather than rebuild: {HEXA.products.join(", ")}</div>
          </div>
        </Card>
        <Card className="lg:col-span-2" title="Integrations roadmap" subtitle="Build proprietary models, scoring and UI; buy/licence high-cost external data where justified">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["AI analyst", "Set ANTHROPIC_API_KEY in Vercel to enable Claude-grounded answers and outreach drafts.", "ready"],
              ["PostgreSQL (Neon)", "Schema in db/schema.sql — append-only observations, score versions, audit trail.", "next"],
              ["CRM", "Sync accounts, opportunities, activities and win/loss reasons.", "planned"],
              ["Change monitoring", "Visualping / Crayon webhooks → Signals.", "planned"],
              ["Enrichment", "Apollo / Clay for firmographics & verified contacts (record lawful basis).", "planned"],
              ["Digital intel", "Semrush / Similarweb for keyword gaps and traffic.", "planned"],
              ["Regulatory feeds", "Official gazettes / regulator RSS for AU, MY, SG, ID, NP.", "planned"],
              ["Hexa systems", "HexaInsights, HexaComply, APEX — delivery cost & utilisation.", "planned"],
            ].map(([t, d, s]) => (
              <div key={t} className="rounded-lg border border-line p-3">
                <div className="flex items-center justify-between"><span className="font-medium text-ink">{t}</span><Badge tone={s === "ready" ? "green" : s === "next" ? "blue" : "slate"}>{s}</Badge></div>
                <p className="mt-1 text-xs text-muted">{d}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
