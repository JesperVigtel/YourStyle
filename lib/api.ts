import "server-only";
import { connection, NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { requireUser, UnauthorizedError, type Ctx } from "@/lib/auth";
import { NotFoundError } from "@/lib/data/repo";
import { AiError } from "@/lib/ai/provider";
import { formatZodIssues } from "@/lib/ai/run";

export class BadRequestError extends Error {}

type Handler<P> = (ctx: Ctx, req: Request, params: P) => Promise<Response | unknown>;

/** Wraps a route handler: auth, JSON responses, consistent error mapping. */
export function route<P = Record<string, string>>(fn: Handler<P>) {
  return async (req: Request, segment: { params: Promise<P> }) => {
    // Always request-time: never prerender or cache user data. Outside the try so the
    // prerender bail-out isn't turned into an error response.
    await connection();
    try {
      const ctx = await requireUser();
      const out = await fn(ctx, req, await segment.params);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
  if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (e instanceof BadRequestError) return NextResponse.json({ error: e.message }, { status: 400 });
  if (e instanceof ZodError) return NextResponse.json({ error: formatZodIssues(e) }, { status: 400 });
  if (e instanceof AiError) {
    console.error(e.message);
    return NextResponse.json({ error: e.userMessage }, { status: 502 });
  }
  console.error(e);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }
  return schema.parse(json);
}
