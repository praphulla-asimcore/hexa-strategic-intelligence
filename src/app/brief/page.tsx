"use client";

import { Copy, Printer } from "lucide-react";
import { useState } from "react";
import { useIntel } from "@/lib/store";
import { kpis, rankedAccounts, recommendations, whereToWin } from "@/lib/insights";
import { winLoss } from "@/lib/scoring";
import { ARENA_LABEL, COUNTRY_LABEL, LOSS_LABEL } from "@/lib/labels";
import { Button, Card, PageHeader, fmtUsd, pct } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import type { IntelState } from "@/lib/store";

function monday() {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function buildBrief(s: IntelState) {
  const k = kpis(s);
  const win = whereToWin(s, 3);
  const recs = recommendations(s).slice(0, 6);
  const wl = winLoss(s.opportunities);
  const compSigs = s.signals.filter((x) => x.entity_kind === "competitor" && x.status !== "dismissed");
  const mktSigs = s.signals.filter((x) => x.entity_kind === "market" && x.status !== "dismissed");
  const accSigs = s.signals.filter((x) => x.entity_kind === "account" && x.status !== "dismissed");
  const accts = rankedAccounts(s).slice(0, 5);
  const due = s.tasks.filter((t) => t.status !== "done").sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6);

  return `# Hexa Strategic Intelligence — weekly brief (week of ${monday()})

**Bottom line:** Strongest current opportunity is **${win[0] ? `${COUNTRY_LABEL[win[0].m.country]} ${ARENA_LABEL[win[0].m.arena].toLowerCase()} for ${win[0].m.segment.toLowerCase()}` : "—"}** (score ${win[0]?.score.toFixed(0) ?? "—"}). ${k.newSignals} new signals; win rate ${pct(k.winRate)}; open pipeline ${fmtUsd(k.pipelineValue)} (${fmtUsd(k.pipelineGP)} expected GP).

## 1. Where to win next
${win.map((w, i) => `${i + 1}. **${COUNTRY_LABEL[w.m.country]} · ${ARENA_LABEL[w.m.arena]} · ${w.m.segment}** — ${w.score.toFixed(0)}/100. Main rivals: ${w.rivals.map(({ c }) => c.name).join(", ") || "—"}. ${w.action}`).join("\n")}

## 2. Competitor moves
${compSigs.length ? compSigs.map((x) => `- [${x.urgency}] ${x.title} → ${x.recommended_action} (${x.owner})`).join("\n") : "- No new competitor signals"}

## 3. Market & regulatory
${mktSigs.length ? mktSigs.map((x) => `- [${x.urgency}] ${x.title} → ${x.recommended_action}`).join("\n") : "- No new market signals"}

## 4. Accounts to action
${accts.map(({ a, p }) => `- **${a.name}** — propensity ${p.score}. Why now: ${a.why_now}`).join("\n")}
${accSigs.length ? `\nTrigger events:\n${accSigs.map((x) => `- ${x.title} → ${x.recommended_action}`).join("\n")}` : ""}

## 5. Win/loss
- ${wl.won} won of ${wl.closed} closed (${pct(wl.winRate)}); won GP ${fmtUsd(wl.wonGP)}
- Top loss reasons: ${wl.reasons.slice(0, 3).map((r) => `${LOSS_LABEL[r.reason]} (${r.count})`).join(", ")}
- Intel-assisted vs control GP per target: ${k.lift.gpLift >= 0 ? "+" : ""}${pct(k.lift.gpLift)}

## 6. Decisions & actions required
${recs.map((r) => `- **${r.title}** — ${r.owner}, ${r.urgency}`).join("\n")}

## 7. Tasks due
${due.map((t) => `- ${t.title} — ${t.owner}, due ${t.due}`).join("\n")}

## 8. Evidence quality
- ${k.monitored} competitors monitored; ${k.verifiedProfiles} verified, ${k.pending} pending
- Average evidence coverage ${pct(k.avgCoverage)} (target 85%+)

_Method: facts carry source links and verification status; market and threat scores are analyst judgements; win/loss and forecasts use only deals logged in Sales. Weights are validated once ≥ 3 closed deals exist per market._`;
}

export default function Brief() {
  const { state } = useIntel();
  const md = buildBrief(state);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly intelligence-to-action brief"
        subtitle="Generated every Monday from live platform data. Print to PDF or copy as Markdown for email / Slack."
        actions={
          <>
            <Button onClick={() => { navigator.clipboard?.writeText(md); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy Markdown"}</Button>
            <Button variant="primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / PDF</Button>
          </>
        }
      />
      <Card className="mx-auto max-w-4xl">
        <Markdown text={md} />
      </Card>
    </div>
  );
}
