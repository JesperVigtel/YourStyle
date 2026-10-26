import { NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedEmail } from "@/lib/auth";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const body = z.object({ email: z.email() });

/** Sends the magic link + 6-digit code, but only to the allowlisted email. */
export async function POST(req: Request) {
  if (env.authBypass) return NextResponse.json({ error: "Dev mode: no login needed." }, { status: 400 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (!isAllowedEmail(parsed.data.email)) {
    return NextResponse.json({ error: "This email isn't allowed to sign in." }, { status: 403 });
  }
  const supabase = await createSupabaseServerClient();
  const origin = new URL(req.url).origin;
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: true },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
