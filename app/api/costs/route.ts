import { route } from "@/lib/api";
import type { Row } from "@/lib/data/repo";
import type { AiCall } from "@/lib/types";

/** AI spend for the current calendar month (UTC), per task. */
export const GET = route(async ({ repo }) => {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const calls = await repo.list<AiCall & Row>("ai_calls", { gte: { created_at: monthStart } });
  const byTask: Record<string, { calls: number; cost: number }> = {};
  let total = 0;
  for (const c of calls) {
    const cost = Number(c.est_cost_usd);
    total += cost;
    const t = (byTask[c.task] ??= { calls: 0, cost: 0 });
    t.calls += 1;
    t.cost += cost;
  }
  const latencies = calls.filter((c) => c.ok && c.latency_ms).map((c) => c.latency_ms!);
  return { monthStart, total, calls: calls.length, byTask, medianLatencyMs: median(latencies) };
});

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
