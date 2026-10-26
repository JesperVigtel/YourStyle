import "server-only";
import path from "path";
import { env } from "@/lib/env";
import { LocalRepo } from "@/lib/data/local";
import { SupabaseRepo } from "@/lib/data/supabase";
import type { Repo } from "@/lib/data/repo";
import { LocalBlobStore, SupabaseBlobStore, type BlobStore } from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type User = { id: string; email: string };
export type Ctx = { user: User; repo: Repo; store: BlobStore };

export class UnauthorizedError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  const allowed = env.allowedEmail;
  return !!email && !!allowed && email.trim().toLowerCase() === allowed;
}

/** Resolves the signed-in, allowlisted user plus data access bound to their session. */
export async function requireUser(): Promise<Ctx> {
  if (env.authBypass) {
    const dir = env.localDataDir;
    return {
      user: { id: "local-user", email: env.allowedEmail ?? "dev@localhost" },
      repo: new LocalRepo(dir),
      store: new LocalBlobStore(path.join(dir, "uploads")),
    };
  }
  const supabase = await createSupabaseServerClient();
  // getClaims verifies the JWT (locally with asymmetric signing keys, else via the auth server).
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  const email = data?.claims?.email as string | undefined;
  if (error || !id) throw new UnauthorizedError();
  if (!isAllowedEmail(email)) throw new UnauthorizedError("This account is not allowed");
  return {
    user: { id, email: email! },
    repo: new SupabaseRepo(supabase),
    store: new SupabaseBlobStore(supabase, id),
  };
}
