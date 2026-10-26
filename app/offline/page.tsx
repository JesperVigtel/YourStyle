import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="pt-safe px-safe mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center text-center">
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="mt-2 text-sm text-muted">
        This page isn&apos;t saved for offline use yet. Shop scans still work: open the Shop tab.
      </p>
      <Link
        href="/shop"
        className="mt-4 inline-flex h-11 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink"
      >
        Open Shop
      </Link>
    </main>
  );
}
