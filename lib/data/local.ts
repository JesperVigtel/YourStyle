import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { applyQuery, DEFAULTS, NotFoundError, type Query, type Repo, type Row, type TableName } from "./repo";

type Db = Partial<Record<TableName, Row[]>>;

// Route handlers can be bundled into separate module instances, so the write lock lives on
// globalThis and the file is re-read on every operation (the dataset is tiny).
const g = globalThis as unknown as { __localRepoLock?: Promise<unknown> };

/** JSON-file repository for local development and tests. Not used in production. */
export class LocalRepo implements Repo {
  private file: string;

  constructor(dir: string) {
    this.file = path.join(dir, "db.json");
  }

  private async read(): Promise<Db> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8")) as Db;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw e;
    }
  }

  private async write(db: Db): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db));
    await fs.rename(tmp, this.file);
  }

  private mutate<R>(fn: (db: Db) => R | Promise<R>): Promise<R> {
    const run = async () => {
      const db = await this.read();
      const result = await fn(db);
      await this.write(db);
      return result;
    };
    const next = (g.__localRepoLock ?? Promise.resolve()).then(run, run);
    g.__localRepoLock = next.catch(() => undefined);
    return next;
  }

  async list<T extends Row>(table: TableName, query?: Query): Promise<T[]> {
    const db = await this.read();
    return structuredClone(applyQuery((db[table] ?? []) as T[], query));
  }

  async get<T extends Row>(table: TableName, id: string): Promise<T | null> {
    const db = await this.read();
    const row = (db[table] ?? []).find((r) => r.id === id);
    return row ? (structuredClone(row) as T) : null;
  }

  insert<T extends Row>(table: TableName, row: Partial<T>): Promise<T> {
    return this.mutate((db) => {
      const full = {
        ...structuredClone(DEFAULTS[table]),
        ...row,
        id: row.id ?? randomUUID(),
        created_at: row.created_at ?? new Date().toISOString(),
      } as unknown as T;
      (db[table] ??= []).push(full);
      return structuredClone(full);
    });
  }

  update<T extends Row>(table: TableName, id: string, patch: Partial<T>): Promise<T> {
    return this.mutate((db) => {
      const rows = db[table] ?? [];
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) throw new NotFoundError(table, id);
      // id and created_at are immutable
      const { id: _id, created_at: _c, ...rest } = patch as Row;
      void _id;
      void _c;
      rows[i] = { ...rows[i], ...rest };
      return structuredClone(rows[i]) as T;
    });
  }

  remove(table: TableName, id: string): Promise<void> {
    return this.mutate((db) => {
      db[table] = (db[table] ?? []).filter((r) => r.id !== id);
    });
  }

  async count(table: TableName, query?: Query): Promise<number> {
    const db = await this.read();
    return applyQuery(db[table] ?? [], { ...query, limit: undefined }).length;
  }
}
