import { competitors } from "./competitors";
import * as seed from "./seed";
import { DEFAULT_WEIGHTS } from "../scoring";
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
} from "../types";

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
  fx: Record<string, number>;
  version: number;
}

export const STATE_VERSION = 2;

export const seedState = (): IntelState => ({
  competitors,
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
  fx: seed.FX_TO_USD,
  version: STATE_VERSION,
});
