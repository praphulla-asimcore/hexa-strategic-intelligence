-- Hexa Strategic Intelligence — PostgreSQL schema (Neon-compatible)
-- Append-only observations; scores are versioned; every observation carries provenance.

create extension if not exists "pgcrypto";
create extension if not exists vector; -- pgvector for retrieval (optional)

create type confidence as enum ('high', 'medium', 'low');
create type verification as enum ('verified', 'pending', 'unverified', 'disputed');
create type arena as enum ('eor_payroll', 'finance_outsourcing', 'tech_outsourcing', 'advisory');
create type price_type as enum ('published', 'external_estimate', 'competitor_quote', 'hexa_deal');
create type urgency as enum ('critical', 'high', 'medium', 'low');

-- ───────────── Sources & evidence ─────────────
create table sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  source_type text not null,
  licence text not null check (licence in ('public', 'licensed', 'internal', 'restricted')),
  refresh text,
  owner text,
  reliability confidence default 'medium',
  usage_rights text, -- scraping / retention / redistribution terms
  last_checked timestamptz
);

-- ───────────── Companies ─────────────
create table companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  legal_name text not null,
  website text,
  kind text not null check (kind in ('competitor', 'account', 'partner', 'hexa')),
  competitor_tier text check (competitor_tier in ('tier1', 'tier2', 'substitute')),
  competitor_kind text check (competitor_kind in ('direct', 'indirect', 'substitute')),
  hq_country text,
  ownership text,
  size_band text,
  industry text,
  is_sample boolean default false,
  created_at timestamptz default now()
);

create table company_locations (
  company_id uuid references companies(id) on delete cascade,
  country text not null,
  city text,
  is_delivery_centre boolean default false,
  primary key (company_id, country, city)
);

create table services (
  id text primary key, -- arena + sub-service
  arena arena not null,
  name text not null
);

create table market_segments (
  id text primary key, -- e.g. au-finance_outsourcing-accounting-firms
  country text not null,
  arena arena not null,
  segment text not null,
  unique (country, arena, segment)
);

create table competitor_services (
  company_id uuid references companies(id) on delete cascade,
  arena arena not null,
  country text not null,
  segment text,
  intensity smallint check (intensity between 0 and 3),
  primary key (company_id, arena, country)
);

-- ───────────── Observations (append-only) ─────────────
create table market_observations (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid,
  market text,
  service_line arena,
  field text not null,
  observed_value text not null,
  unit text,
  currency text,
  source_id uuid references sources(id),
  source_url text,
  source_type text not null,
  observed_at timestamptz not null default now(),
  effective_date date,
  confidence confidence not null,
  verification_status verification not null default 'unverified',
  analyst text not null,
  last_reviewed_at timestamptz,
  supersedes uuid references market_observations(id),
  embedding vector(1024)
);
create index on market_observations (entity_id, field, observed_at desc);

create table pricing_observations (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references companies(id),
  arena arena not null,
  country text not null,
  service text not null,
  price_type price_type not null,
  observed_value numeric not null,
  unit text not null,
  currency char(3) not null,
  scope text[] not null default '{}',
  min_term_months int,
  setup_fee numeric,
  deposit text,
  exit_fee text,
  discount text,
  source_url text,
  source_type text not null,
  observed_at timestamptz not null default now(),
  effective_date date,
  confidence confidence not null,
  verification_status verification not null default 'unverified',
  analyst text not null,
  last_reviewed_at timestamptz
);

create table evidence (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid references market_observations(id),
  source_id uuid references sources(id),
  excerpt text,
  captured_at timestamptz default now(),
  snapshot_url text
);

create table change_events (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references companies(id),
  signal_type text not null,
  title text not null,
  summary text,
  country text,
  arena arena,
  urgency urgency not null,
  impact smallint check (impact between 1 and 5),
  owner text,
  due_date date,
  status text not null default 'new' check (status in ('new', 'triaged', 'actioned', 'dismissed')),
  recommended_action text,
  source_url text,
  detected_at timestamptz default now()
);

-- ───────────── People (privacy-aware) ─────────────
create table contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  full_name text,
  role text,
  department text,
  seniority text,
  influence text,
  relationship text,
  lawful_basis text not null check (lawful_basis in ('legitimate_interest', 'consent', 'existing_relationship')),
  verified boolean default false,
  source_type text,
  retention_until date,
  opted_out boolean default false
);

-- ───────────── Sales ─────────────
create table accounts (
  company_id uuid primary key references companies(id) on delete cascade,
  target_arena arena,
  segment text,
  fit smallint,
  outsourcing_readiness smallint,
  incumbent_id uuid references companies(id),
  status text,
  owner text,
  why_company text,
  why_service text,
  why_now text
);

create table opportunities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references companies(id),
  arena arena not null,
  country text not null,
  segment text,
  stage text not null,
  value_usd numeric,
  gross_margin numeric,
  competitor_id uuid references companies(id),
  message_variant text,
  intel_assisted boolean default false,
  created_at timestamptz default now(),
  closed_at timestamptz
);

create table sales_activities (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id) on delete cascade,
  activity text not null, -- connection_sent, connected, messaged, replied, meeting...
  occurred_at timestamptz default now(),
  actor text
);

create table win_loss_reviews (
  opportunity_id uuid primary key references opportunities(id) on delete cascade,
  outcome text not null check (outcome in ('won', 'lost')),
  loss_reason text,
  notes text,
  reviewed_by text,
  reviewed_at timestamptz default now()
);

-- ───────────── Delivery economics ─────────────
create table salary_benchmarks (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  country text not null,
  currency char(3) not null,
  annual_low numeric, annual_mid numeric, annual_high numeric,
  oncost_pct numeric,
  time_to_hire_days int,
  availability text,
  source_url text,
  observed_at timestamptz default now(),
  confidence confidence not null
);

create table delivery_costs (
  id uuid primary key default gen_random_uuid(),
  centre text not null,
  cost_type text not null, -- supervision, infra, software, training
  monthly_usd numeric not null,
  effective_date date not null
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id),
  price_monthly numeric,
  currency char(3),
  scope text[],
  expected_margin numeric,
  fx_rate numeric,
  created_at timestamptz default now()
);

-- ───────────── Scores & decisions ─────────────
create table score_versions (
  id serial primary key,
  model text not null, -- market | threat | propensity
  weights jsonb not null,
  rationale text,
  created_by text,
  created_at timestamptz default now()
);

create table scores (
  entity_id text not null,
  model text not null,
  score_version int references score_versions(id),
  score numeric not null,
  confidence confidence,
  evidence_coverage numeric,
  computed_at timestamptz default now(),
  primary key (entity_id, model, score_version)
);

create table recommendations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  rationale text,
  owner text,
  urgency urgency,
  impact smallint,
  evidence text[],
  created_at timestamptz default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner text,
  role text,
  status text default 'todo',
  priority urgency default 'medium',
  due date,
  recommendation_id uuid references recommendations(id)
);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  decided_on date not null,
  title text not null,
  context text,
  decision text,
  owner text,
  evidence text[],
  review_on date
);

-- ───────────── Audit ─────────────
create table audit_log (
  id bigserial primary key,
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text,
  diff jsonb,
  at timestamptz default now()
);
