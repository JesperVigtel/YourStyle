import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { afterAll, describe, expect, it } from "vitest";
import { LocalRepo } from "@/lib/data/local";
import { applyQuery, NotFoundError, type Row } from "@/lib/data/repo";
import type { Item } from "@/lib/types";

const dir = mkdtempSync(path.join(tmpdir(), "wardrobe-repo-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

type ItemRow = Item & Row;

describe("LocalRepo", () => {
  const repo = new LocalRepo(dir);

  it("inserts with defaults, id and created_at", async () => {
    const it = await repo.insert<ItemRow>("items", { category: "shoes" });
    expect(it.id).toMatch(/[0-9a-f-]{36}/);
    expect(it.created_at).toBeTruthy();
    expect(it.status).toBe("owned");
    expect(it.seasons).toEqual([]);
    expect(await repo.get<ItemRow>("items", it.id)).toEqual(it);
  });

  it("updates without touching id/created_at, and throws NotFound", async () => {
    const it = await repo.insert<ItemRow>("items", { category: "top" });
    const up = await repo.update<ItemRow>("items", it.id, { brand: "COS", id: "hacked", created_at: "x" } as Partial<ItemRow>);
    expect(up).toMatchObject({ id: it.id, created_at: it.created_at, brand: "COS" });
    await expect(repo.update("items", "missing", {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lists with filters, order, limit; counts; removes", async () => {
    const r = new LocalRepo(path.join(dir, "q"));
    await r.insert("wear_log", { date: "2026-10-01", item_ids: ["a"] });
    await r.insert("wear_log", { date: "2026-10-05", item_ids: ["b"] });
    const w = await r.insert("wear_log", { date: "2026-10-03", item_ids: ["c"] });
    const list = await r.list<Row & { date: string }>("wear_log", { gte: { date: "2026-10-02" }, order: { column: "date", ascending: false } });
    expect(list.map((x) => x.date)).toEqual(["2026-10-05", "2026-10-03"]);
    expect(await r.count("wear_log", { gt: { date: "2026-10-01" } })).toBe(2);
    await r.remove("wear_log", w.id);
    expect(await r.count("wear_log")).toBe(2);
  });

  it("does not lose writes under concurrency", async () => {
    const r = new LocalRepo(path.join(dir, "c"));
    await Promise.all(Array.from({ length: 25 }, (_, i) => r.insert("feedback", { rating: 1, comment: `#${i}` })));
    expect(await r.count("feedback")).toBe(25);
  });

  it("returns copies, not shared references", async () => {
    const it = await repo.insert<ItemRow>("items", { category: "bag", seasons: ["summer"] });
    it.seasons.push("winter");
    expect((await repo.get<ItemRow>("items", it.id))!.seasons).toEqual(["summer"]);
  });
});

describe("applyQuery", () => {
  const rows = [
    { id: "1", n: 3, s: "x", z: null },
    { id: "2", n: 1, s: "y", z: null },
    { id: "3", n: 2, s: "x", z: "v" },
  ];
  it("supports eq (incl. null), in, ordering and limit", () => {
    expect(applyQuery(rows, { eq: { s: "x" } }).map((r) => r.id)).toEqual(["1", "3"]);
    expect(applyQuery(rows, { eq: { z: null } }).map((r) => r.id)).toEqual(["1", "2"]);
    expect(applyQuery(rows, { in: { column: "id", values: ["2", "3"] } }).length).toBe(2);
    expect(applyQuery(rows, { order: { column: "n" }, limit: 2 }).map((r) => r.n)).toEqual([1, 2]);
  });
});
