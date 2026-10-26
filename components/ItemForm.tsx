"use client";

import clsx from "clsx";
import {
  CATEGORIES,
  FIT_VERDICTS,
  ITEM_STATUSES,
  LOW_CONFIDENCE,
  SEASONS,
  SOURCES,
  type Item,
  type TaggedField,
} from "@/lib/types";
import { Chip, Field, inputClass } from "./ui";

export type ItemDraft = Pick<
  Item,
  | "status"
  | "category"
  | "subcategory"
  | "colors"
  | "pattern"
  | "material"
  | "formality"
  | "warmth"
  | "seasons"
  | "brand"
  | "size_label"
  | "fit_verdict"
  | "fit_notes"
  | "is_reference"
  | "price"
  | "currency"
  | "acquired_date"
  | "source"
  | "notes"
>;

export const EMPTY_DRAFT: ItemDraft = {
  status: "owned",
  category: "top",
  subcategory: null,
  colors: [],
  pattern: null,
  material: null,
  formality: null,
  warmth: null,
  seasons: [],
  brand: null,
  size_label: null,
  fit_verdict: null,
  fit_notes: null,
  is_reference: false,
  price: null,
  currency: "EUR",
  acquired_date: null,
  source: null,
  notes: null,
};

export function draftFrom(item: Partial<Item>): ItemDraft {
  const d = { ...EMPTY_DRAFT };
  for (const k of Object.keys(EMPTY_DRAFT) as (keyof ItemDraft)[]) {
    if (item[k] !== undefined) (d as Record<string, unknown>)[k] = item[k];
  }
  return d;
}

const text = (v: string) => (v.trim() === "" ? null : v);

