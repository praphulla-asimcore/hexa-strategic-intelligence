"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useIntel, uid, today } from "@/lib/store";
import { useFocusParam } from "@/lib/hooks";
import { ARENA_SHORT, SIGNAL_LABEL, URGENCY_ORDER } from "@/lib/labels";
import type { Signal, SignalType, Urgency } from "@/lib/types";
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, ProvenanceLine, Select, Stat, Tabs, Textarea, UrgencyBadge } from "@/components/ui";

export default function Alerts() {
  const { state, set } = useIntel();
  const [focus] = useFocusParam();
  const [status, setStatus] = useState<Signal["status"] | "open">("open");
  const [type, setType] = useState<SignalType | "all">("all");
  const [adding, setAdding] = useState(false);
  const now = today();

  const list = useMemo(
    () =>
      state.signals
        .filter((s) => (status === "open" ? s.status === "new" || s.status === "triaged" : s.status === status))
        .filter((s) => type === "all" || s.type === type)
        .sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] || a.due_date.localeCompare(b.due_date)),
    [state.signals, status, type],
  );
  const upd = (id: string, patch: Partial<Signal>) => set("signals", (xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const entityHref = (s: Signal) => (s.entity_kind === "competitor" ? `/competitors/${s.entity_id}` : s.entity_kind === "account" ? `/accounts?focus=${s.entity_id}` : `/markets?focus=${s.entity_id}`);
  const counts = (st: Signal["status"]) => state.signals.filter((s) => s.status === st).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Alerts" subtitle="Material competitor, customer, regulatory and market changes — each with an owner, urgency, due date and recommended action." actions={<Button variant="primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Log signal</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="New" value={counts("new")} tone={counts("new") > 5 ? "warn" : "default"} />
        <Stat label="Triaged" value={counts("triaged")} />
        <Stat label="Overdue" value={state.signals.filter((s) => (s.status === "new" || s.status === "triaged") && s.due_date < now).length} tone="bad" />
        <Stat label="Actioned" value={counts("actioned")} tone="good" />
      </div>
      <Tabs value={status} onChange={setStatus} tabs={[{ value: "open", label: "Open" }, { value: "new", label: "New" }, { value: "triaged", label: "Triaged" }, { value: "actioned", label: "Actioned" }, { value: "dismissed", label: "Dismissed" }]} />
      <Select label="Type" value={type} onChange={setType} options={[{ value: "all", label: "All types" }, ...(Object.keys(SIGNAL_LABEL) as SignalType[]).map((t) => ({ value: t, label: SIGNAL_LABEL[t] }))]} />
      <div className="space-y-3">
        {list.length === 0 && <Empty>Nothing here.</Empty>}
        {list.map((s) => (
          <Card key={s.id} className={focus === s.id ? "ring-2 ring-brand-500" : ""}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <UrgencyBadge u={s.urgency} />
                  <Badge tone="blue">{SIGNAL_LABEL[s.type]}</Badge>
                  {s.arena && <Badge>{ARENA_SHORT[s.arena]}</Badge>}
                  {s.country && <Badge>{s.country}</Badge>}
                  <Badge tone={s.due_date < now && s.status !== "actioned" ? "red" : "slate"}>due {s.due_date}</Badge>
                  <Badge>impact {s.impact}/5</Badge>
                </div>
                <h3 className="mt-2 font-semibold text-ink"><Link href={entityHref(s)} className="hover:underline">{s.title}</Link></h3>
                <p className="mt-1 text-sm text-ink-2">{s.summary}</p>
                <div className="mt-2 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700"><b>Action:</b> {s.recommended_action}</div>
                <div className="mt-2"><ProvenanceLine p={s.provenance} /></div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 md:w-48">
                <Select label="Owner" value={s.owner} onChange={(v) => upd(s.id, { owner: v })} options={["Strategy", "Intelligence analyst", "BizDev", "Finance", "Engineering"].map((o) => ({ value: o, label: o }))} />
                <div className="flex flex-wrap gap-1">
                  {s.status === "new" && <Button size="sm" onClick={() => upd(s.id, { status: "triaged" })}>Triage</Button>}
                  {s.status !== "actioned" && (
                    <Button size="sm" variant="primary" onClick={() => {
                      upd(s.id, { status: "actioned" });
                      set("tasks", (xs) => [...xs, { id: uid("t"), title: s.recommended_action, owner: s.owner, role: s.owner === "Finance" ? "Finance" : s.owner === "BizDev" ? "BizDev" : s.owner === "Strategy" ? "Strategy" : "Intelligence", status: "todo", due: s.due_date, priority: s.urgency, linked: s.id }]);
                    }}>Action → task</Button>
                  )}
                  {s.status !== "dismissed" && <Button size="sm" variant="ghost" onClick={() => upd(s.id, { status: "dismissed" })}>Dismiss</Button>}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <AddSignal open={adding} onClose={() => setAdding(false)} onAdd={(s) => set("signals", (xs) => [s, ...xs])} />
    </div>
  );
}

function AddSignal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (s: Signal) => void }) {
  const { state } = useIntel();
  const [f, setF] = useState({ type: "web_change" as SignalType, title: "", summary: "", entity: state.competitors[0]?.id ?? "", urgency: "medium" as Urgency, impact: "3", owner: "Intelligence analyst", due: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), action: "", url: "" });
  const entities = [...state.competitors.map((c) => ({ value: `competitor:${c.id}`, label: c.name })), ...state.accounts.map((a) => ({ value: `account:${a.id}`, label: `Account: ${a.name}` })), ...state.markets.map((m) => ({ value: `market:${m.id}`, label: `Market: ${m.id}` }))];
  const [ent, setEnt] = useState(entities[0]?.value ?? "");
  return (
    <Modal open={open} onClose={onClose} title="Log signal">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type"><Select value={f.type} onChange={(v) => setF({ ...f, type: v })} options={(Object.keys(SIGNAL_LABEL) as SignalType[]).map((t) => ({ value: t, label: SIGNAL_LABEL[t] }))} /></Field>
        <Field label="Entity"><Select value={ent} onChange={setEnt} options={entities} /></Field>
        <div className="sm:col-span-2"><Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field></div>
        <div className="sm:col-span-2"><Field label="Summary"><Textarea rows={2} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></Field></div>
        <div className="sm:col-span-2"><Field label="Recommended action"><Input value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} /></Field></div>
        <Field label="Urgency"><Select value={f.urgency} onChange={(v) => setF({ ...f, urgency: v })} options={["critical", "high", "medium", "low"].map((u) => ({ value: u as Urgency, label: u }))} /></Field>
        <Field label="Impact (1–5)"><Input type="number" min={1} max={5} value={f.impact} onChange={(e) => setF({ ...f, impact: e.target.value })} /></Field>
        <Field label="Due"><Input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
        <Field label="Source URL"><Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => {
          if (!f.title) return;
          const [kind, id] = ent.split(":") as [Signal["entity_kind"], string];
          onAdd({ id: uid("sig"), type: f.type, title: f.title, summary: f.summary, entity_id: id, entity_kind: kind, urgency: f.urgency, impact: +f.impact, owner: f.owner, due_date: f.due, status: "new", recommended_action: f.action || "Review and decide", provenance: { source_url: f.url || undefined, source_type: "company_website", observed_at: today(), confidence: f.url ? "medium" : "low", verification_status: "unverified", analyst: "You" } });
          onClose();
        }}>Log</Button>
      </div>
    </Modal>
  );
}
