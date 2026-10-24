"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  Building2,
  Compass,
  DollarSign,
  FileText,
  Gauge,
  Globe2,
  Menu,
  MessageSquareText,
  Moon,
  Search,
  Settings,
  Sun,
  Swords,
  Target,
  TrendingUp,
} from "lucide-react";
import { useIntel } from "@/lib/store";
import { ARENA_SHORT, COUNTRY_FLAG } from "@/lib/labels";

const NAV = [
  { href: "/", label: "Executive overview", icon: Gauge },
  { href: "/competitors", label: "Competitors", icon: Swords },
  { href: "/markets", label: "Markets", icon: Globe2 },
  { href: "/accounts", label: "Accounts", icon: Building2 },
  { href: "/pricing", label: "Pricing & scenarios", icon: DollarSign },
  { href: "/sales", label: "Sales & win/loss", icon: TrendingUp },
  { href: "/research", label: "Research & evidence", icon: BookOpen },
  { href: "/strategy", label: "Strategy & tasks", icon: Compass },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/brief", label: "Weekly brief", icon: FileText },
  { href: "/ask", label: "Ask the analyst", icon: MessageSquareText },
  { href: "/settings", label: "Models & data", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { state } = useIntel();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const [dark, setDark] = useState(false);
  const newAlerts = state.signals.filter((s) => s.status === "new").length;

  useEffect(() => {
    let d = false;
    try {
      const pref = localStorage.getItem("hexa-theme");
      d = pref ? pref === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {}
    setDark(d);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
      if (e.key === "Escape") setSearch(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  const toggleTheme = () => {
    setDark((d) => {
      try {
        localStorage.setItem("hexa-theme", d ? "light" : "dark");
      } catch {}
      return !d;
    });
  };

  return (
    <div className="flex min-h-screen">
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-slate-300 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">H</div>
          <div>
            <div className="text-sm font-semibold text-white">Hexa Strategic</div>
            <div className="text-[11px] text-slate-400">Intelligence Platform</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                  active ? "bg-white/10 font-medium text-white" : "hover:bg-white/5 hover:text-white",
                )}
              >
                <n.icon className="h-4 w-4" />
                <span className="flex-1">{n.label}</span>
                {n.href === "/alerts" && newAlerts > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">{newAlerts}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-[11px] leading-relaxed text-slate-400">
          <div className="font-medium text-slate-300">Central question</div>
          Where can Hexa win profitable business next, against whom, at what price, and what must we do?
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/85 px-4 py-2.5 backdrop-blur sm:px-6">
          <button className="rounded-lg p-1.5 text-muted hover:bg-chip lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setSearch(true)}
            className="flex w-full max-w-md items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-subtle hover:border-brand-200"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search competitors, markets, accounts…</span>
            <kbd className="hidden rounded border border-line px-1.5 text-[10px] sm:inline">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-md bg-warn-50 px-2 py-1 text-[11px] font-medium text-warn ring-1 ring-inset ring-warn-200 md:inline">
              Seed data — illustrative, verify before use
            </span>
            <Link href="/ask" className="hidden items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 sm:inline-flex">
              <MessageSquareText className="h-4 w-4" /> Ask
            </Link>
            <button onClick={toggleTheme} className="rounded-lg p-2 text-muted hover:bg-chip" aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      {search && <CommandPalette onClose={() => setSearch(false)} />}
    </div>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const { state } = useIntel();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const results = useMemo(() => {
    const items: { label: string; sub: string; href: string; kind: string }[] = [
      ...NAV.map((n) => ({ label: n.label, sub: "Page", href: n.href, kind: "Go to" })),
      ...state.competitors.map((c) => ({ label: c.name, sub: `${c.tier} · ${c.arenas.map((a) => ARENA_SHORT[a]).join(", ")}`, href: `/competitors/${c.id}`, kind: "Competitor" })),
      ...state.markets.map((m) => ({ label: `${COUNTRY_FLAG[m.country]} ${m.country} · ${ARENA_SHORT[m.arena]} · ${m.segment}`, sub: m.notes, href: `/markets?focus=${m.id}`, kind: "Market" })),
      ...state.accounts.map((a) => ({ label: a.name, sub: `${a.country} · ${a.industry}${a.sample ? " · sample" : ""}`, href: `/accounts?focus=${a.id}`, kind: "Account" })),
      ...state.signals.map((s) => ({ label: s.title, sub: s.recommended_action, href: `/alerts?focus=${s.id}`, kind: "Signal" })),
    ];
    const t = q.trim().toLowerCase();
    if (!t) return items.slice(0, 12);
    return items.filter((i) => `${i.label} ${i.sub} ${i.kind}`.toLowerCase().includes(t)).slice(0, 20);
  }, [q, state]);

  const go = (href: string) => {
    router.push(href);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="h-4 w-4 text-subtle" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setIdx((i) => Math.min(results.length - 1, i + 1));
              if (e.key === "ArrowUp") setIdx((i) => Math.max(0, i - 1));
              if (e.key === "Enter" && results[idx]) go(results[idx].href);
            }}
            placeholder="Type to search… (Enter to open, Esc to close)"
            className="w-full bg-transparent py-3 text-sm text-ink outline-none placeholder:text-subtle"
          />
        </div>
        <ul className="max-h-96 overflow-y-auto py-1">
          {results.map((r, i) => (
            <li key={r.kind + r.href + r.label}>
              <button
                onMouseEnter={() => setIdx(i)}
                onClick={() => go(r.href)}
                className={clsx("flex w-full items-center gap-3 px-4 py-2 text-left", i === idx && "bg-chip")}
              >
                <span className="w-20 shrink-0 text-[11px] font-medium uppercase tracking-wide text-subtle">{r.kind}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{r.label}</span>
                  <span className="block truncate text-xs text-muted">{r.sub}</span>
                </span>
                <Target className="h-3.5 w-3.5 text-subtle" />
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No matches</li>}
        </ul>
      </div>
    </div>
  );
}
