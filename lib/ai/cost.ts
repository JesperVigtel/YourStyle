// USD per million tokens (input, output). Anthropic first-party list prices.
const PRICES: [prefix: string, input: number, output: number][] = [
  ["claude-fable-5", 10, 50],
  ["claude-opus-5-5", 4, 20],
  ["claude-opus-5", 5, 25],
  ["claude-opus-4", 5, 25],
  ["claude-sonnet-5", 2, 10],
  ["claude-sonnet-4-6", 3, 15],
  ["claude-haiku-5-5", 0.1, 0.5],
  ["claude-haiku-4-5", 1, 5],
];

/** Estimated cost of one call. Unknown models are priced at Opus 5 rates (conservative). */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  if (model === "mock") return 0;
  const hit = PRICES.find(([p]) => model.startsWith(p));
  const [, inp, out] = hit ?? ["", 5, 25];
  return (inputTokens * inp + outputTokens * out) / 1_000_000;
}
