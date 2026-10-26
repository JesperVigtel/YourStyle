import type { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { estimateCostUsd } from "./cost";
import { AiError, type AiProvider, type AiRawResult, type ContentBlock, type RetryTurn } from "./provider";

export type TaskDef<I, O, R> = {
  name: string;
  schema: z.ZodType<O>;
  maxTokens: number;
  build(input: I): { system: string; content: ContentBlock[] };
  mock(input: I): O;
  /** Post-validation clean-up: drops hallucinated item ids, clamps ranges, maps aliases. */
  post(output: O, input: I): R;
};

export type AiCallLog = {
  task: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  est_cost_usd: number;
  latency_ms: number;
  ok: boolean;
};

export type RunDeps = {
  provider: AiProvider;
  log: (call: AiCallLog) => Promise<unknown>;
};

const schemaCache = new WeakMap<object, Record<string, unknown>>();
function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  let s = schemaCache.get(schema);
  if (!s) {
    s = zodOutputFormat(schema).schema as Record<string, unknown>;
    schemaCache.set(schema, s);
  }
  return s;
}

export function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

/** Parses model text as JSON and validates it. Returns the data or a human-readable error. */
export function parseAndValidate<O>(
  schema: z.ZodType<O>,
  text: string,
): { ok: true; data: O } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch (e) {
    return {
      ok: false,
      error: `Response was not valid JSON: ${(e as Error).message}`,
    };
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: formatZodIssues(parsed.error) };
}

/**
 * Runs one AI task: build → call → validate (retry once with the validation error) →
 * post-process. Every call is logged with tokens and estimated cost.
 */
export async function runTask<I, O, R>(deps: RunDeps, task: TaskDef<I, O, R>, input: I): Promise<R> {
  const { system, content } = task.build(input);
  const req = {
    task: task.name,
    system,
    content,
    jsonSchema: jsonSchemaFor(task.schema),
    maxTokens: task.maxTokens,
    mock: () => task.mock(input),
  };

  let retry: RetryTurn | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    let raw: AiRawResult;
    try {
      raw = await deps.provider.call(req, retry);
    } catch (e) {
      await safeLog(deps, {
        task: task.name,
        model: "unknown",
        input_tokens: 0,
        output_tokens: 0,
        est_cost_usd: 0,
        latency_ms: Date.now() - started,
        ok: false,
      });
      if (e instanceof AiError) throw e;
      throw new AiError("Something went wrong talking to the AI.", (e as Error).message);
    }
    const result = parseAndValidate(task.schema, raw.text);
    await safeLog(deps, {
      task: task.name,
      model: raw.model,
      input_tokens: raw.inputTokens,
      output_tokens: raw.outputTokens,
      est_cost_usd: estimateCostUsd(raw.model, raw.inputTokens, raw.outputTokens),
      latency_ms: Date.now() - started,
      ok: result.ok,
    });
    if (result.ok) return task.post(result.data, input);
    retry = { previousText: raw.text, error: result.error };
  }
  throw new AiError("The AI returned something unexpected. Please try again.", retry?.error);
}

async function safeLog(deps: RunDeps, call: AiCallLog) {
  try {
    await deps.log(call);
  } catch (e) {
    console.error("ai_calls log failed", e);
  }
}
