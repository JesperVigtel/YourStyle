import "server-only";
import { env } from "@/lib/env";
import type { Repo } from "@/lib/data/repo";
import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import type { AiProvider } from "./provider";
import { runTask, type TaskDef } from "./run";

export { AiError } from "./provider";

let cached: AiProvider | null = null;

export function getProvider(): AiProvider {
  if (cached) return cached;
  cached =
    env.aiProvider === "mock"
      ? new MockProvider(env.mockLatencyMs)
      : new AnthropicProvider({
          model: env.aiModel,
          effort: env.aiEffort,
          fallbacks: env.aiFallbacks,
        });
  return cached;
}

/** Runs a task with the configured provider, logging each call to ai_calls. */
export function ai<I, O, R>(repo: Repo, task: TaskDef<I, O, R>, input: I): Promise<R> {
  return runTask({ provider: getProvider(), log: (call) => repo.insert("ai_calls", call) }, task, input);
}
