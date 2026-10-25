"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, User } from "lucide-react";
import { useIntel } from "@/lib/store";
import { buildContext } from "@/lib/insights";
import { localAnswer } from "@/lib/answer";
import { Markdown } from "@/components/markdown";
import { Badge, Button, Card, PageHeader } from "@/components/ui";

interface Msg {
  role: "user" | "assistant";
  text: string;
  engine?: "llm" | "local";
}

const SUGGESTIONS = [
  "Based on current evidence, where can Hexa win profitable business next, against whom, at what price, and what must we do?",
  "Which ten Australian accounting firms appear most likely to outsource finance work, and what outreach should we use?",
  "How does our EOR price compare with Deel and Remote on equivalent scope?",
  "What are our top loss reasons and how should we respond?",
  "Summarise Emapta as a competitor and how we beat them.",
  "What changed this week that needs management attention?",
];

export default function Ask() {
  const { state } = useIntel();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [llm, setLlm] = useState<boolean | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setQ("");
    setBusy(true);
    let text: string | null = null;
    let engine: Msg["engine"] = "local";
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, context: buildContext(state) }) });
      const j = await r.json();
      setLlm(!!j.configured);
      if (j.answer) {
        text = j.answer;
        engine = "llm";
      } else if (j.error && j.configured !== false) {
        text = `⚠️ ${j.error}. Falling back to the built-in analyst:\n\n${localAnswer(state, question)}`;
      }
    } catch {
      setLlm(false);
    }
    setMsgs((m) => [...m, { role: "assistant", text: text ?? localAnswer(state, question), engine }]);
    setBusy(false);
  };

  return (
    <div className="flex h-[calc(100vh-9.5rem)] flex-col">
      <PageHeader
        title="Ask the analyst"
        subtitle="Retrieval-grounded answers over the platform's own data — sources, uncertainty, financial implications and owners. Uses Claude when ANTHROPIC_API_KEY is set; otherwise a built-in rule-based analyst."
        actions={llm != null && <Badge tone={llm ? "green" : "amber"}>{llm ? "Claude connected" : "Built-in analyst (no API key)"}</Badge>}
      />
      <Card className="flex min-h-0 flex-1 flex-col" pad={false}>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {msgs.length === 0 && (
            <div className="mx-auto max-w-2xl py-6">
              <div className="mb-3 text-center text-sm text-muted">Try one of these:</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="rounded-lg border border-line bg-surface-2 p-3 text-left text-sm text-ink-2 hover:border-brand-200 hover:bg-brand-50">{s}</button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-hexa-gradient text-white shadow-[0_4px_14px_rgba(139,24,232,0.4)]"><Bot className="h-4 w-4" /></div>}
              <div className={`max-w-3xl rounded-xl px-4 py-3 ${m.role === "user" ? "bg-hexa-gradient text-sm text-white shadow-[0_6px_20px_rgba(139,24,232,0.3)]" : "glass"}`}>
                {m.role === "user" ? m.text : <Markdown text={m.text} />}
                {m.engine && <div className="mt-2 text-[10px] uppercase tracking-wide text-subtle">{m.engine === "llm" ? "Claude · grounded in platform data" : "Built-in analyst"}</div>}
              </div>
              {m.role === "user" && <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-chip text-muted"><User className="h-4 w-4" /></div>}
            </div>
          ))}
          {busy && <div className="text-sm text-muted">Analysing evidence…</div>}
          <div ref={end} />
        </div>
        <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about competitors, markets, accounts, pricing…" className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand-500" />
          <Button type="submit" variant="primary" disabled={busy}><Send className="h-4 w-4" /></Button>
        </form>
      </Card>
    </div>
  );
}
