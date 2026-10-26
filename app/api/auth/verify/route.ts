import { NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedEmail } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const body = z.object({ email: z.email(), token: z.string().regex(/^\d{6,10}$/) });

/**
 * Verifies the code from the email. This is how the installed iPhone app signs in: a magic link
 * opens in Safari, whose cookies the home-screen app doesn't share.
 */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the code from the email." }, { status: 400 });
  if (!isAllowedEmail(parsed.data.email)) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
