"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
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
  Sparkles,
  Sun,
  Swords,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { useIntel } from "@/lib/store";
import { ARENA_SHORT, COUNTRY_FLAG } from "@/lib/labels";

const NAV = [
  { href: "/", label: "Executive overview", short: "Overview", icon: Gauge, primary: true },
  { href: "/competitors", label: "Competitors", short: "Competitors", icon: Swords, primary: true },
  { href: "/markets", label: "Markets", short: "Markets", icon: Globe2, primary: true },
  { href: "/accounts", label: "Accounts", short: "Accounts", icon: Building2, primary: true },
  { href: "/pricing", label: "Pricing & scenarios", short: "Pricing", icon: DollarSign, primary: true },
  { href: "/sales", label: "Sales & win/loss", short: "Sales", icon: TrendingUp, primary: true },
  { href: "/research", label: "Research & evidence", short: "Research", icon: BookOpen, primary: false },
  { href: "/strategy", label: "Strategy & tasks", short: "Strategy", icon: Compass, primary: false },
  { href: "/alerts", label: "Alerts", short: "Alerts", icon: Bell, primary: false },
  { href: "/brief", label: "Weekly brief", short: "Brief", icon: FileText, primary: false },
  { href: "/ask", label: "Ask the analyst", short: "Ask", icon: MessageSquareText, primary: false },
  { href: "/settings", label: "Models & data", short: "Settings", icon: Settings, primary: false },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { state } = useIntel();
  const [mobile, setMobile] = useState(false);
  const [more, setMore] = useState(false);
  const [search, setSearch] = useState(false);
  const [dark, setDark] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const newAlerts = state.signals.filter((s) => s.status === "new").length;

  // Hexa brand is dark-first; respect an explicit stored preference.
  useEffect(() => {
    let d = true;
    try {
      const pref = localStorage.getItem("hexa-theme");
      if (pref) d = pref === "dark";
    } catch {}
    setDark(d);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
      if (e.key === "Escape") {
        setSearch(false);
        setMore(false);
        setMobile(false);
      }
    };
    const onScroll = () => setScrolled(window.scrollY > 8);
    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMore(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  useEffect(() => {
    setMobile(false);
    setMore(false);
  }, [path]);

  const toggleTheme = () => {
    setDark((d) => {
      try {
        localStorage.setItem("hexa-theme", d ? "light" : "dark");
      } catch {}
      return !d;
    });
  };

  const secondaryActive = NAV.some((n) => !n.primary && isActive(path, n.href));

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />

      <header className="no-print sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <nav
          className={clsx(
            "glass-nav mx-auto flex max-w-[1440px] items-center gap-2 rounded-2xl px-3 py-2 transition-shadow sm:px-4",
            scrolled && "glass-nav-scrolled",
          )}
        >
          <Link href="/" className="flex shrink-0 items-center gap-2.5 pr-2" aria-label="Hexa Strategic Intelligence home">
            <Image src="/hexa-logo.png" alt="HEXA" width={477} height={110} priority className="h-6 w-auto" />
            <span className="hidden border-l border-line pl-2.5 leading-tight xl:block">
              <span className="block text-[11px] font-semibold tracking-wide text-ink">Strategic Intelligence</span>
              <span className="block text-[10px] text-muted">Hexamatics Nepal</span>
            </span>
          </Link>

          <div className="hidden flex-1 items-center justify-center gap-0.5 lg:flex">
            {NAV.filter((n) => n.primary).map((n) => (
              <NavPill key={n.href} href={n.href} active={isActive(path, n.href)} icon={n.icon}>
                {n.short}
              </NavPill>
            ))}
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMore((m) => !m)}
                className={clsx("nav-pill", secondaryActive && "nav-pill-active")}
                aria-expanded={more}
              >
                More <ChevronDown className={clsx("h-3.5 w-3.5 transition", more && "rotate-180")} />
                {newAlerts > 0 && <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-hexa-pink" />}
              </button>
              {more && (
                <div className="glass-pop absolute right-0 top-full mt-2 w-60 rounded-xl p-1.5">
                  {NAV.filter((n) => !n.primary).map((n) => (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={clsx(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                        isActive(path, n.href) ? "bg-brand-50 font-medium text-brand-700" : "text-ink-2 hover:bg-chip",
                      )}
                    >
                      <n.icon className="h-4 w-4" />
                      <span className="flex-1">{n.label}</span>
                      {n.href === "/alerts" && newAlerts > 0 && <span className="rounded-full bg-hexa-gradient px-1.5 text-[10px] font-semibold text-white">{newAlerts}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
            <button onClick={() => setSearch(true)} className="nav-icon-btn flex items-center gap-2 sm:w-auto sm:px-3" aria-label="Search">
              <Search className="h-4 w-4" />
              <span className="hidden text-xs text-muted sm:inline 2xl:hidden">⌘K</span>
              <span className="hidden text-xs text-muted 2xl:inline">Search… ⌘K</span>
            </button>
            <Link href="/alerts" className="nav-icon-btn relative" aria-label={`Alerts (${newAlerts} new)`}>
              <Bell className="h-4 w-4" />
              {newAlerts > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-hexa-gradient px-1 text-[9px] font-bold text-white">{newAlerts}</span>
              )}
            </Link>
            <button onClick={toggleTheme} className="nav-icon-btn" aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link href="/ask" className="btn-hexa hidden items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold sm:inline-flex">
              <Sparkles className="h-4 w-4" /> Ask
            </Link>
            <button className="nav-icon-btn lg:hidden" onClick={() => setMobile(true)} aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>
        <div className="mx-auto mt-2 flex max-w-[1440px] justify-end px-1">
          <span className="rounded-full bg-warn-50 px-2.5 py-0.5 text-[10px] font-medium text-warn ring-1 ring-inset ring-warn-200">Seed data — illustrative, verify before use</span>
        </div>
      </header>

      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobile(false)} />
          <div className="glass-pop absolute inset-x-3 top-3 rounded-2xl p-3">
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <Image src="/hexa-logo.png" alt="HEXA" width={477} height={110} className="h-5 w-auto" />
              <button className="nav-icon-btn" onClick={() => setMobile(false)} aria-label="Close navigation">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={clsx(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition",
                    isActive(path, n.href) ? "bg-brand-50 font-medium text-brand-700" : "text-ink-2 hover:bg-chip",
                  )}
                >
                  <n.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{n.short === "Ask" ? "Ask analyst" : n.short}</span>
                  {n.href === "/alerts" && newAlerts > 0 && <span className="ml-auto rounded-full bg-hexa-gradient px-1.5 text-[10px] font-semibold text-white">{newAlerts}</span>}
                </Link>
              ))}
            </div>
            <p className="mt-3 border-t border-line px-2 pt-3 text-[11px] leading-relaxed text-muted">
              <b className="text-ink-2">Central question:</b> where can Hexa win profitable business next, against whom, at what price, and what must we do?
            </p>
          </div>
        </div>
      )}

      <main className="relative z-10 mx-auto w-full max-w-[1440px] px-4 pb-10 pt-4 sm:px-6 lg:px-8">{children}</main>
      {search && <CommandPalette onClose={() => setSearch(false)} />}
    </div>
  );
}

function NavPill({ href, active, icon: Icon, children }: { href: string; active: boolean; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <Link href={href} className={clsx("nav-pill", active && "nav-pill-active")}>
      <Icon className="h-3.5 w-3.5" />
      {children}
    </Link>
  );
}

function AmbientBackground() {
  return (
    <div className="ambient-bg-layer no-print" aria-hidden>
      <div className="ambient-orb ambient-orb-purple" />
      <div className="ambient-orb ambient-orb-magenta" />
      <div className="ambient-orb ambient-orb-blue" />
      <div className="ambient-hex-grid" />
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-24 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop w-full max-w-xl overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
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
            className="w-full bg-transparent py-3.5 text-sm text-ink outline-none placeholder:text-subtle"
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
