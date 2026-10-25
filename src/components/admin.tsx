"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, Loader2, Play, RefreshCw } from "lucide-react";
import { useIntel } from "@/lib/store";
import { Badge, Button, Card, Select, Table, Td, Th } from "./ui";

interface AdminData {
  users: { email: string; name: string | null; role: "admin" | "editor" | "viewer"; created_at: string; last_seen: string | null }[];
  audit: { id: number; at: string; actor: string; action: string; collection: string | null; record_id: string | null }[];
}

const JOB_LABEL: Record<string, string> = {
  fx: "FX rates",
  websites: "Competitor website & pricing monitor",
  news: "News & regulatory feeds",
  accounts: "Account hiring signals (Apollo)",
};

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");

export function AdminPanel() {
  const { status, mode, actor, jobs, refresh, notify } = useIntel();
  const [data, setData] = useState<AdminData | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const isAdmin = actor?.role === "admin";

  const load = useCallback(async () => {
    if (mode !== "remote") return;
    const r = await fetch("/api/admin", { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, [mode]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (job?: string) => {
    setRunning(job ?? "all");
    try {
      const r = await fetch(`/api/cron/daily${job ? `?job=${job}` : ""}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Failed (${r.status})`);
      const summary = (j.results as { job: string; ok: boolean; detail: Record<string, unknown> }[])
        .map((x) => `${JOB_LABEL[x.job] ?? x.job}: ${x.ok ? "ok" : "failed"}`)
        .join(" · ");
      notify(summary);
      await refresh();
      await load();
    } catch (e) {
      notify((e as Error).message);
    }
    setRunning(null);
  };

  const setRole = async (email: string, role: string) => {
    const r = await fetch("/api/admin", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, role }) });
    const j = await r.json();
    if (!r.ok) notify(j.error || "Failed");
    await load();
  };

  const items: { key: keyof NonNullable<typeof status>; label: string; how: string }[] = [
    { key: "database", label: "Shared database (Neon Postgres)", how: "Vercel → Storage → Create → Neon → connect to this project" },
    { key: "auth", label: `Google sign-in (@${status?.allowedDomain ?? "hexamatics.com"})`, how: "Set AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET and AUTH_SECRET" },
    { key: "apollo", label: "Apollo — accounts, contacts, job postings", how: "Set APOLLO_API_KEY" },
    { key: "lusha", label: "Lusha — company & contact enrichment", how: "Set LUSHA_API_KEY" },
    { key: "anthropic", label: "Claude — analyst, triage, price extraction", how: "Set ANTHROPIC_API_KEY" },
    { key: "cron", label: "Daily scheduled refresh (Vercel Cron)", how: "Set CRON_SECRET" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Integrations" subtitle="Live connections. Values are never shown — only whether each is configured.">
          <ul className="space-y-2.5">
            {items.map((i) => {
              const on = !!status?.[i.key];
              return (
                <li key={i.key} className="flex items-start gap-2.5">
                  {on ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />}
                  <div>
                    <div className="text-sm text-ink">{i.label}</div>
                    {!on && <div className="text-[11px] text-muted">{i.how} (Vercel → Settings → Environment Variables), then redeploy.</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card
          title="Live data jobs"
          subtitle="Run daily at 21:17 UTC (03:02 Nepal). Admins can run them now."
          actions={isAdmin && mode === "remote" ? <Button size="sm" variant="primary" onClick={() => run()} disabled={!!running}>{running === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Run all</Button> : undefined}
        >
          {mode !== "remote" ? (
            <p className="text-sm text-muted">Jobs need the shared database. Connect Neon first.</p>
          ) : (
            <ul className="space-y-3">
              {Object.keys(JOB_LABEL).map((k) => {
                const j = jobs.find((x) => x.job === k);
                return (
                  <li key={k} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-ink">{JOB_LABEL[k]}</div>
                      <div className="truncate text-[11px] text-muted">
                        {j ? <>Last run {fmt(j.started_at)} · {j.ok ? <span className="text-good">ok</span> : j.ok === false ? <span className="text-bad">failed</span> : "running"} · {JSON.stringify(j.detail)?.slice(0, 120)}</> : "Never run"}
                      </div>
                    </div>
                    {isAdmin && <Button size="sm" variant="ghost" onClick={() => run(k)} disabled={!!running}>{running === k ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}</Button>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {mode === "remote" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Users & roles" subtitle="Admin: everything incl. jobs & roles · Editor: edit data · Viewer: read-only" pad={false}>
            {isAdmin ? (
              data?.users.length ? (
                <Table>
                  <thead><tr><Th>User</Th><Th>Last seen</Th><Th>Role</Th></tr></thead>
                  <tbody>
                    {data.users.map((u) => (
                      <tr key={u.email}>
                        <Td><div className="font-medium text-ink">{u.name ?? u.email}</div><div className="text-xs text-muted">{u.email}</div></Td>
                        <Td className="text-xs">{fmt(u.last_seen)}</Td>
                        <Td><Select value={u.role} onChange={(v) => setRole(u.email, v)} options={["admin", "editor", "viewer"].map((r) => ({ value: r, label: r }))} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className="p-5 text-sm text-muted">{actor?.setupMode ? "Users appear here once Google sign-in is configured. The first person to sign in becomes admin." : "No users yet."}</p>
              )
            ) : (
              <p className="p-5 text-sm text-muted">Only admins can manage roles. Your role: <Badge>{actor?.role}</Badge></p>
            )}
          </Card>
          <Card title="Audit log" subtitle="Every change, who made it and when" pad={false}>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <thead><tr><Th>When</Th><Th>Who</Th><Th>Action</Th><Th>Record</Th></tr></thead>
                <tbody>
                  {(data?.audit ?? []).map((a) => (
                    <tr key={a.id}>
                      <Td className="whitespace-nowrap text-xs">{fmt(a.at)}</Td>
                      <Td className="text-xs">{a.actor}</Td>
                      <Td><Badge>{a.action}</Badge></Td>
                      <Td className="font-mono text-[11px]">{[a.collection, a.record_id].filter(Boolean).join(" / ") || "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
