"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { useIntel, uid, today } from "@/lib/store";
import { recommendations } from "@/lib/insights";
import type { Decision, Task, Urgency } from "@/lib/types";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, UrgencyBadge } from "@/components/ui";

const COLS: { id: Task["status"]; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "In progress" },
  { id: "done", label: "Done" },
];

export default function Strategy() {
  const { state, set } = useIntel();
  const [view, setView] = useState<"recs" | "tasks" | "log" | "priorities">("recs");
  const [addTask, setAddTask] = useState(false);
  const [addDecision, setAddDecision] = useState(false);
  const recs = recommendations(state);
  const now = today();

  const toTask = (title: string, owner: string, urgency: Urgency, linked?: string) =>
    set("tasks", (xs) => (xs.some((t) => t.title === title) ? xs : [...xs, { id: uid("t"), title, owner, role: owner.includes("Finance") ? "Finance" : owner.includes("BizDev") ? "BizDev" : owner.includes("Strategy") ? "Strategy" : "Intelligence", status: "todo", due: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), priority: urgency, linked }]));

  return (
    <div className="space-y-6">
      <PageHeader title="Strategy & tasks" subtitle="Turn intelligence into owned actions. Weekly 30-minute decision review: recommendations → tasks → decisions with evidence and review dates." />
      <Tabs value={view} onChange={setView} tabs={[{ value: "recs", label: "Recommendations", count: recs.length }, { value: "tasks", label: "Task board", count: state.tasks.filter((t) => t.status !== "done").length }, { value: "log", label: "Decision log", count: state.decisions.length }, { value: "priorities", label: "Strategic priorities" }]} />

      {view === "recs" && (
        <div className="grid gap-3 md:grid-cols-2">
          {recs.map((r) => {
            const tasked = state.tasks.some((t) => t.title === r.title);
            return (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2"><UrgencyBadge u={r.urgency} /><Badge>impact {r.impact}/5</Badge></div>
                  <span className="text-xs text-muted">{r.owner}</span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-ink">{r.title}</h3>
                <p className="mt-1 text-sm text-ink-2">{r.rationale}</p>
                <div className="mt-2 flex flex-wrap gap-1">{r.evidence.map((e) => <Badge key={e} className="font-mono">{e.length > 40 ? e.slice(0, 40) + "…" : e}</Badge>)}</div>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" variant={tasked ? "secondary" : "primary"} disabled={tasked} onClick={() => toTask(r.title, r.owner, r.urgency, r.evidence[0])}>{tasked ? "Task created" : "Create task"}</Button>
                  {r.href && <Link href={r.href} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">Open evidence <ArrowRight className="h-3 w-3" /></Link>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {view === "tasks" && (
        <>
          <div className="flex justify-end"><Button variant="primary" onClick={() => setAddTask(true)}><Plus className="h-4 w-4" /> New task</Button></div>
          <div className="grid gap-4 md:grid-cols-3">
            {COLS.map((col) => (
              <div
                key={col.id}
                className="rounded-xl border border-line bg-surface-2 p-3"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/plain");
                  set("tasks", (xs) => xs.map((t) => (t.id === id ? { ...t, status: col.id } : t)));
                }}
              >
                <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  {col.label}<span>{state.tasks.filter((t) => t.status === col.id).length}</span>
                </div>
                <div className="space-y-2">
                  {state.tasks.filter((t) => t.status === col.id).map((t) => (
                    <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)} className="cursor-grab rounded-lg border border-line bg-surface p-3 shadow-sm active:cursor-grabbing">
                      <div className="text-sm font-medium text-ink">{t.title}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <UrgencyBadge u={t.priority} />
                        <Badge>{t.role}</Badge>
                        <Badge tone={t.status !== "done" && t.due < now ? "red" : "slate"}>due {t.due}</Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-muted">{t.owner}</span>
                        <Select value={t.status} onChange={(v) => set("tasks", (xs) => xs.map((x) => (x.id === t.id ? { ...x, status: v } : x)))} options={COLS.map((c) => ({ value: c.id, label: c.label }))} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {view === "log" && (
        <>
          <div className="flex justify-end"><Button variant="primary" onClick={() => setAddDecision(true)}><Plus className="h-4 w-4" /> Record decision</Button></div>
          <div className="space-y-3">
            {[...state.decisions].reverse().map((d) => (
              <Card key={d.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{d.title}</h3>
                  <div className="flex gap-1.5"><Badge>{d.date}</Badge><Badge tone={d.review_on < now ? "red" : "blue"}>review {d.review_on}</Badge><Badge>{d.owner}</Badge></div>
                </div>
                <p className="mt-2 text-sm text-ink-2"><b className="text-ink">Context:</b> {d.context}</p>
                <p className="mt-1 text-sm text-ink-2"><b className="text-ink">Decision:</b> {d.decision}</p>
                <div className="mt-2 flex flex-wrap gap-1">{d.evidence.map((e) => <Badge key={e} className="font-mono">{e}</Badge>)}</div>
              </Card>
            ))}
          </div>
        </>
      )}

      {view === "priorities" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { n: 1, t: "Finance outsourcing — Australia, Malaysia and Singapore", d: "Deepest research first: in-house hiring economics, offshore finance vendors, accounting-firm prospects, qualifications, decision-makers and pricing. Best aligned with Hexa's specialist professional-capability proposition.", href: "/markets" },
            { n: 2, t: "Regional EOR and payroll intelligence", d: "Track labour regulation, country coverage, compliance deadlines, EOR fees and cross-border hiring demand. Compare full service scope, not headline monthly fees.", href: "/pricing" },
            { n: 3, t: "Technology and capability-centre opportunities", d: "Track scaling tech teams, AI/automation initiatives and offshore engineering demand. Pursue only where Hexa has verified skills and profitable delivery capacity.", href: "/accounts" },
          ].map((p) => (
            <Card key={p.n}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">Priority {p.n}</div>
              <h3 className="mt-1 font-semibold text-ink">{p.t}</h3>
              <p className="mt-2 text-sm text-ink-2">{p.d}</p>
              <Link href={p.href} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">Open <ArrowRight className="h-3 w-3" /></Link>
            </Card>
          ))}
          <Card className="lg:col-span-3" title="Ownership">
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
              {[["Strategy / management", "Priorities, markets, investment decisions"], ["Intelligence analyst", "Research, provenance, competitor profiles"], ["Business development", "Account validation, buyer discovery, win/loss evidence"], ["Finance", "Prices, cost models, margins, scenarios"], ["Developer / data engineer", "Database, ingestion, UI and integrations"]].map(([o, r]) => (
                <div key={o} className="rounded-lg bg-surface-2 p-3"><div className="font-medium text-ink">{o}</div><div className="mt-1 text-xs text-muted">{r}</div></div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <TaskModal open={addTask} onClose={() => setAddTask(false)} onAdd={(t) => set("tasks", (xs) => [...xs, t])} />
      <DecisionModal open={addDecision} onClose={() => setAddDecision(false)} onAdd={(d) => set("decisions", (xs) => [...xs, d])} />
    </div>
  );
}

function TaskModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (t: Task) => void }) {
  const [f, setF] = useState<Omit<Task, "id">>({ title: "", owner: "", role: "Intelligence", status: "todo", due: today(), priority: "medium" });
  return (
    <Modal open={open} onClose={onClose} title="New task">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field></div>
        <Field label="Owner"><Input value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></Field>
        <Field label="Role"><Select value={f.role} onChange={(v) => setF({ ...f, role: v })} options={["Strategy", "Intelligence", "BizDev", "Finance", "Engineering"].map((r) => ({ value: r as Task["role"], label: r }))} /></Field>
        <Field label="Due"><Input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
        <Field label="Priority"><Select value={f.priority} onChange={(v) => setF({ ...f, priority: v })} options={["critical", "high", "medium", "low"].map((r) => ({ value: r as Urgency, label: r }))} /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (f.title) { onAdd({ ...f, id: uid("t") }); onClose(); } }}>Add</Button></div>
    </Modal>
  );
}

function DecisionModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (d: Decision) => void }) {
  const [f, setF] = useState({ title: "", context: "", decision: "", owner: "Management", evidence: "", review_on: new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10) });
  return (
    <Modal open={open} onClose={onClose} title="Record decision">
      <div className="space-y-3">
        <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Context"><Textarea rows={2} value={f.context} onChange={(e) => setF({ ...f, context: e.target.value })} /></Field>
        <Field label="Decision"><Textarea rows={2} value={f.decision} onChange={(e) => setF({ ...f, decision: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Owner"><Input value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></Field>
          <Field label="Evidence (comma-sep.)"><Input value={f.evidence} onChange={(e) => setF({ ...f, evidence: e.target.value })} /></Field>
          <Field label="Review on"><Input type="date" value={f.review_on} onChange={(e) => setF({ ...f, review_on: e.target.value })} /></Field>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (f.title) { onAdd({ id: uid("d"), date: today(), title: f.title, context: f.context, decision: f.decision, owner: f.owner, evidence: f.evidence.split(",").map((s) => s.trim()).filter(Boolean), review_on: f.review_on }); onClose(); } }}>Record</Button></div>
    </Modal>
  );
}
