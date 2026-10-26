import { readFileSync, readdirSync } from "fs";
import path from "path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { DEFAULTS, TABLES } from "@/lib/data/repo";

// Runs the real Supabase migration against an in-process Postgres (PGlite) with minimal stand-ins
// for Supabase's auth and storage schemas, then checks RLS isolates users.

const STUBS = `
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select string_to_array(name, '/') $$;
grant usage on schema public, auth, storage to authenticated;
`;

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
let db: PGlite;

async function as<T>(user: string, sql: string, params: unknown[] = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUBS);
  const dir = path.resolve("supabase/migrations");
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(path.join(dir, f), "utf8"));
  await db.exec(`
    insert into auth.users values ('${A}'), ('${B}');
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select, insert on storage.objects to authenticated;
  `);
}, 60_000);

describe("migration", () => {
  it("creates every table the app uses, with RLS enabled", async () => {
    const res = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`,
    );
    const byName = new Map(res.rows.map((r) => [r.relname, r.relrowsecurity]));
    for (const t of TABLES) expect(byName.get(t), t).toBe(true);
  });

  it("has a column for every default the local repo fills in", async () => {
    for (const t of TABLES) {
      const cols = await db.query<{ column_name: string }>(
        `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`,
        [t],
      );
      const names = new Set(cols.rows.map((c) => c.column_name));
      for (const k of Object.keys(DEFAULTS[t])) expect(names.has(k), `${t}.${k}`).toBe(true);
    }
  });

  it("fills user_id from auth.uid() and isolates users with RLS", async () => {
    await as(A, `insert into items (category, colors, seasons) values ('top', '[{"name":"white"}]', '{summer}')`);
    await as(B, `insert into items (category) values ('shoes')`);
    const seenByA = await as<{ category: string; user_id: string }>(A, `select category, user_id from items`);
    expect(seenByA).toEqual([{ category: "top", user_id: A }]);
    const seenByB = await as<{ category: string }>(B, `select category from items`);
    expect(seenByB).toEqual([{ category: "shoes" }]);
  });

  it("rejects writing rows for another user", async () => {
    await expect(as(A, `insert into feedback (user_id, rating) values ('${B}', 1)`)).rejects.toThrow(/row-level security/);
  });

  it("enforces value checks", async () => {
    await expect(as(A, `insert into items (category, formality) values ('top', 7)`)).rejects.toThrow(/check/);
    await expect(as(A, `insert into items (category, status) values ('top', 'lost')`)).rejects.toThrow(/check/);
  });

  it("restricts storage objects to the user's own folder", async () => {
    await as(A, `insert into storage.objects (bucket_id, name) values ('wardrobe', '${A}/uploads/x.jpg')`);
    await expect(as(A, `insert into storage.objects (bucket_id, name) values ('wardrobe', '${B}/uploads/x.jpg')`)).rejects.toThrow(
      /row-level security/,
    );
    expect(await as(B, `select name from storage.objects`)).toEqual([]);
  });
});
