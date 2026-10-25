import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

/** Single grounded completion; returns null when Claude isn't configured or declines. */
export async function complete(system: string, user: string, opts: { effort?: "low" | "medium" | "high"; maxTokens?: number } = {}) {
  if (!config.anthropic()) return null;
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: MODEL(),
    // Server-side refusal fallback: a declined request is retried on a suitable model in the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    max_tokens: opts.maxTokens ?? 4000,
    output_config: { effort: opts.effort ?? "low" },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") return null;
  return response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/** Asks for JSON and parses the first JSON value in the reply. */
export async function completeJson<T>(system: string, user: string, opts: { effort?: "low" | "medium" | "high"; maxTokens?: number } = {}): Promise<T | null> {
  const text = await complete(`${system}\n\nReply with JSON only — no prose, no code fences.`, user, opts);
  if (!text) return null;
  const m = text.match(/[[{][\s\S]*[\]}]/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}
