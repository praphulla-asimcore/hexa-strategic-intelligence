"use client";

import clsx from "clsx";
import { ExternalLink, Info } from "lucide-react";
import type { Confidence, Provenance, Urgency, Verification } from "@/lib/types";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.7rem]">{title}</h1>
        <div className="mt-2 h-[3px] w-14 rounded-full bg-hexa-gradient" />
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className, pad = true }: { title?: React.ReactNode; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={clsx("glass fade-up min-w-0 rounded-2xl", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={clsx(pad && "p-5")}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone = "default", icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "default" | "good" | "warn" | "bad"; icon?: React.ReactNode }) {
  return (
    <div className="glass fade-up group relative overflow-hidden rounded-2xl p-4 transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(139,24,232,0.18)]">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-hexa-gradient opacity-60 transition group-hover:opacity-100" />
      <div className="flex items-center justify-between text-xs font-medium text-muted">
        <span>{label}</span>
        {icon && <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-700">{icon}</span>}
      </div>
      <div
        className={clsx(
          "mt-2 text-2xl font-semibold tabular-nums",
          tone === "good" && "text-good",
          tone === "warn" && "text-warn",
          tone === "bad" && "text-bad",
          tone === "default" && "text-ink",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

const badgeTone = {
  slate: "bg-chip text-ink-2 ring-line",
  blue: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-good-50 text-good ring-good-200",
  amber: "bg-warn-50 text-warn ring-warn-200",
  red: "bg-bad-50 text-bad ring-bad-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-800",
};

export function Badge({ children, tone = "slate", className, title }: { children: React.ReactNode; tone?: keyof typeof badgeTone; className?: string; title?: string }) {
  return (
    <span title={title} className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", badgeTone[tone], className)}>
      {children}
    </span>
  );
}

export function ConfidenceBadge({ c }: { c: Confidence }) {
  return <Badge tone={c === "high" ? "green" : c === "medium" ? "amber" : "red"} title="Evidence confidence">{c} conf.</Badge>;
}

export function VerificationBadge({ v }: { v: Verification }) {
  const tone = v === "verified" ? "green" : v === "pending" ? "blue" : v === "disputed" ? "red" : "slate";
  return <Badge tone={tone}>{v}</Badge>;
}

export function UrgencyBadge({ u }: { u: Urgency }) {
  const tone = u === "critical" ? "red" : u === "high" ? "amber" : u === "medium" ? "blue" : "slate";
  return <Badge tone={tone}>{u}</Badge>;
}

export function ProvenanceLine({ p }: { p: Provenance }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
      <Info className="h-3 w-3" />
      <span>{p.source_type.replace(/_/g, " ")}</span>
      <span>·</span>
      <span>observed {p.observed_at}</span>
      <span>·</span>
      <span>{p.analyst}</span>
      <ConfidenceBadge c={p.confidence} />
      <VerificationBadge v={p.verification_status} />
      {p.source_url && (
        <a href={p.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-600 hover:underline">
          source <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

export function ScoreBar({ value, max = 100, tone }: { value: number; max?: number; tone?: "brand" | "good" | "warn" | "bad" }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const auto = tone ?? (pct >= 75 ? "good" : pct >= 55 ? "brand" : pct >= 40 ? "warn" : "bad");
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-chip">
        <div
          className={clsx("h-full rounded-full", auto === "good" && "bg-good", auto === "brand" && "bg-hexa-gradient", auto === "warn" && "bg-warn", auto === "bad" && "bg-bad")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 text-right text-xs font-semibold tabular-nums text-ink">{Math.round(value)}</span>
    </div>
  );
}

export function Button({ children, onClick, variant = "secondary", size = "md", type = "button", className, disabled, title }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; type?: "button" | "submit"; className?: string; disabled?: boolean; title?: string }) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
        variant === "primary" && "btn-hexa",
        variant === "secondary" && "border border-line bg-surface text-ink-2 backdrop-blur hover:border-brand-200 hover:bg-chip",
        variant === "ghost" && "text-ink-2 hover:bg-chip",
        variant === "danger" && "border border-bad-200 bg-bad-50 text-bad hover:opacity-90",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Select<T extends string>({ value, onChange, options, className, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string; label?: string }) {
  return (
    <label className={clsx("inline-flex items-center gap-2 text-xs text-muted", className)}>
      {label && <span>{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-xl border border-line bg-surface px-2.5 py-1.5 text-sm text-ink backdrop-blur focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink backdrop-blur placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-brand-500",
        props.className,
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink backdrop-blur placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-brand-500",
        props.className,
      )}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

export function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium text-ink-2">{label}</span>
        <span className="tabular-nums text-muted">{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-[#8b18e8]" />
    </label>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="glass mb-4 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition",
            value === t.value ? "nav-pill-active text-ink" : "text-muted hover:bg-chip hover:text-ink",
          )}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 rounded bg-chip px-1.5 text-[11px] text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}
export const Th = ({ children, className, onClick }: { children?: React.ReactNode; className?: string; onClick?: () => void }) => (
  <th onClick={onClick} className={clsx("whitespace-nowrap border-b border-line bg-chip px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted", onClick && "cursor-pointer select-none hover:text-ink", className)}>
    {children}
  </th>
);
export const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <td className={clsx("border-b border-line px-4 py-2.5 align-top text-ink-2", className)}>{children}</td>
);

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">{children}</div>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop w-full max-w-xl rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export const fmtUsd = (n: number, digits = 0) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(1)}m` : n >= 1e4 ? `$${(n / 1e3).toFixed(0)}k` : `$${n.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
export const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;
