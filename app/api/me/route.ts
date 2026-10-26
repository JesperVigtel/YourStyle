import { route } from "@/lib/api";
import { env } from "@/lib/env";

export const GET = route(async ({ user }) => ({
  email: user.email,
  devMode: env.authBypass,
  aiProvider: env.aiProvider,
  aiModel: env.aiProvider === "mock" ? "mock" : env.aiModel,
}));
