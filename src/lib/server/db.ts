import "server-only";
import { neon } from "@neondatabase/serverless";
import { seedState } from "@/lib/data/state";
import { COLLECTIONS, type Collection } from "@/lib/collections";

// Document store on Postgres: one row per record, keyed by (collection, id), plus an
// append-only audit log holding before/after for every change. Keeps the client model
// intact while giving shared state, history and attribution.

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;
let _sql: Sql | null = null;
let _ready: Promise<void> | null = null;

/** Neon HTTP driver for Neon URLs (serverless-friendly); node-postgres for any other Postgres. */
export function sql(): Sql {
  if (!_sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL not configured");
    if (/neon\.tech|neon\.build/.test(url)) {
      _sql = neon(url) as unknown as Sql;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pool } = require("pg") as typeof import("pg");
      const pool = new Pool({ connectionString: url, max: 3 });
      _sql = async (strings, ...values) => {
        const text = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ""), "");
        return (await pool.query(text, values as unknown[])).rows;
      };
    }
  }
  return _sql;
}

async function migrate() {
  const q = sql();
  await q`create table if not exists records (
    collection text not null,
    id text not null,
    data jsonb not null,
    updated_at timestamptz not null default now(),
    updated_by text,
    primary key (collection, id)
  )`;
  await q`create table if not exists audit_log (
    id bigserial primary key,
    at timestamptz not null default now(),
    actor text not null,
    action text not null,
    collection text,
    record_id text,
    before jsonb,
    after jsonb
  )`;
  await q`create index if not exists audit_log_at on audit_log (at desc)`;
  await q`create table if not exists users (
    email text primary key,
    name text,
    image text,
    role text not null default 'editor',
    created_at timestamptz not null default now(),
    last_seen timestamptz
  )`;
  await q`create table if not exists settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz not null default now(),
    updated_by text
  )`;
  await q`create table if not exists snapshots (
    url text primary key,
    hash text not null,
    content text,
    fetched_at timestamptz not null default now()
  )`;
  await q`create table if not exists job_runs (
    id bigserial primary key,
    job text not null,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    ok boolean,
    detail jsonb
  )`;
  await q`create table if not exists seen_items (
    key text primary key,
    seen_at timestamptz not null default now()
  )`;

  // First boot: load the verified seed (competitor universe, sources, priced observations).
  const [{ n }] = (await q`select count(*)::int as n from records`) as { n: number }[];
  if (n === 0) {
    const seed = seedState();
    for (const c of COLLECTIONS) {
      const rows = seed[c] as { id: string }[];
      if (!rows.length) continue;
      await q`insert into records (collection, id, data, updated_by)
        select ${c}, r->>'id', r, 'seed' from jsonb_array_elements(${JSON.stringify(rows)}::jsonb) as r
        on conflict do nothing`;
    }
    await q`insert into settings (key, value, updated_by) values ('weights', ${JSON.stringify(seed.weights)}::jsonb, 'seed') on conflict do nothing`;
    await q`insert into audit_log (actor, action) values ('system', 'seed')`;
  }
}

export function ready() {
  if (!_ready) _ready = migrate().catch((e) => {
    _ready = null;
    throw e;
  });
  return _ready;
}

export async function loadAll() {
  await ready();
  const q = sql();
  const rows = (await q`select collection, data from records order by updated_at asc`) as { collection: Collection; data: { id: string } }[];
  const out = Object.fromEntries(COLLECTIONS.map((c) => [c, [] as unknown[]])) as Record<Collection, unknown[]>;
  for (const r of rows) if (out[r.collection]) out[r.collection].push(r.data);
  const settings = (await q`select key, value from settings`) as { key: string; value: unknown }[];
  const s = Object.fromEntries(settings.map((x) => [x.key, x.value]));
  const jobs = (await q`select distinct on (job) job, started_at, finished_at, ok, detail from job_runs order by job, started_at desc`) as JobRun[];
  return { collections: out, weights: s.weights, fx: s.fx, jobs };
}

export interface JobRun {
  job: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  detail: unknown;
}

export async function applyChanges(collection: Collection, upserts: { id: string }[], deletes: string[], actor: string) {
  await ready();
  const q = sql();
  for (const rec of upserts) {
    const before = (await q`select data from records where collection = ${collection} and id = ${rec.id}`) as { data: unknown }[];
    await q`insert into records (collection, id, data, updated_at, updated_by)
      values (${collection}, ${rec.id}, ${JSON.stringify(rec)}::jsonb, now(), ${actor})
      on conflict (collection, id) do update set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by`;
    await q`insert into audit_log (actor, action, collection, record_id, before, after)
      values (${actor}, ${before.length ? "update" : "create"}, ${collection}, ${rec.id}, ${before.length ? JSON.stringify(before[0].data) : null}::jsonb, ${JSON.stringify(rec)}::jsonb)`;
  }
  for (const id of deletes) {
    const before = (await q`delete from records where collection = ${collection} and id = ${id} returning data`) as { data: unknown }[];
    if (before.length)
      await q`insert into audit_log (actor, action, collection, record_id, before) values (${actor}, 'delete', ${collection}, ${id}, ${JSON.stringify(before[0].data)}::jsonb)`;
  }
}

