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
| **Models & data** | Threat / propensity weights, JSON import/export, CSV exports, reset to seed |

Plus: ⌘K global search, dark mode, mobile layout, print styles.

## Data status — important

All competitor positioning for Tier 1 comes from the blueprint. **Everything else — scores, salaries, accounts (marked `sample`), pipeline and most prices — is illustrative seed data** so the engines can be exercised end to end. Deel (~US$599) and Remote (~US$699) EOR headline rates are the blueprint's published examples and still require re-verification. Weights are design assumptions, not validated predictors.

Edits persist in the browser (localStorage) until the PostgreSQL backend is connected.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Optional: `ANTHROPIC_API_KEY=...` (and `ANTHROPIC_MODEL`, default `claude-opus-5-5`) to enable the Claude analyst. The `/api/ask` route uses server-side refusal fallbacks (`fallbacks: "default"`).

## Architecture

- Next.js 15 (App Router) · React 19 · Tailwind CSS 4 · Recharts
- `src/lib/types.ts` — domain model (12 intelligence modules, provenance schema)
- `src/lib/scoring.ts` — market attractiveness, threat, propensity, margin model, scenarios, forecast, funnel, back-test
- `src/lib/insights.ts` — decision engine (where-to-win, recommendations, KPIs, LLM context)
- `src/lib/data/` — seed universe
- `db/schema.sql` — PostgreSQL (Neon) schema: append-only observations, versioned scores, audit log, privacy-aware contacts

## Next steps

1. Connect Neon PostgreSQL using `db/schema.sql`; move the store to server actions.
2. Replace seed accounts/pipeline with CRM sync; record win/loss reasons on every closed deal.
3. Wire Visualping / Crayon webhooks and regulator RSS into Signals.
4. Enrichment (Apollo / Clay) with lawful basis per contact.
5. Re-fit market weights once ≥ 20 closed outcomes per segment exist.
