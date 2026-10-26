"use client";

import { useState } from "react";
import { mutate } from "swr";
import { Button, ErrorNote, Page, PageHeader, Spinner, inputClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";
import { useMoods } from "@/lib/client/hooks";
import type { Mood } from "@/lib/types";

type M = { id?: string; name: string; description: string };

export default function MoodsPage() {
  const { moods } = useMoods();
  return (
    <>
      <PageHeader title="Moods" back="/profile" />
      <Page>
        <p className="text-sm text-muted">The description tells the AI what each mood means to you.</p>
        {moods && <MoodsEditor moods={moods} />}
      </Page>
    </>
  );
}

function MoodsEditor({ moods }: { moods: Mood[] }) {
  const [list, setList] = useState<M[]>(() => moods.map(({ id, name, description }) => ({ id, name, description })));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, p: Partial<M>) => {
    setSaved(false);
    setList((l) => l.map((m, j) => (j === i ? { ...m, ...p } : m)));
  };
  const move = (i: number, d: -1 | 1) =>
    setList((l) => {
      const next = [...l];
      const j = i + d;
      if (j < 0 || j >= next.length) return next;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ moods: Mood[] }>("/api/moods", {
        method: "PUT",
        json: { moods: list.filter((m) => m.name.trim()) },
      });
      // Keep editing the saved list (new moods now have ids) and refresh the shared cache.
      setList(res.moods.map(({ id, name, description }) => ({ id, name, description })));
      setSaved(true);
      await mutate("/api/moods", res, { revalidate: false });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ul className="mt-4 space-y-3">
        {list.map((m, i) => (
          <li key={m.id ?? `new-${i}`} className="rounded-2xl border border-line bg-surface p-3">
            <div className="flex gap-2">
              <input
                className={inputClass}
                aria-label="Mood name"
                value={m.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <button type="button" aria-label="Move up" className="h-11 w-9 text-muted" onClick={() => move(i, -1)}>
                ↑
              </button>
              <button type="button" aria-label="Move down" className="h-11 w-9 text-muted" onClick={() => move(i, 1)}>
                ↓
              </button>
              <button
                type="button"
                aria-label="Remove mood"
                className="h-11 w-9 text-muted"
                onClick={() => setList((l) => l.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
            <textarea
              className={`${inputClass} mt-2 h-16 py-2`}
              aria-label="Mood description"
              value={m.description}
              onChange={(e) => update(i, { description: e.target.value })}
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-3 h-11 text-sm font-medium text-accent"
        onClick={() => setList((l) => [...l, { name: "", description: "" }])}
      >
        + Add mood
      </button>
      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      <Button variant="primary" size="lg" className="mt-4 w-full" onClick={save} disabled={busy}>
        {busy ? <Spinner /> : saved ? "Saved ✓" : "Save moods"}
      </Button>
    </>
  );
}