function Scale({ value, onChange, label }: { value: number | null; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(n)}
          className={clsx(
            "h-11 flex-1 rounded-xl border text-sm font-medium",
            value === n ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function ItemForm({
  value,
  onChange,
  confidence,
  compact,
}: {
  value: ItemDraft;
  onChange: (next: ItemDraft) => void;
  confidence?: Partial<Record<TaggedField, number>> | null;
  /** Hide purchase/fit details (e.g. during fast capture). They stay editable on the item page. */
  compact?: boolean;
}) {
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => onChange({ ...value, [k]: v });
  const low = (f: TaggedField) => confidence?.[f] !== undefined && confidence[f]! < LOW_CONFIDENCE;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" warn={low("category")}>
          <select
            className={inputClass}
            value={value.category}
            onChange={(e) => set("category", e.target.value as ItemDraft["category"])}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Type" warn={low("subcategory")}>
          <input
            className={inputClass}
            value={value.subcategory ?? ""}
            placeholder="e.g. chinos"
            onChange={(e) => set("subcategory", text(e.target.value))}
          />
        </Field>
      </div>

      <Field label="Colours" warn={low("colors")}>
        <div className="flex flex-wrap items-center gap-2">
          {value.colors.map((c, i) => (
            <span
              key={i}
              className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface pr-1 pl-1.5 text-sm"
            >
              <input
                type="color"
                aria-label={`Colour ${i + 1}`}
                value={c.hex}
                onChange={(e) =>
                  set(
                    "colors",
                    value.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)),
                  )
                }
                className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
              <input
                aria-label={`Colour ${i + 1} name`}
                value={c.name}
                onChange={(e) =>
                  set(
                    "colors",
                    value.colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                  )
                }
                className="w-24 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                aria-label="Remove colour"
                className="h-7 w-7 rounded-full text-muted"
                onClick={() =>
                  set(
                    "colors",
                    value.colors.filter((_, j) => j !== i),
                  )
                }
              >
                ×
              </button>
            </span>
          ))}
          {value.colors.length < 3 && (
            <button
              type="button"
              className="h-9 rounded-full border border-dashed border-line px-3 text-sm text-muted"
              onClick={() =>
                set("colors", [
                  ...value.colors,
                  {
                    name: "colour",
                    hex: "#888888",
                    role: value.colors.length ? "secondary" : "primary",
                  },
                ])
              }
            >
              + colour
            </button>
          )}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Pattern" warn={low("pattern")}>
          <input
            className={inputClass}
            value={value.pattern ?? ""}
            placeholder="solid"
            onChange={(e) => set("pattern", text(e.target.value))}
          />
        </Field>
        <Field label="Material" warn={low("material")}>
          <input
            className={inputClass}
            value={value.material ?? ""}
            placeholder="cotton"
            onChange={(e) => set("material", text(e.target.value))}
          />
        </Field>
      </div>

      <Field label="Formality (1 lounge – 5 formal)" warn={low("formality")}>
        <Scale label="Formality" value={value.formality} onChange={(v) => set("formality", v)} />
      </Field>
      <Field label="Warmth (1 light – 5 heavy)" warn={low("warmth")}>
        <Scale label="Warmth" value={value.warmth} onChange={(v) => set("warmth", v)} />
      </Field>

      <Field label="Seasons" warn={low("seasons")}>
        <div className="flex flex-wrap gap-2">
          {SEASONS.map((s) => (
            <Chip
              key={s}
              selected={value.seasons.includes(s)}
              onClick={() =>
                set("seasons", value.seasons.includes(s) ? value.seasons.filter((x) => x !== s) : [...value.seasons, s])
              }
            >
              {s}
            </Chip>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Brand" warn={low("brand")}>
          <input
            className={inputClass}
            value={value.brand ?? ""}
            onChange={(e) => set("brand", text(e.target.value))}
          />
        </Field>
        <Field label="Size" warn={low("size_label")}>
          <input
            className={inputClass}
            value={value.size_label ?? ""}
            onChange={(e) => set("size_label", text(e.target.value))}
          />
        </Field>
      </div>

      {!compact && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                className={inputClass}
                value={value.status}
                onChange={(e) => set("status", e.target.value as ItemDraft["status"])}
              >
                {ITEM_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Fit">
              <select
                className={inputClass}
                value={value.fit_verdict ?? ""}
                onChange={(e) => set("fit_verdict", (e.target.value || null) as ItemDraft["fit_verdict"])}
              >
                <option value="">—</option>
                {FIT_VERDICTS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface px-3 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--accent)]"
              checked={value.is_reference}
              onChange={(e) => set("is_reference", e.target.checked)}
            />
            Reference garment — this fits perfectly
          </label>
          <Field label="Fit notes">
            <input
              className={inputClass}
              value={value.fit_notes ?? ""}
              placeholder="e.g. tight in the shoulders"
              onChange={(e) => set("fit_notes", text(e.target.value))}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Price">
              <input
                className={inputClass}
                inputMode="decimal"
                value={value.price ?? ""}
                onChange={(e) => {
                  const n = parseFloat(e.target.value.replace(",", "."));
                  set("price", Number.isFinite(n) ? n : null);
                }}
              />
            </Field>
            <Field label="Currency">
              <input
                className={inputClass}
                value={value.currency ?? ""}
                onChange={(e) => set("currency", text(e.target.value.toUpperCase()))}
              />
            </Field>
            <Field label="Source">
              <select
                className={inputClass}
                value={value.source ?? ""}
                onChange={(e) => set("source", (e.target.value || null) as ItemDraft["source"])}
              >
                <option value="">—</option>
                {SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Acquired">
            <input
              type="date"
              className={inputClass}
              value={value.acquired_date ?? ""}
              onChange={(e) => set("acquired_date", text(e.target.value))}
            />
          </Field>
          <Field label="Notes">
            <textarea
              className={clsx(inputClass, "h-20 py-2")}
              value={value.notes ?? ""}
              onChange={(e) => set("notes", text(e.target.value))}
            />
          </Field>
        </>
      )}
    </div>
  );
}
