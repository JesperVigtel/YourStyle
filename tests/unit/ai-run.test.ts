import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { runTask, type AiCallLog, type TaskDef } from "@/lib/ai/run";
import { AiError, type AiProvider, type AiRequest, type RetryTurn } from "@/lib/ai/provider";
import { estimateCostUsd } from "@/lib/ai/cost";

const schema = z.object({ n: z.number(), label: z.string() });
const task: TaskDef<{ x: number }, z.infer<typeof schema>, string> = {
  name: "testTask",
  schema,
  maxTokens: 100,
  build: (i) => ({ system: "sys", content: [{ type: "text", text: `x=${i.x}` }] }),
  mock: () => ({ n: 1, label: "mock" }),
  post: (o, i) => `${o.label}:${o.n * i.x}`,
};

/** Provider that returns the given texts in order and records what it was asked. */
function scripted(texts: (string | Error)[]) {
  const calls: { req: AiRequest; retry?: RetryTurn }[] = [];
  const provider: AiProvider = {
    name: "test",
    async call(req, retry) {
      calls.push({ req, retry });
      const t = texts[calls.length - 1];
      if (t instanceof Error) throw t;
      return { text: t, model: "claude-sonnet-5-5", inputTokens: 1000, outputTokens: 200 };
    },
  };
  return { provider, calls };
}

function deps(provider: AiProvider) {
  const logs: AiCallLog[] = [];
  return { logs, deps: { provider, log: async (c: AiCallLog) => void logs.push(c) } };
}

describe("runTask", () => {
  it("validates, post-processes, and logs tokens + cost", async () => {
    const { provider, calls } = scripted(['{"n": 2, "label": "ok"}']);
    const { logs, deps: d } = deps(provider);
    await expect(runTask(d, task, { x: 5 })).resolves.toBe("ok:10");
    expect(calls).toHaveLength(1);
    expect(calls[0].req.jsonSchema).toMatchObject({ type: "object", additionalProperties: false });
    expect(logs).toEqual([
      expect.objectContaining({
        task: "testTask",
        model: "claude-sonnet-5-5",
        input_tokens: 1000,
        output_tokens: 200,
        ok: true,
        est_cost_usd: estimateCostUsd("claude-sonnet-5-5", 1000, 200),
      }),
    ]);
  });

  it("retries once with the validation error, then succeeds", async () => {
    const { provider, calls } = scripted(['{"n": "two", "label": "ok"}', '{"n": 2, "label": "fixed"}']);
    const { logs, deps: d } = deps(provider);
    await expect(runTask(d, task, { x: 1 })).resolves.toBe("fixed:2");
    expect(calls).toHaveLength(2);
    expect(calls[1].retry?.previousText).toBe('{"n": "two", "label": "ok"}');
    expect(calls[1].retry?.error).toContain("n");
    expect(logs.map((l) => l.ok)).toEqual([false, true]);
  });

  it("fails with a friendly error after two invalid responses", async () => {
    const { provider, calls } = scripted(["not json", '{"label": 3}']);
    const { deps: d } = deps(provider);
    const err = await runTask(d, task, { x: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect((err as AiError).userMessage).toMatch(/unexpected/);
    expect(calls).toHaveLength(2);
  });

  it("accepts JSON wrapped in a markdown fence", async () => {
    const { provider } = scripted(['```json\n{"n": 1, "label": "f"}\n```']);
    await expect(runTask(deps(provider).deps, task, { x: 1 })).resolves.toBe("f:1");
  });

  it("wraps provider errors and logs the failed call", async () => {
    const { provider } = scripted([new Error("socket hang up")]);
    const { logs, deps: d } = deps(provider);
    const err = await runTask(d, task, { x: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(logs).toEqual([expect.objectContaining({ ok: false })]);
  });

  it("logs billed tokens even when the provider fails after the model ran (refusal, max_tokens)", async () => {
    const usage = { model: "claude-opus-5-5", inputTokens: 5000, outputTokens: 6000 };
    const { provider } = scripted([new AiError("The AI response was cut off.", "max_tokens", usage)]);
    const { logs, deps: d } = deps(provider);
    await runTask(d, task, { x: 1 }).catch(() => undefined);
    expect(logs).toEqual([
      expect.objectContaining({
        model: "claude-opus-5-5",
        input_tokens: 5000,
        output_tokens: 6000,
        ok: false,
        est_cost_usd: estimateCostUsd("claude-opus-5-5", 5000, 6000),
      }),
    ]);
  });

  it("passes AiErrors from the provider through unchanged", async () => {
    const { provider } = scripted([new AiError("AI is busy right now.")]);
    const err = await runTask(deps(provider).deps, task, { x: 1 }).catch((e) => e);
    expect((err as AiError).userMessage).toBe("AI is busy right now.");
  });

  it("never fails the task because cost logging failed", async () => {
    const { provider } = scripted(['{"n": 1, "label": "a"}']);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      runTask({ provider, log: async () => Promise.reject(new Error("db down")) }, task, { x: 1 }),
    ).resolves.toBe("a:1");
    spy.mockRestore();
  });
});

describe("estimateCostUsd", () => {
  it("prices known models and is zero for the mock", () => {
    expect(estimateCostUsd("claude-opus-5-5", 1_000_000, 0)).toBe(4);
    expect(estimateCostUsd("claude-opus-5-5", 0, 1_000_000)).toBe(20);
    expect(estimateCostUsd("claude-sonnet-5-5", 1000, 1000)).toBeCloseTo(0.012);
    expect(estimateCostUsd("claude-haiku-5-5", 1_000_000, 1_000_000)).toBeCloseTo(0.6);
    expect(estimateCostUsd("mock", 1e6, 1e6)).toBe(0);
  });
  it("prices unknown models conservatively", () => {
    expect(estimateCostUsd("some-new-model", 1_000_000, 0)).toBe(5);
  });
});
