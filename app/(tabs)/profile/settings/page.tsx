"use client";

import useSWR from "swr";
import { Button, Card, Page, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { api, fetcher } from "@/lib/client/api";

type Costs = {
  monthStart: string;
  total: number;
  calls: number;
  byTask: Record<string, { calls: number; cost: number }>;
  medianLatencyMs: number | null;
};
type Me = {
  email: string;
  devMode: boolean;
  aiProvider: string;
  aiModel: string;
};

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;

export default function SettingsPage() {
  const { data: costs } = useSWR<Costs>("/api/costs", fetcher);
  const { data: me } = useSWR<Me>("/api/me", fetcher);

  const signOut = async () => {
    await api("/api/auth/signout", { method: "POST" });
    // Drop offline copies of my data (the scan queue is kept so no unsent photos are lost).
    if ("caches" in window) {
      for (const key of await caches.keys())
        if (key.startsWith("data-") || key.startsWith("pages-")) await caches.delete(key);
    }
    // Full reload so no cached data from the old session survives.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  };

  return (
    <>
      <PageHeader title="Settings" back="/profile" />
      <Page>
        <SectionTitle>AI cost this month</SectionTitle>
        <Card>
          {!costs ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <p className="text-3xl font-semibold" data-testid="ai-cost-total">
                {usd(costs.total)}
              </p>
              <p className="text-xs text-muted">
                {costs.calls} call{costs.calls === 1 ? "" : "s"} since {new Date(costs.monthStart).toLocaleDateString()}
                {costs.medianLatencyMs ? ` · median ${(costs.medianLatencyMs / 1000).toFixed(1)} s` : ""} · guardrail
                $5/month
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {Object.entries(costs.byTask).map(([task, t]) => (
                  <li key={task} className="flex justify-between">
                    <span>{task}</span>
                    <span className="text-muted">
                      {t.calls}× · {usd(t.cost)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <SectionTitle>Account</SectionTitle>
        <Card>
          {me ? (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Signed in as</dt>
                <dd>{me.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">AI</dt>
                <dd>{me.aiProvider === "mock" ? "mock (no API calls)" : me.aiModel}</dd>
              </div>
              {me.devMode && <p className="pt-2 text-xs text-warn">Dev mode: local data, no login.</p>}
            </dl>
          ) : (
            <Skeleton className="h-12 w-full" />
          )}
          {me && !me.devMode && (
            <Button className="mt-3 w-full" onClick={signOut}>
              Sign out
            </Button>
          )}
        </Card>
      </Page>
    </>
  );
}
