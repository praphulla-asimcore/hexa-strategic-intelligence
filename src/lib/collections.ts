export const COLLECTIONS = [
  "competitors",
  "markets",
  "pricing",
  "salaries",
  "signals",
  "accounts",
  "opportunities",
  "tasks",
  "decisions",
  "sources",
  "observations",
] as const;

export type Collection = (typeof COLLECTIONS)[number];

export const isCollection = (x: string): x is Collection => (COLLECTIONS as readonly string[]).includes(x);
