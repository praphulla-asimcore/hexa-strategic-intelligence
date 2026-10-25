"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { seedState, STATE_VERSION, type IntelState } from "./data/state";
import { COLLECTIONS, type Collection } from "./collections";

export type { IntelState } from "./data/state";
export { seedState } from "./data/state";

export interface Actor {
  email: string;
  name?: string | null;
  image?: string | null;
  role: "admin" | "editor" | "viewer";
  setupMode: boolean;
}
export interface Status {
  database: boolean;
  auth: boolean;
  apollo: boolean;
  lusha: boolean;
  anthropic: boolean;
  cron: boolean;
  allowedDomain: string;
}
export interface JobRun {
  job: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  detail: unknown;
}

interface Ctx {
  state: IntelState;
  set: <K extends keyof IntelState>(key: K, updater: (prev: IntelState[K]) => IntelState[K]) => void;
  reset: () => void;
  replace: (s: IntelState) => void;
  refresh: () => Promise<void>;
  hydrated: boolean;
  mode: "loading" | "remote" | "local";
  actor: Actor | null;
  status: Status | null;
  jobs: JobRun[];
  error: string | null;
  canEdit: boolean;
  toast: string | null;
  notify: (msg: string) => void;
}

const KEY = "hexa-intel-state-v2";
const IntelContext = createContext<Ctx | null>(null);

type Rec = { id: string };
function diff(prev: Rec[], next: Rec[]) {
  const before = new Map(prev.map((r) => [r.id, JSON.stringify(r)]));
  const after = new Set(next.map((r) => r.id));
  const upserts = next.filter((r) => before.get(r.id) !== JSON.stringify(r));
  const deletes = prev.filter((r) => !after.has(r.id)).map((r) => r.id);
  return { upserts, deletes };
}

export function IntelProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<IntelState>(seedState);
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<Ctx["mode"]>("loading");
  const [actor, setActor] = useState<Actor | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [jobs, setJobs] = useState<JobRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 4000);
  }, []);

  const loadLocal = useCallback(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as IntelState;
        if (parsed.version === STATE_VERSION) setState({ ...seedState(), ...parsed });
      }
    } catch {
      /* storage unavailable — run on seed data */
    }
  }, []);

  const refresh = useCallback(async () => {
    if (window.location.pathname === "/login") {
      setHydrated(true);
      return;
    }
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const j = await res.json();
      setActor(j.actor ?? null);
      setStatus(j.status ?? null);
      setError(j.error ?? null);
      if (j.mode === "remote") {
        const seed = seedState();
        setState({
          ...seed,
          ...(Object.fromEntries(COLLECTIONS.map((c) => [c, j.collections?.[c] ?? []])) as Pick<IntelState, Collection>),
          weights: j.weights ?? seed.weights,
          fx: j.fx ? Object.fromEntries(Object.entries(j.fx).filter(([k]) => !k.startsWith("_"))) as Record<string, number> : seed.fx,
        });
        setJobs(j.jobs ?? []);
        setMode("remote");
      } else {
        loadLocal();
        setMode("local");
      }
    } catch {
      loadLocal();
      setMode("local");
      setError("Could not reach the server — showing data saved in this browser.");
    }
    setHydrated(true);
  }, [loadLocal]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (mode !== "local" || !hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / private mode */
    }
  }, [state, hydrated, mode]);

  const persist = useCallback(
    async (key: keyof IntelState, prev: unknown, next: unknown) => {
      if (modeRef.current !== "remote") return;
      try {
        let res: Response;
        if (key === "weights") {
          res = await fetch("/api/settings/weights", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
        } else if ((COLLECTIONS as readonly string[]).includes(key)) {
          const d = diff(prev as Rec[], next as Rec[]);
          if (!d.upserts.length && !d.deletes.length) return;
          res = await fetch(`/api/data/${key}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
        } else return;
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Save failed (${res.status})`);
        }
      } catch (e) {
        notify(`${(e as Error).message} — change reverted`);
        setState((s) => ({ ...s, [key]: prev }));
      }
    },
    [notify],
  );

  const set = useCallback<Ctx["set"]>(
    (key, updater) => {
      const prev = stateRef.current[key];
      const next = updater(prev);
      setState((s) => ({ ...s, [key]: next }));
      persist(key, prev, next);
    },
    [persist],
  );

  const canEdit = mode !== "remote" || actor?.role === "admin" || actor?.role === "editor";

  const value = useMemo<Ctx>(
    () => ({
      state,
      set,
      reset: () => setState(seedState()),
      replace: (s) => setState({ ...seedState(), ...s }),
      refresh,
      hydrated,
      mode,
      actor,
      status,
      jobs,
      error,
      canEdit,
      toast,
      notify,
    }),
    [state, set, refresh, hydrated, mode, actor, status, jobs, error, canEdit, toast, notify],
  );

  return <IntelContext.Provider value={value}>{children}</IntelContext.Provider>;
}

export function useIntel() {
  const ctx = useContext(IntelContext);
  if (!ctx) throw new Error("useIntel must be used inside IntelProvider");
  return ctx;
}

export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
export const today = () => new Date().toISOString().slice(0, 10);
