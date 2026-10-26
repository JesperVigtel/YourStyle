"use client";

import clsx from "clsx";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function PageHeader({ title, action, back }: { title: string; action?: ReactNode; back?: string }) {
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="px-safe mx-auto flex h-14 max-w-xl items-center gap-2">
        {back && (
          <Link href={back} aria-label="Back" className="-ml-2 flex h-11 w-11 items-center justify-center text-ink">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
        <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
        {action}
      </div>
    </header>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={clsx("px-safe pb-tabbar mx-auto max-w-xl pt-4", className)}>{children}</main>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "lg";
};

export function Button({ variant = "secondary", size = "md", className, ...props }: BtnProps) {
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50",
        size === "lg" ? "h-14 px-6 text-base" : "h-11 px-4 text-sm",
        variant === "primary" && "bg-accent text-accent-ink",
        variant === "secondary" && "border border-line bg-surface text-ink",
        variant === "ghost" && "text-ink",
        variant === "danger" && "border border-bad/40 bg-bad-soft text-bad",
        className,
      )}
    />
  );
}

export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        "h-9 shrink-0 rounded-full border px-3.5 text-sm whitespace-nowrap transition",
        selected ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ChipRow({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {children}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx("rounded-2xl border border-line bg-surface p-4", className)}>{children}</section>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton rounded-xl", className)} aria-hidden />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={clsx("h-5 w-5 animate-spin", className)} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
      {children}
    </p>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-6 mb-2 text-xs font-semibold tracking-wider text-muted uppercase">{children}</h2>;
}

export function Field({ label, children, warn }: { label: string; children: ReactNode; warn?: boolean }) {
  return (
    <label
      className={clsx("block rounded-xl", warn && "bg-warn-soft p-2 ring-1 ring-warn/50")}
      data-low-confidence={warn || undefined}
    >
      <span className="mb-1 flex items-center gap-1 text-xs font-medium text-muted">
        {label}
        {warn && <span className="text-warn">· check this</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none";