/** Insert records written by background jobs; skips ids that already exist. */
export async function insertIfNew(collection: Collection, recs: { id: string }[], actor = "system:jobs") {
  if (!recs.length) return 0;
  await ready();
  const q = sql();
  const res = (await q`insert into records (collection, id, data, updated_by)
    select ${collection}, r->>'id', r, ${actor} from jsonb_array_elements(${JSON.stringify(recs)}::jsonb) as r
    on conflict do nothing returning id`) as { id: string }[];
  if (res.length) await q`insert into audit_log (actor, action, collection, after) values (${actor}, 'job-insert', ${collection}, ${JSON.stringify(res.map((r) => r.id))}::jsonb)`;
  return res.length;
}

export async function setSetting(key: string, value: unknown, actor: string) {
  await ready();
  const q = sql();
  await q`insert into settings (key, value, updated_at, updated_by) values (${key}, ${JSON.stringify(value)}::jsonb, now(), ${actor})
    on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`;
  await q`insert into audit_log (actor, action, collection, record_id, after) values (${actor}, 'setting', 'settings', ${key}, ${JSON.stringify(value)}::jsonb)`;
}

export async function recentAudit(limit = 100) {
  await ready();
  return (await sql()`select id, at, actor, action, collection, record_id from audit_log order by at desc limit ${limit}`) as {
    id: number;
    at: string;
    actor: string;
    action: string;
    collection: string | null;
    record_id: string | null;
  }[];
}

// ───────────── Users & roles ─────────────
export type Role = "admin" | "editor" | "viewer";

export async function upsertUser(email: string, name?: string | null, image?: string | null, bootstrapAdmin = false): Promise<Role> {
  await ready();
  const q = sql();
  const existing = (await q`select role from users where email = ${email}`) as { role: Role }[];
  if (existing.length) {
    await q`update users set name = coalesce(${name ?? null}, name), image = coalesce(${image ?? null}, image), last_seen = now() where email = ${email}`;
    if (bootstrapAdmin && existing[0].role !== "admin") {
      await q`update users set role = 'admin' where email = ${email}`;
      return "admin";
    }
    return existing[0].role;
  }
  const [{ n }] = (await q`select count(*)::int as n from users`) as { n: number }[];
  const role: Role = bootstrapAdmin || n === 0 ? "admin" : "editor";
  await q`insert into users (email, name, image, role, last_seen) values (${email}, ${name ?? null}, ${image ?? null}, ${role}, now())`;
  await q`insert into audit_log (actor, action, collection, record_id, after) values (${email}, 'user-created', 'users', ${email}, ${JSON.stringify({ role })}::jsonb)`;
  return role;
}

export async function getRole(email: string): Promise<Role | null> {
  await ready();
  const r = (await sql()`select role from users where email = ${email}`) as { role: Role }[];
  return r[0]?.role ?? null;
}

export async function listUsers() {
  await ready();
  return (await sql()`select email, name, image, role, created_at, last_seen from users order by created_at`) as {
    email: string;
    name: string | null;
    image: string | null;
    role: Role;
    created_at: string;
    last_seen: string | null;
  }[];
}

export async function setRole(email: string, role: Role, actor: string) {
  await ready();
  await sql()`update users set role = ${role} where email = ${email}`;
  await sql()`insert into audit_log (actor, action, collection, record_id, after) values (${actor}, 'role-change', 'users', ${email}, ${JSON.stringify({ role })}::jsonb)`;
}

// ───────────── Jobs ─────────────
export async function startJob(job: string) {
  await ready();
  const [{ id }] = (await sql()`insert into job_runs (job) values (${job}) returning id`) as { id: number }[];
  return id;
}
export async function finishJob(id: number, ok: boolean, detail: unknown) {
  await sql()`update job_runs set finished_at = now(), ok = ${ok}, detail = ${JSON.stringify(detail)}::jsonb where id = ${id}`;
}

export async function getSnapshot(url: string) {
  await ready();
  const r = (await sql()`select hash, content, fetched_at from snapshots where url = ${url}`) as { hash: string; content: string; fetched_at: string }[];
  return r[0] ?? null;
}
export async function putSnapshot(url: string, hash: string, content: string) {
  await sql()`insert into snapshots (url, hash, content, fetched_at) values (${url}, ${hash}, ${content}, now())
    on conflict (url) do update set hash = excluded.hash, content = excluded.content, fetched_at = now()`;
}

/** Returns the keys not seen before and marks them seen. */
export async function markSeen(keys: string[]) {
  if (!keys.length) return [] as string[];
  await ready();
  const res = (await sql()`insert into seen_items (key) select k from jsonb_array_elements_text(${JSON.stringify(keys)}::jsonb) as k
    on conflict do nothing returning key`) as { key: string }[];
  return res.map((r) => r.key);
}
