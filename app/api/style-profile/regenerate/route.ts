import { route } from "@/lib/api";
import { regenerateProfile } from "@/lib/server/profile";

export const maxDuration = 60;

export const POST = route(async (ctx) => ({ profile: await regenerateProfile(ctx) }));
