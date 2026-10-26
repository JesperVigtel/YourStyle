import "server-only";

// Server-side environment. Never import this from client components.

export type DataBackend = "local" | "supabase";

export const env = {
  get dataBackend(): DataBackend {
    const v = process.env.DATA_BACKEND ?? "supabase";
    if (v !== "local" && v !== "supabase") throw new Error(`DATA_BACKEND must be local|supabase, got ${v}`);
    if (v === "local" && process.env.VERCEL) {
      throw new Error("DATA_BACKEND=local is for development and tests only and cannot run on Vercel.");
    }
    return v;
  },
  get localDataDir(): string {
    return process.env.LOCAL_DATA_DIR ?? ".data";
  },
  /**
   * Dev mode: the local backend has no auth server, so it runs as a fixed dev user.
   * It is refused on Vercel (see dataBackend), so production always requires login.
   */
  get authBypass(): boolean {
    return this.dataBackend === "local";
  },
  get allowedEmail(): string | null {
    return process.env.ALLOWED_EMAIL?.trim().toLowerCase() || null;
  },
  get supabaseUrl(): string {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey(): string {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get aiProvider(): "anthropic" | "mock" {
    const v = process.env.AI_PROVIDER ?? "anthropic";
    if (v !== "anthropic" && v !== "mock") throw new Error(`AI_PROVIDER must be anthropic|mock, got ${v}`);
    return v;
  },
  get aiModel(): string {
    return process.env.AI_MODEL || "claude-opus-5-5";
  },
  get aiEffort(): "low" | "medium" | "high" {
    const v = process.env.AI_EFFORT ?? "low";
    return v === "medium" || v === "high" ? v : "low";
  },
  /** Server-side refusal fallback (beta). On by default; set AI_FALLBACKS=off to disable. */
  get aiFallbacks(): boolean {
    return process.env.AI_FALLBACKS !== "off";
  },
  /** Artificial latency for the mock provider, to make skeleton states visible in dev. */
  get mockLatencyMs(): number {
    return Number(process.env.MOCK_AI_LATENCY_MS ?? 0);
  },
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}. See .env.example.`);
  return v;
}
