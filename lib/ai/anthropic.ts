import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AiError, type AiProvider, type AiRawResult, type AiRequest, type RetryTurn } from "./provider";

type Options = {
  model: string;
  effort: "low" | "medium" | "high";
  fallbacks: boolean;
};

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  constructor(private opts: Options) {
    // Reads ANTHROPIC_API_KEY from the server environment.
    this.client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  }

  async call(req: AiRequest, retry?: RetryTurn): Promise<AiRawResult> {
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: req.content }];
    if (retry) {
      messages.push({ role: "assistant", content: retry.previousText });
      messages.push({
        role: "user",
        content: `Your previous response failed validation:\n${retry.error}\nReturn the corrected JSON only.`,
      });
    }
    // Haiku has no server-side fallback model.
    const useFallbacks = this.opts.fallbacks && !this.opts.model.startsWith("claude-haiku");

    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await this.client.beta.messages.create({
        model: this.opts.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages,
        output_config: {
          effort: this.opts.effort,
          format: { type: "json_schema", schema: req.jsonSchema },
        },
        ...(useFallbacks
          ? {
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default" as const,
            }
          : {}),
      });
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError)
        throw new AiError("AI is not configured (bad API key).", e.message);
      if (e instanceof Anthropic.RateLimitError)
        throw new AiError("AI is busy right now. Try again in a minute.", e.message);
      if (e instanceof Anthropic.APIConnectionError) throw new AiError("Couldn't reach the AI service.", e.message);
      if (e instanceof Anthropic.APIError) throw new AiError("The AI request failed.", `${e.status} ${e.message}`);
      throw e;
    }

    const u = res.usage;
    const usage = {
      model: res.model,
      inputTokens: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
      outputTokens: u.output_tokens,
    };
    if (res.stop_reason === "refusal") {
      throw new AiError(
        "The AI declined this request. Try a different photo.",
        res.stop_details?.category ?? undefined,
        usage,
      );
    }
    if (res.stop_reason === "max_tokens") {
      throw new AiError("The AI response was cut off.", "max_tokens", usage);
    }
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { text, ...usage };
  }
}
