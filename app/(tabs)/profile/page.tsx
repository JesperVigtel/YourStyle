"use client";

import Link from "next/link";
import { useState } from "react";
import { mutate } from "swr";
import {
  Button,
  Card,
  ErrorNote,
  Page,
  PageHeader,
  SectionTitle,
  Skeleton,
  Spinner,
  inputClass,
} from "@/components/ui";
import { api, errorMessage } from "@/lib/client/api";
import { formatDate } from "@/lib/client/date";
import { useStyleProfile } from "@/lib/client/hooks";
import type { ProfileEntry, StyleProfile } from "@/lib/types";

type Editable = { text: string; source: "ai" | "user" };

function EntryList({
  label,
  entries,
  onChange,
}: {
  label: string;
  entries: Editable[];
  onChange: (e: Editable[]) => void;
}) {
  return (
    <div>
      <SectionTitle>{label}</SectionTitle>
      <ul className="space-y-2" aria-label={label}>
        {entries.map((e, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              className={inputClass}
              value={e.text}
              aria-label={`${label} ${i + 1}`}
              onChange={(ev) =>
                onChange(entries.map((x, j) => (j === i ? { text: ev.target.value, source: "user" } : x)))
              }
            />
            {e.source === "user" && <span className="shrink-0 text-[11px] text-accent">mine</span>}
            <button
              type="button"
              aria-label="Remove"
              className="h-11 w-11 shrink-0 text-muted"
              onClick={() => onChange(entries.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-2 h-11 text-sm font-medium text-accent"
        onClick={() => onChange([...entries, { text: "", source: "user" }])}
      >
        + Add
      </button>
    </div>
  );
}

const visible = (es: ProfileEntry[] | undefined): Editable[] =>
  (es ?? []).filter((e) => !e.removed).map((e) => ({ text: e.text, source: e.source }));

export default function ProfilePage() {
  const { profile, isLoading } = useStyleProfile();
  return (
    <>
      <PageHeader title="Profile" />
      <Page>
        <nav className="grid grid-cols-2 gap-2" aria-label="Profile sections">
          {[
            ["/profile/body", "Body & fit"],
            ["/profile/moods", "Moods"],
            ["/profile/history", "Outfit history"],
            ["/profile/settings", "Settings & AI cost"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="flex h-12 items-center justify-center rounded-xl border border-line bg-surface text-sm font-medium"
            >
              {label}
            </Link>
          ))}
        </nav>
        {isLoading ? (
          <Skeleton className="mt-6 h-32 w-full" />
        ) : (
          <ProfileEditor key={profile?.id ?? "none"} profile={profile ?? null} />
        )}
      </Page>
    </>
  );
}

/** Keyed by profile version, so it re-initialises after a save or regeneration. */
function ProfileEditor({ profile }: { profile: StyleProfile | null }) {
  const [summary, setSummary] = useState(profile?.summary ?? "");
  const [hard, setHard] = useState<Editable[]>(visible(profile?.hard_rules));
  const [soft, setSoft] = useState<Editable[]>(visible(profile?.soft_preferences));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "regen" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setDirty(true);
    };

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      await api("/api/style-profile", {
        method: "PUT",
        json: {
          summary,
          hard_rules: hard.filter((e) => e.text.trim()),
          soft_preferences: soft.filter((e) => e.text.trim()),
        },
      });
      await mutate("/api/style-profile");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };

  const regenerate = async () => {
    setBusy("regen");
    setError(null);
    try {
      await api("/api/style-profile/regenerate", { method: "POST" });
      await mutate("/api/style-profile");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-base font-semibold">Style profile</h2>
        <Button onClick={regenerate} disabled={!!busy}>
          {busy === "regen" ? <Spinner /> : "Regenerate"}
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Learned from your feedback; updates every ~10 ratings. Your edits are always kept.
        {profile && <> Last updated {formatDate(profile.created_at)}.</>}
      </p>
      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      {!profile && (
        <Card className="mt-4 text-sm text-muted">
          No profile yet. Rate a few outfits on the Today tab, or write your own rules below.
        </Card>
      )}
      <SectionTitle>Summary</SectionTitle>
      <textarea
        aria-label="Summary"
        className={`${inputClass} h-32 py-2`}
        value={summary}
        placeholder="How would you describe your style?"
        onChange={(e) => edit(setSummary)(e.target.value)}
      />
      <EntryList label="Hard rules" entries={hard} onChange={edit(setHard)} />
      <EntryList label="Soft preferences" entries={soft} onChange={edit(setSoft)} />
      {profile?.diff && (
        <p className="mt-4 rounded-xl bg-surface-2 p-3 text-xs text-muted">
          <strong>Last change:</strong> {profile.diff}
        </p>
      )}
      {dirty && (
        <div className="bottom-tabbar sticky mt-4 bg-bg/95 py-2 backdrop-blur">
          <Button variant="primary" size="lg" className="w-full" onClick={save} disabled={!!busy}>
            {busy === "save" ? <Spinner /> : "Save profile"}
          </Button>
        </div>
      )}
    </>
  );
}
