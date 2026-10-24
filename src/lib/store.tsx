"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { competitors as seedCompetitors } from "./data/competitors";
import * as seed from "./data/seed";
import { DEFAULT_WEIGHTS } from "./scoring";
import type {
  Account,
  Competitor,
  Decision,
  MarketCombo,
  Observation,
  Opportunity,
  PricingObservation,
  SalaryBenchmark,
  Signal,
  Source,
  Task,
  Weights,
} from "./types";

export interface IntelState {
  competitors: Competitor[];
  markets: MarketCombo[];
  pricing: PricingObservation[];
  salaries: SalaryBenchmark[];
  signals: Signal[];
  accounts: Account[];
  opportunities: Opportunity[];
  tasks: Task[];
  decisions: Decision[];
  sources: Source[];
  observations: Observation[];
  weights: Weights;
  version: number;
}

const VERSION = 1;
const KEY = "hexa-intel-state-v1";

export const seedState = (): IntelState => ({
  competitors: seedCompetitors,
  markets: seed.markets,
  pricing: seed.pricing,
  salaries: seed.salaries,
  signals: seed.signals,
  accounts: seed.accounts,
  opportunities: seed.opportunities,
  tasks: seed.tasks,
  decisions: seed.decisions,
  sources: seed.sources,
  observations: seed.observations,
  weights: DEFAULT_WEIGHTS,
  version: VERSION,
});

interface Ctx {
  state: IntelState;
  set: <K extends keyof IntelState>(key: K, updater: (prev: IntelState[K]) => IntelState[K]) => void;
  reset: () => void;
  replace: (s: IntelState) => void;
  hydrated: boolean;
}

const IntelContext = createContext<Ctx | null>(null);

export function IntelProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<IntelState>(seedState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as IntelState;
        if (parsed.version === VERSION) setState({ ...seedState(), ...parsed });
      }
    } catch {
      /* storage unavailable — run on seed data */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / private mode */
    }
  }, [state, hydrated]);

  const set = useCallback<Ctx["set"]>((key, updater) => {
    setState((s) => ({ ...s, [key]: updater(s[key]) }));
  }, []);

  const value = useMemo<Ctx>(
    () => ({ state, set, reset: () => setState(seedState()), replace: (s) => setState({ ...seedState(), ...s }), hydrated }),
    [state, set, hydrated],
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
