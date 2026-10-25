"use client";

import { useMemo, useState } from "react";
import { Copy, Plus, Search, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { useIntel, uid } from "@/lib/store";
import { useFocusParam } from "@/lib/hooks";
import { propensity } from "@/lib/scoring";
import { ARENAS, ARENA_LABEL, ARENA_SHORT, COUNTRY_FLAG, COUNTRY_LABEL, SIGNAL_LABEL } from "@/lib/labels";
import type { Account, Arena, Contact, CountryCode, Segment } from "@/lib/types";
import { ContactReveal, FindAccounts, FindPeople } from "@/components/prospecting";
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, ScoreBar, Select, Table, Td, Textarea, Th, UrgencyBadge } from "@/components/ui";

const STATUSES: Account["status"][] = ["new", "researching", "contacted", "engaged", "opportunity", "customer", "disqualified"];

export default function Accounts() {
  const { state, set, status } = useIntel();
  const [focus, setFocus] = useFocusParam();
  const [finding, setFinding] = useState(false);
  const [country, setCountry] = useState<CountryCode | "all">("all");
  const [arena, setArena] = useState<Arena | "all">("all");
  const [tier, setTier] = useState<"all" | "A" | "B" | "C">("all");
  const [adding, setAdding] = useState(false);

  const rows = useMemo(
    () =>
      state.accounts
        .map((a) => ({ a, p: propensity(a, state.signals, state.weights.propensity) }))
        .filter(({ a }) => country === "all" || a.country === country)
        .filter(({ a }) => arena === "all" || a.target_arena === arena)
        .filter(({ p }) => tier === "all" || p.tier === tier)
        .sort((x, y) => y.p.score - x.p.score),
    [state, country, arena, tier],
  );
  const sel = rows.find((r) => r.a.id === focus) ?? rows[0];
  const countries = [...new Set(state.accounts.map((a) => a.country))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Target accounts"
        subtitle="Propensity combines ICP fit, outsourcing readiness, trigger signals, decision-maker access and displaceability. Each account answers why this company, why this service, why now."
        actions={<><Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add manually</Button><Button variant="primary" onClick={() => setFinding(true)} disabled={!status?.apollo} title={status?.apollo ? "" : "Set APOLLO_API_KEY in Vercel"}><Search className="h-4 w-4" /> Find accounts (Apollo)</Button></>}
      />
      <div className="rounded-lg border border-warn-200 bg-warn-50 px-4 py-2.5 text-xs text-warn">
        Accounts come live from Apollo (firmographics + open roles) and Lusha (enrichment), or are added manually by BD. ICP fit and readiness start at 3 — review them, and record lawful basis per contact.{!status?.apollo && " Apollo is not connected yet: add APOLLO_API_KEY in Vercel → Settings → Environment Variables."}
      </div>
      <div className="flex flex-wrap gap-3">
        <Select label="Country" value={country} onChange={setCountry} options={[{ value: "all", label: "All" }, ...countries.map((c) => ({ value: c, label: `${COUNTRY_FLAG[c]} ${c}` }))]} />
        <Select label="Service" value={arena} onChange={setArena} options={[{ value: "all", label: "All" }, ...ARENAS.map((a) => ({ value: a, label: ARENA_SHORT[a] }))]} />
        <Select label="Tier" value={tier} onChange={setTier} options={[{ value: "all", label: "All" }, { value: "A", label: "A (75+)" }, { value: "B", label: "B (60–74)" }, { value: "C", label: "C" }]} />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2" pad={false}>
          <Table>
            <thead><tr><Th>Account</Th><Th className="w-36">Propensity</Th><Th>Status</Th></tr></thead>
            <tbody>
              {rows.map(({ a, p }) => (
                <tr key={a.id} onClick={() => setFocus(a.id)} className={`cursor-pointer hover:bg-surface-2 ${sel?.a.id === a.id ? "bg-brand-50" : ""}`}>
                  <Td>
                    <div className="flex items-center gap-1.5 font-medium text-ink">{a.name}</div>
                    <div className="text-xs text-muted">{COUNTRY_FLAG[a.country]} {a.industry} · {ARENA_SHORT[a.target_arena]}</div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2"><Badge tone={p.tier === "A" ? "green" : p.tier === "B" ? "blue" : "slate"}>{p.tier}</Badge><div className="flex-1"><ScoreBar value={p.score} /></div></div>
                  </Td>
                  <Td><Badge>{a.status}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <div className="min-w-0 xl:col-span-3">{sel ? <AccountDetail a={sel.a} p={sel.p} /> : <Empty>{state.accounts.length ? "No accounts match the filters." : "No accounts yet. Use “Find accounts (Apollo)” — e.g. the AU accounting firms preset — or add one manually."}</Empty>}</div>
      </div>
      <FindAccounts open={finding} onClose={() => setFinding(false)} />
      <AddAccount open={adding} onClose={() => setAdding(false)} onAdd={(a) => set("accounts", (xs) => [...xs, a])} />
    </div>
  );
}

function AccountDetail({ a, p }: { a: Account; p: ReturnType<typeof propensity> }) {
  const { state, set } = useIntel();
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [findingPeople, setFindingPeople] = useState(false);
  const { status } = useIntel();
  const sigs = state.signals.filter((s) => a.signals.includes(s.id) || s.entity_id === a.id);
  const inc = state.competitors.find((c) => c.id === a.incumbent);
  const upd = (patch: Partial<Account>) => set("accounts", (xs) => xs.map((x) => (x.id === a.id ? { ...x, ...patch } : x)));
  const dm = a.contacts.find((c) => c.influence === "decision_maker") ?? a.contacts[0];

  const template = () =>
    `Subject: ${a.why_now.split(";")[0].replace(/\.$/, "")} — a thought for ${a.name}\n\nHi ${dm ? dm.role : "there"},\n\n${a.why_now} Many ${a.segment.toLowerCase()} in ${COUNTRY_LABEL[a.country]} we speak with face the same challenge.\n\n${a.why_service} Hexa runs this as a managed ${ARENA_LABEL[a.target_arena].toLowerCase()} service — with senior oversight, ISO 27001 controls and a named lead — rather than a staffing seat.${inc ? `\n\nIf you're comparing with ${inc.name}, we're happy to set out an equivalent-scope comparison.` : ""}\n\nWould a 20-minute call next week be useful? I can share a cost comparison for your exact roles.\n\nBest regards,\nHexamatics`;

  const aiDraft = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "outreach",
          question: `Write a concise, evidence-backed first outreach email (max 140 words) to the ${dm?.role ?? "decision-maker"} at ${a.name}. Why company: ${a.why_company}. Why service: ${a.why_service}. Why now: ${a.why_now}. Incumbent: ${inc?.name ?? "none"}. Service: ${ARENA_LABEL[a.target_arena]}. Do not invent facts or statistics.`,
          context: "",
        }),
      });
      const j = await r.json();
      setDraft(j.answer ?? template());
    } catch {
      setDraft(template());
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Card
        title={<span className="flex items-center gap-2">{a.name}</span>}
        subtitle={`${COUNTRY_FLAG[a.country]} ${a.location || COUNTRY_LABEL[a.country]} · ${a.industry} · ${a.segment} · ${a.headcount || "?"} staff${a.source ? ` · source: ${a.source}` : ""}${a.enriched_at ? ` · refreshed ${a.enriched_at}` : ""}`}
        actions={<Select value={a.status} onChange={(v) => upd({ status: v })} options={STATUSES.map((s) => ({ value: s, label: s }))} />}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[["Why this company", a.why_company], ["Why this service", a.why_service], ["Why now", a.why_now]].map(([t, v]) => (
            <div key={t} className="rounded-lg bg-surface-2 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">{t}</div>
              <div className="mt-1 text-sm text-ink-2">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
          <div>
            <div className="mb-2 text-xs font-medium text-muted">Propensity {p.score} · tier {p.tier}</div>
            <div className="space-y-1.5">
              {p.parts.map((x) => (
                <div key={x.factor} className="flex items-center gap-2 text-xs"><span className="w-24 text-ink-2">{x.factor}</span><div className="flex-1"><ScoreBar value={x.value} max={30} tone="brand" /></div></div>
              ))}
            </div>
          </div>
          <div className="space-y-2 text-xs">
            <div><span className="text-muted">Incumbent / alternative: </span><span className="text-ink-2">{inc?.name ?? "None identified"}</span></div>
            <div><span className="text-muted">Software: </span>{a.software.map((s) => <Badge key={s} className="mr-1">{s}</Badge>)}</div>
            <div><span className="text-muted">Owner: </span><span className="text-ink-2">{a.owner}</span></div>
            {(a.website || a.domain) && <div><span className="text-muted">Web: </span><a className="text-brand-700 hover:underline" href={a.website || `https://${a.domain}`} target="_blank" rel="noreferrer">{a.domain || a.website}</a>{a.linkedin_url && <> · <a className="text-brand-700 hover:underline" href={a.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a></>}</div>}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <label className="text-muted">ICP fit <Select value={String(a.fit)} onChange={(v) => upd({ fit: +v })} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} /></label>
              <label className="text-muted">Readiness <Select value={String(a.outsourcing_readiness)} onChange={(v) => upd({ outsourcing_readiness: +v })} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} /></label>
            </div>
            {!!a.open_roles?.length && (
              <div className="pt-1">
                <div className="mb-1 text-muted">Open roles (Apollo, live)</div>
                {a.open_roles.slice(0, 6).map((r, i) => (
                  <div key={i} className="truncate text-ink-2">• {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="hover:underline">{r.title}</a> : r.title}{r.posted_at ? <span className="text-subtle"> · {r.posted_at.slice(0, 10)}</span> : null}</div>
                ))}
              </div>
            )}
            <div className="pt-1">
              <div className="mb-1 text-muted">Trigger signals</div>
              {sigs.length ? sigs.map((s) => (
                <div key={s.id} className="mb-1 flex items-center gap-1.5"><UrgencyBadge u={s.urgency} /><Badge>{SIGNAL_LABEL[s.type]}</Badge><span className="truncate text-ink-2">{s.title}</span></div>
              )) : <span className="text-subtle">None — monitor</span>}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Buying group" subtitle="Verified business contacts only; lawful basis recorded per person" actions={<div className="flex gap-1.5">{status?.apollo && <Button size="sm" variant="primary" onClick={() => setFindingPeople(true)}><Search className="h-3.5 w-3.5" /> Find (Apollo)</Button>}<Button size="sm" onClick={() => setAddingContact(true)}><UserPlus className="h-3.5 w-3.5" /> Add</Button></div>} pad={false}>
        {a.contacts.length ? (
          <Table>
            <thead><tr><Th>Contact</Th><Th>Influence</Th><Th>Relationship</Th><Th>Privacy</Th><Th>Contact details</Th></tr></thead>
            <tbody>
              {a.contacts.map((c) => (
                <tr key={c.id}>
                  <Td><div className="font-medium text-ink">{c.name}</div><div className="text-xs text-muted">{c.role} · {c.seniority}</div></Td>
                  <Td><Badge tone={c.influence === "decision_maker" ? "red" : c.influence === "champion" ? "green" : "slate"}>{c.influence.replace("_", " ")}</Badge></Td>
                  <Td><Badge>{c.relationship}</Badge></Td>
                  <Td>
                    <div className="flex flex-col gap-1 text-[11px]">
                      <span className="text-muted">{c.lawful_basis.replace(/_/g, " ")}</span>
                      {c.verified ? <Badge tone="green"><ShieldCheck className="h-3 w-3" /> verified</Badge> : <Badge tone="amber">unverified</Badge>}
                    </div>
                  </Td>
                  <Td>
                    <ContactReveal account={a} contact={c} onUpdate={(nc) => upd({ contacts: a.contacts.map((x) => (x.id === c.id ? nc : x)) })} />
                    {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="mt-1 block text-[11px] text-muted hover:underline">LinkedIn</a>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <div className="p-5"><Empty>No contacts yet. {status?.apollo ? "Use “Find (Apollo)” to pull decision-makers." : "Add contacts manually, or connect Apollo."}</Empty></div>}
      </Card>

      <Card title="Evidence-backed outreach" subtitle="Template uses only the account's recorded why/why-now; AI draft uses the Ask endpoint if configured">
        <div className="mb-3 flex flex-wrap gap-2">
          <Button onClick={() => setDraft(template())}>Use template</Button>
          <Button variant="primary" onClick={aiDraft} disabled={loading}><Sparkles className="h-4 w-4" /> {loading ? "Drafting…" : "Draft with AI"}</Button>
          {draft && <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(draft)}><Copy className="h-4 w-4" /> Copy</Button>}
        </div>
        <Textarea rows={draft ? 12 : 3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Generate a draft, then edit before sending." />
      </Card>
      <FindPeople account={a} open={findingPeople} onClose={() => setFindingPeople(false)} onAdd={(cs) => upd({ contacts: [...a.contacts, ...cs] })} />
      <AddContact open={addingContact} onClose={() => setAddingContact(false)} onAdd={(c) => upd({ contacts: [...a.contacts, c] })} />
    </div>
  );
}

function AddContact({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (c: Contact) => void }) {
  const [f, setF] = useState<Omit<Contact, "id">>({ name: "", role: "", department: "", seniority: "C-level", influence: "decision_maker", relationship: "none", lawful_basis: "legitimate_interest", verified: false, source_type: "crm" });
  return (
    <Modal open={open} onClose={onClose} title="Add contact">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Role"><Input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></Field>
        <Field label="Seniority"><Select value={f.seniority} onChange={(v) => setF({ ...f, seniority: v })} options={["C-level", "VP/Director", "Manager", "Individual"].map((x) => ({ value: x as Contact["seniority"], label: x }))} /></Field>
        <Field label="Influence"><Select value={f.influence} onChange={(v) => setF({ ...f, influence: v })} options={["decision_maker", "champion", "influencer", "gatekeeper"].map((x) => ({ value: x as Contact["influence"], label: x.replace("_", " ") }))} /></Field>
        <Field label="Lawful basis"><Select value={f.lawful_basis} onChange={(v) => setF({ ...f, lawful_basis: v })} options={["legitimate_interest", "consent", "existing_relationship"].map((x) => ({ value: x as Contact["lawful_basis"], label: x.replace(/_/g, " ") }))} /></Field>
        <Field label="Verified business contact?"><Select value={f.verified ? "y" : "n"} onChange={(v) => setF({ ...f, verified: v === "y" })} options={[{ value: "n", label: "No" }, { value: "y", label: "Yes" }]} /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { if (f.name) { onAdd({ ...f, id: uid("ct") }); onClose(); } }}>Add</Button></div>
    </Modal>
  );
}

function AddAccount({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (a: Account) => void }) {
  const [f, setF] = useState({ name: "", country: "AU" as CountryCode, industry: "", segment: "SME" as Segment, headcount: "50", arena: "finance_outsourcing" as Arena, why_company: "", why_service: "", why_now: "", fit: "3", readiness: "3" });
  return (
    <Modal open={open} onClose={onClose} title="Add target account">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Industry"><Input value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} /></Field>
        <Field label="Country"><Select value={f.country} onChange={(v) => setF({ ...f, country: v })} options={(["AU", "MY", "SG", "ID", "NP", "UK", "US"] as CountryCode[]).map((c) => ({ value: c, label: COUNTRY_LABEL[c] }))} /></Field>
        <Field label="Segment"><Select value={f.segment} onChange={(v) => setF({ ...f, segment: v })} options={(["SME", "Mid-market", "Enterprise", "Accounting firms", "Scale-ups"] as Segment[]).map((s) => ({ value: s, label: s }))} /></Field>
        <Field label="Target service"><Select value={f.arena} onChange={(v) => setF({ ...f, arena: v })} options={ARENAS.map((a) => ({ value: a, label: ARENA_SHORT[a] }))} /></Field>
        <Field label="Headcount"><Input type="number" value={f.headcount} onChange={(e) => setF({ ...f, headcount: e.target.value })} /></Field>
        <Field label="ICP fit (1–5)"><Input type="number" min={1} max={5} value={f.fit} onChange={(e) => setF({ ...f, fit: e.target.value })} /></Field>
        <Field label="Outsourcing readiness (1–5)"><Input type="number" min={1} max={5} value={f.readiness} onChange={(e) => setF({ ...f, readiness: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="Why this company"><Input value={f.why_company} onChange={(e) => setF({ ...f, why_company: e.target.value })} /></Field></div>
        <div className="sm:col-span-2"><Field label="Why this service"><Input value={f.why_service} onChange={(e) => setF({ ...f, why_service: e.target.value })} /></Field></div>
        <div className="sm:col-span-2"><Field label="Why now (cite source)"><Input value={f.why_now} onChange={(e) => setF({ ...f, why_now: e.target.value })} /></Field></div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => {
          if (!f.name) return;
          onAdd({ id: uid("acc"), name: f.name, sample: false, country: f.country, industry: f.industry, segment: f.segment, headcount: +f.headcount, revenue_band: "—", software: [], target_arena: f.arena, signals: [], fit: +f.fit, outsourcing_readiness: +f.readiness, status: "new", owner: "BizDev", why_company: f.why_company, why_service: f.why_service, why_now: f.why_now, contacts: [] });
          onClose();
        }}>Add</Button>
      </div>
    </Modal>
  );
}
