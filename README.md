# Hexa Strategic Intelligence

Internal decision-support platform for **Hexamatics Nepal (HNPL)**. It integrates competitive intelligence, market research, sales intelligence, pricing intelligence and decision support to answer one question:

> Based on current evidence, where can Hexa win profitable business next, against whom, at what price, and what must we do?

Built from the *Hexa Strategic Intelligence Blueprint* (24 Oct 2026).

## What's inside

| Area | Capabilities |
|---|---|
| **Executive overview** | KPI strip, "Where to win next" (market × rivals × price × target accounts × action), ranked recommendations, threat landscape, signal feed, 90-day measurement framework |
| **Competitors** | 28-entity universe (Tier 1, Tier 2, substitutes), threat score with confidence + evidence coverage + *risk ceiling* (thin data ≠ low risk), service × country coverage matrix, positioning map, by-arena ranking, editable battlecards (win/lose themes, objections, landmine questions, proof points), head-to-head win/loss, printable battlecards |
| **Markets** | Country × service × segment attractiveness (blueprint formula), live weight sliders, **weight back-test** (Pearson r vs observed win-rate × margin), heatmap, size-vs-attractiveness bubble chart, editable inputs |
| **Accounts** | Propensity scoring (fit, readiness, trigger signals, decision-maker access, displaceability), why company / why service / why now, buying group with lawful-basis & verification metadata, template + AI outreach drafts |
| **Pricing & scenarios** | Separate price types (published / estimate / competitor quote / Hexa deal), scope-comparison matrix, scope-adjusted price, contribution-margin model (in-house vs Nepal delivery incl. supervision, infra, utilization, attrition), scenario engine with presets, tornado sensitivity, 12-month base/upside/downside forecast |
| **Sales & win/loss** | Full funnel (target → connection → reply → meeting → qualified → proposal → win), loss reasons, segment / message-variant / competitor win rates, **intel-assisted vs control lift** |
| **Research & evidence** | Append-only observation log with the minimum provenance schema, verification queue (unverified or stale > 30 days), source registry with licence & refresh, data-model reference |
| **Strategy & tasks** | Recommendations → tasks, drag-and-drop task board, decision log with evidence and review dates, strategic priorities & ownership |
| **Alerts** | Signals with owner, urgency, due date, impact, recommended action; triage → action → task |
| **Weekly brief** | Auto-generated Monday intelligence-to-action brief; print to PDF or copy as Markdown |
| **Ask the analyst** | Claude-grounded Q&A over platform data (set `ANTHROPIC_API_KEY`); falls back to a built-in rule-based analyst |
| **Admin** | Integrations status, live jobs (run now), users & roles, audit log |
| **Models & data** | Threat / propensity weights, JSON import/export, CSV exports, reset to seed |

Plus: HEXA brand system (Inter, pink→purple→blue gradient, logo), floating glassmorphism navbar, ambient orb + hex-grid background, frosted-glass cards, dark-first with light mode, ⌘K global search, mobile sheet navigation, print styles.

## Live data & user mode

The platform runs as a multi-user app on Vercel:

| Capability | How |
|---|---|
| **Sign-in** | Google Workspace via Auth.js, restricted to `@hexamatics.com` (`ALLOWED_EMAIL_DOMAIN`). First user becomes **admin**; others default to **editor**; admins can set **viewer**. |
| **Shared database** | Neon Postgres (any Postgres works). Tables are created and seeded automatically on first request. Every change is written to an append-only `audit_log` with who/when/before/after. |
| **Website & pricing monitor** | Daily: fetches each competitor's site + pricing pages, diffs visible text, creates *pricing_change / web_change* signals; Claude judges materiality and extracts published prices into Pricing. |
| **News & regulation** | Daily Google News queries per competitor and for AU/MY/SG/NP/ID employment & outsourcing regulation; de-duplicated; Claude triages relevance, urgency, owner and action. |
| **FX** | Daily live rates (open.er-api.com) feed the margin model. |
| **Accounts & contacts** | Apollo: live account search (ICP presets), decision-maker search, job postings ("why now"), email reveal. Lusha: contact enrichment. Keys stay server-side. |
| **Hiring signals** | Daily Apollo job-posting check on tracked accounts → *hiring_spike* signals. |
| **Pipeline** | Logged in Sales by BD (stage, ACV, margin, competitor, win/loss reason). Drives funnel, win/loss, forecast and the market-weight back-test. |

Jobs run via Vercel Cron (`vercel.json`, 21:17 UTC) and can be run on demand by admins in **Models & data**.

### Environment variables (Vercel → Settings → Environment Variables)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Set automatically by the Vercel Neon integration |
| `AUTH_SECRET` | Random 32+ byte secret for session encryption |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth client (redirect URI `https://<domain>/api/auth/callback/google`) |
| `ALLOWED_EMAIL_DOMAIN` | Optional, default `hexamatics.com` |
| `ADMIN_EMAILS` | Optional comma-separated emails always granted admin |
| `CRON_SECRET` | Secret Vercel Cron sends as a Bearer token |
| `APOLLO_API_KEY`, `LUSHA_API_KEY` | Live prospecting & enrichment |
| `ANTHROPIC_API_KEY` | Claude analyst, triage, change summaries, price extraction (`ANTHROPIC_MODEL` optional) |

Until `AUTH_*` is set the app runs in **setup mode** (no login, single admin); until `DATABASE_URL` is set it stores data in the browser only. The status pill under the navbar shows which mode is active.

### Data provenance

Starting data was researched from public sources on 25 Oct 2026 and every fact carries its source URL and a *pending* verification status (e.g. Remote cut its EOR list price from US$699 to US$599 in Oct 2026; Robert Half 2026 AU senior accountant median A$120k; CA ANZ 2026 fill rates of 40–55% for practice accountants). Market and threat scores are **analyst judgements** — labelled as such — for the team to review. There are no fictional accounts, synthetic deals or placeholder Hexa prices: accounts come from Apollo/Lusha or BD, deals from Sales, Hexa prices from Finance.

## Architecture

- Next.js 15 (App Router) · React 19 · Tailwind CSS 4 · Recharts · Auth.js · Neon Postgres · Vercel Cron
- `src/lib/types.ts` — domain model (12 intelligence modules, provenance schema)
- `src/lib/scoring.ts` — market attractiveness, threat, propensity, margin model, scenarios, forecast, funnel, back-test
- `src/lib/insights.ts` — decision engine (where-to-win, recommendations, KPIs, LLM context)
- `src/lib/data/` — seed universe
- `src/lib/server/` — database (document store + audit log), Auth.js session/roles, Apollo, Lusha, Claude, feeds and jobs
- `src/auth.ts`, `src/middleware.ts` — Google sign-in and route protection
- `db/schema.sql` — fully relational target schema for later normalisation

## Next steps

1. Complete the environment variables above and sign in once (you become admin).
2. Finance: enter Hexa's price list and actual Nepal payroll costs.
3. BD: import AU accounting firms via Apollo; log every deal in Sales.
4. Analysts: verify Tier-1 profiles; review analyst scores.
5. Re-fit market weights once ≥ 3 closed deals per market exist (Markets → Weight validation).
