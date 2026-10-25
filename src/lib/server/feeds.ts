import "server-only";
import { createHash } from "node:crypto";

export const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const UA = "Mozilla/5.0 (compatible; HexaStrategicIntelligence/1.0; +https://hexa-strategic-intelligence.vercel.app)";

export async function fetchText(url: string, timeoutMs = 12000) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" }, signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

/** Visible text of an HTML page, normalised so cosmetic changes don't trigger alerts. */
export function htmlToText(html: string) {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<(br|p|div|li|h[1-6]|tr|section|article)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 2 && !/^(©|copyright)/i.test(l))
    .join("\n")
    .slice(0, 40000);
}

/** Line-level diff summary (added / removed lines). */
export function diffLines(before: string, after: string) {
  const a = new Set(before.split("\n"));
  const b = new Set(after.split("\n"));
  const added = [...b].filter((l) => !a.has(l));
  const removed = [...a].filter((l) => !b.has(l));
  return { added, removed };
}

export interface FeedItem {
  title: string;
  link: string;
  pubDate?: string;
  source?: string;
}

export async function readRss(url: string): Promise<FeedItem[]> {
  const xml = await fetchText(url);
  const items = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
  return items.map((it) => {
    const tag = (t: string) => decode(it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] ?? "").trim();
    return { title: tag("title"), link: tag("link"), pubDate: tag("pubDate"), source: tag("source") };
  });
}

export const googleNews = (query: string, region: { gl: string; hl: string; ceid: string } = { gl: "AU", hl: "en-AU", ceid: "AU:en" }) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${region.hl}&gl=${region.gl}&ceid=${region.ceid}`;

export async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>) {
  const out: R[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}
