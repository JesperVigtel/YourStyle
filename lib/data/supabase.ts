import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ConflictError, NotFoundError, type Query, type Repo, type Row, type TableName } from "./repo";

/**
 * Postgres repository. Every query runs with the user's session, so RLS
 * (user_id = auth.uid()) scopes all rows; user_id is filled in by a column default.
 */
export class SupabaseRepo implements Repo {
  constructor(private db: SupabaseClient) {}

  // The query builder's generic types are too deep to express for a table-agnostic repo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private apply(builder: any, q: Query = {}) {
    let b = builder;
    for (const [k, v] of Object.entries(q.eq ?? {})) b = v === null ? b.is(k, null) : b.eq(k, v);
    for (const [k, v] of Object.entries(q.gte ?? {})) b = b.gte(k, v);
    for (const [k, v] of Object.entries(q.gt ?? {})) b = b.gt(k, v);
    if (q.in) b = b.in(q.in.column, q.in.values);
    if (q.order) b = b.order(q.order.column, { ascending: q.order.ascending ?? true });
    if (q.limit !== undefined) b = b.limit(q.limit);
    return b;
  }

  async list<T extends Row>(table: TableName, query?: Query): Promise<T[]> {
    const { data, error } = await this.apply(this.db.from(table).select("*"), query);
    if (error) throw new Error(`${table}.list: ${error.message}`);
    return (data ?? []) as T[];
  }

  async get<T extends Row>(table: TableName, id: string): Promise<T | null> {
    const { data, error } = await this.db.from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`${table}.get: ${error.message}`);
    return (data as T) ?? null;
  }

  async insert<T extends Row>(table: TableName, row: Partial<T>): Promise<T> {
    const { data, error } = await this.db
      .from(table)
      .insert(row as Record<string, unknown>)
      .select("*")
      .single();
    if (error?.code === "23505") throw new ConflictError(table, error.details ?? "");
    if (error) throw new Error(`${table}.insert: ${error.message}`);
    return data as T;
  }

  async update<T extends Row>(table: TableName, id: string, patch: Partial<T>): Promise<T> {
    const { id: _id, created_at: _c, ...rest } = patch as Row;
    void _id;
    void _c;
    const { data, error } = await this.db.from(table).update(rest).eq("id", id).select("*").maybeSingle();
    if (error) throw new Error(`${table}.update: ${error.message}`);
    if (!data) throw new NotFoundError(table, id);
    return data as T;
  }

  async remove(table: TableName, id: string): Promise<void> {
    const { error } = await this.db.from(table).delete().eq("id", id);
    if (error) throw new Error(`${table}.remove: ${error.message}`);
  }

  async count(table: TableName, query?: Query): Promise<number> {
    const { count, error } = await this.apply(this.db.from(table).select("id", { count: "exact", head: true }), {
      ...query,
      limit: undefined,
      order: undefined,
    });
    if (error) throw new Error(`${table}.count: ${error.message}`);
    return count ?? 0;
  }
}
