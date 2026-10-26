import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  if (!env.authBypass) await (await createSupabaseServerClient()).auth.signOut();
  return NextResponse.json({ ok: true });
}
