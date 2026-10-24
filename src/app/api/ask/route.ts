import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are the analyst inside Hexa Strategic Intelligence, the internal decision-support platform of Hexamatics Nepal (HNPL), an integrated Asian operating partner (EOR & business operations, dedicated professional capability centres, and advisory).

Answer management, sales and finance questions using ONLY the platform data provided in the user's message. Rules:
- Ground every claim in the supplied data; name the entity, score, price or signal you rely on.
- State confidence and verification status where relevant. Thin evidence is not low risk.
- Many records are illustrative seed data or unverified hypotheses — say so when it affects the answer.
- Never invent statistics, customers, contacts, prices or sources.
- Structure: short direct answer, then evidence, financial implication, recommended actions with owners, and uncertainty.
- Be concise; use markdown bullets.`;

export async function POST(req: Request) {
  const { question, context, mode } = (await req.json()) as { question?: string; context?: string; mode?: string };
  if (!question) return NextResponse.json({ error: "question required" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ answer: null, configured: false });
  }

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      // Server-side refusal fallback: routes a declined request to a suitable model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      max_tokens: 4000,
      output_config: { effort: mode === "outreach" ? "low" : "medium" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: context ? `<platform_data>\n${context.slice(0, 120_000)}\n</platform_data>\n\nQuestion: ${question}` : question,
        },
      ],
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ answer: "The model declined to answer this request.", configured: true });
    }
    const answer = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return NextResponse.json({ answer, configured: true, model: response.model });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ answer: null, configured: false, error: "Invalid ANTHROPIC_API_KEY" });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited — try again shortly" }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `API error ${error.status}` }, { status: 502 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
