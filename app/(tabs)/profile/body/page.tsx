"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Button, ErrorNote, Field, Page, PageHeader, SectionTitle, Spinner, inputClass } from "@/components/ui";
import { api, errorMessage, fetcher } from "@/lib/client/api";
import type { BodyProfile } from "@/lib/types";

const MEASUREMENTS = ["chest", "waist", "hips", "inseam", "shoulder", "sleeve", "neck"] as const;

type Form = {
  height_cm: string;
  weight_kg: string;
  measurements: Record<string, string>;
  shape_notes: string;
  fit_preferences: string;
  style_goals: string;
};

const num = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const toForm = (b: BodyProfile | null): Form => ({
  height_cm: b?.height_cm ? String(b.height_cm) : "",
  weight_kg: b?.weight_kg ? String(b.weight_kg) : "",
  measurements: Object.fromEntries(MEASUREMENTS.map((m) => [m, b?.measurements?.[m] ? String(b.measurements[m]) : ""])),
  shape_notes: b?.shape_notes ?? "",
  fit_preferences: b?.fit_preferences ?? "",
  style_goals: b?.style_goals ?? "",
});

export default function BodyPage() {
  const { data } = useSWR<{ body: BodyProfile | null }>("/api/body-profile", fetcher);
  return (
    <>
      <PageHeader title="Body & fit" back="/profile" />
      <Page>
        <p className="text-sm text-muted">
          Everything is optional. It&apos;s used for fit predictions in Shop mode and to tailor suggestions.
        </p>
        {data && <BodyForm initial={toForm(data.body)} />}
      </Page>
    </>
  );
}

function BodyForm({ initial }: { initial: Form }) {
  const [form, setForm] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (p: Partial<Form>) => {
    setSaved(false);
    setForm((f) => ({ ...f, ...p }));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/body-profile", {
        method: "PUT",
        json: {
          height_cm: num(form.height_cm),
          weight_kg: num(form.weight_kg),
          measurements: Object.fromEntries(Object.entries(form.measurements).map(([k, v]) => [k, num(v)])),
          shape_notes: form.shape_notes.trim() || null,
          fit_preferences: form.fit_preferences.trim() || null,
          style_goals: form.style_goals.trim() || null,
        },
      });
      setSaved(true);
      mutate("/api/body-profile");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Height (cm)">
          <input
            className={inputClass}
            inputMode="decimal"
            value={form.height_cm}
            onChange={(e) => set({ height_cm: e.target.value })}
          />
        </Field>
        <Field label="Weight (kg)">
          <input
            className={inputClass}
            inputMode="decimal"
            value={form.weight_kg}
            onChange={(e) => set({ weight_kg: e.target.value })}
          />
        </Field>
      </div>
      <SectionTitle>Measurements (cm)</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        {MEASUREMENTS.map((m) => (
          <Field key={m} label={m}>
            <input
              className={inputClass}
              inputMode="decimal"
              value={form.measurements[m]}
              onChange={(e) =>
                set({
                  measurements: { ...form.measurements, [m]: e.target.value },
                })
              }
            />
          </Field>
        ))}
      </div>
      <Field label="Fit preferences">
        <textarea
          className={`${inputClass} h-20 py-2`}
          placeholder="e.g. slim but not skinny trousers, relaxed tees"
          value={form.fit_preferences}
          onChange={(e) => set({ fit_preferences: e.target.value })}
        />
      </Field>
      <Field label="Style goals">
        <textarea
          className={`${inputClass} h-20 py-2`}
          placeholder="e.g. more colour, fewer but better pieces"
          value={form.style_goals}
          onChange={(e) => set({ style_goals: e.target.value })}
        />
      </Field>
      <Field label="Shape notes">
        <textarea
          className={`${inputClass} h-20 py-2`}
          value={form.shape_notes}
          onChange={(e) => set({ shape_notes: e.target.value })}
        />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button variant="primary" size="lg" className="w-full" onClick={save} disabled={busy}>
        {busy ? <Spinner /> : saved ? "Saved ✓" : "Save"}
      </Button>
    </div>
  );
}
