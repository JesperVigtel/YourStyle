import type Anthropic from "@anthropic-ai/sdk";

export type ContentBlock = Anthropic.Beta.BetaContentBlockParam;

export type AiRequest = {
  task: string;
  system: string;
  content: ContentBlock[];
  /** JSON schema for structured output (already transformed for the API). */
  jsonSchema: Record<string, unknown>;
  maxTokens: number;
  /** Fixture response used by the mock provider. */
  mock: () => unknown;
};

/** A follow-up turn used when the first response failed validation. */
export type RetryTurn = { previousText: string; error: string };

export type AiRawResult = {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export interface AiProvider {
  readonly name: "anthropic" | "mock" | "test";
  call(req: AiRequest, retry?: RetryTurn): Promise<AiRawResult>;
}

/** An AI failure with a message that is safe and useful to show in the UI. */
export class AiError extends Error {
  constructor(
    public userMessage: string,
    detail?: string,
  ) {
    super(detail ? `${userMessage} (${detail})` : userMessage);
    this.name = "AiError";
  }
}
