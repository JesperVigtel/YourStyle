import type { AiProvider, AiRequest, AiRawResult } from "./provider";

/**
 * Offline provider (AI_PROVIDER=mock). Returns each task's fixture so the whole app runs
 * and is testable without an API key. The output still goes through validation and the
 * item-id filter like a real response.
 */
export class MockProvider implements AiProvider {
  readonly name = "mock" as const;
  constructor(private latencyMs = 0) {}

  async call(req: AiRequest): Promise<AiRawResult> {
    if (this.latencyMs) await new Promise((r) => setTimeout(r, this.latencyMs));
    const text = JSON.stringify(req.mock());
    return { text, model: "mock", inputTokens: 0, outputTokens: 0 };
  }
}
