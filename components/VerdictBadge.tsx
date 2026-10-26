import clsx from "clsx";

export function VerdictBadge({ verdict }: { verdict?: string | null }) {
  if (!verdict) return null;
  const styles: Record<string, string> = {
    buy: "bg-good-soft text-good",
    maybe: "bg-warn-soft text-warn",
    skip: "bg-bad-soft text-bad",
    pending: "bg-surface-2 text-muted",
    error: "bg-bad-soft text-bad",
  };
  return (
    <span
      data-testid="verdict-badge"
      className={clsx("rounded-full px-3 py-1 text-xs font-semibold uppercase", styles[verdict])}
    >
      {verdict}
    </span>
  );
}
