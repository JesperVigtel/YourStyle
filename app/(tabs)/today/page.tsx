"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OutfitCard, type OutfitCardState } from "@/components/OutfitCard";
import {
  Button,
  Card,
  Chip,
  ChipRow,
  ErrorNote,
  Page,
  PageHeader,
  Skeleton,
  Spinner,
  inputClass,
} from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { api, errorMessage } from "@/lib/client/api";
import { todayLocal } from "@/lib/client/date";
import { useItems, useMoods } from "@/lib/client/hooks";
import { fetchWeather } from "@/lib/client/weather";
import { useStored } from "@/lib/client/useStored";
import { describeWeather } from "@/lib/domain/weather";
import { OCCASION_CHIPS, type Rating, type SuggestedOutfit, type WeatherSnapshot } from "@/lib/types";

type SuggestRes =
  | { needMoreItems: true; have: number; min: number }
  | {
      needMoreItems: false;
      outfits: SuggestedOutfit[];
      avoidedRecent: number;
      notice: string | null;
    };

const MOOD_KEY = "wardrobe:mood";

export default function TodayPage() {
  const { moods } = useMoods();
  const { items } = useItems();
  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);

  const [savedMood, setSavedMood] = useStored(MOOD_KEY);
  const mood = moods ? (moods.find((m) => m.name === savedMood)?.name ?? moods[0]?.name ?? null) : null;
  const [occasion, setOccasion] = useState("");
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherState, setWeatherState] = useState<"loading" | "ok" | "error">("loading");
  const [weatherSheet, setWeatherSheet] = useState(false);
  const [includeRecent, setIncludeRecent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuggestRes | null>(null);
  const [tookMs, setTookMs] = useState<number | null>(null);
  const [cards, setCards] = useState<Record<string, OutfitCardState>>({});

  useEffect(() => {
    fetchWeather()
      .then((w) => {
        setWeather(w);
        setWeatherState("ok");
      })
      .catch(() => setWeatherState("error"));
  }, []);

  const pickMood = (name: string) => setSavedMood(name);

  const suggest = async () => {
    if (!mood) return;
    setLoading(true);
    setError(null);
    const started = performance.now();
    try {
      const res = await api<SuggestRes>("/api/outfits/suggest", {
        method: "POST",
        json: {
          mood,
          occasion: occasion.trim() || null,
          weather,
          includeRecent,
          today: todayLocal(),
        },
      });
      setTookMs(performance.now() - started);
      setResult(res);
      setCards({});
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const patchCard = (id: string, p: OutfitCardState) => setCards((c) => ({ ...c, [id]: { ...c[id], ...p } }));

  const wear = async (o: SuggestedOutfit) => {
    patchCard(o.outfit_id, { busy: "wear" });
    try {
      await api("/api/wear", {
        method: "POST",
        json: { outfit_id: o.outfit_id, date: todayLocal() },
      });
      patchCard(o.outfit_id, { worn: true, busy: null });
    } catch (e) {
      patchCard(o.outfit_id, { busy: null });
      setError(errorMessage(e));
    }
  };

  const feedback = async (o: SuggestedOutfit, rating: Rating, reason_tags: string[], comment: string | null) => {
    patchCard(o.outfit_id, { busy: "feedback" });
    try {
      await api("/api/feedback", {
        method: "POST",
        json: { outfit_id: o.outfit_id, rating, reason_tags, comment },
      });
      patchCard(o.outfit_id, { rating, busy: null });
    } catch (e) {
      patchCard(o.outfit_id, { busy: null });
      setError(errorMessage(e));
    }
  };

  const replaceOutfit = (oldId: string, next: SuggestedOutfit) =>
    setResult((r) =>
      r && !r.needMoreItems
        ? {
            ...r,
            outfits: r.outfits.map((x) => (x.outfit_id === oldId ? next : x)),
          }
        : r,
    );

  const swap = async (o: SuggestedOutfit, itemId: string, withItemId?: string) => {
    patchCard(o.outfit_id, { busy: "swap" });
    try {
      const res = await api<{ outfit: SuggestedOutfit }>("/api/outfits/swap", {
        method: "POST",
        json: {
          outfit_id: o.outfit_id,
          replace_item_id: itemId,
          with_item_id: withItemId,
          today: todayLocal(),
          includeRecent,
        },
      });
      replaceOutfit(o.outfit_id, res.outfit);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      patchCard(o.outfit_id, { busy: null });
    }
  };

  /** Applies the alternative the AI offered with the suggestion (no extra AI call). */
  const applyHint = async (o: SuggestedOutfit) => {
    if (o.swap) await swap(o, o.swap.replace_item_id, o.swap.with_item_id);
  };

  return (
    <>
      <PageHeader
        title="Today"
        action={
          <Link href="/today/build" className="flex h-11 items-center text-sm font-medium text-accent">
            Build my own
          </Link>
        }
      />
      <Page>
        <ChipRow label="Mood">
          {moods
            ? moods.map((m) => (
                <Chip key={m.id} selected={mood === m.name} onClick={() => pickMood(m.name)}>
                  {m.name}
                </Chip>
              ))
            : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />)}
        </ChipRow>

        <div className="mt-3">
          <ChipRow label="Occasion">
            {OCCASION_CHIPS.map((o) => (
              <Chip key={o} selected={occasion === o} onClick={() => setOccasion(occasion === o ? "" : o)}>
                {o}
              </Chip>
            ))}
          </ChipRow>
          <input
            className={`${inputClass} mt-2`}
            placeholder="Occasion (optional) — e.g. job interview"
            aria-label="Occasion"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={() => setWeatherSheet(true)}
          className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm"
          aria-label="Weather"
        >
          <span>
            {weatherState === "loading" ? (
              <span className="text-muted">Getting the weather…</span>
            ) : weather ? (
              <>
                <span className="font-medium">{weather.temp_c !== null ? `${Math.round(weather.temp_c)}°C` : "?"}</span>{" "}
                <span className="text-muted">{describeWeather(weather).split(", ").slice(1).join(" · ")}</span>
              </>
            ) : (
              <span className="text-muted">Weather unavailable — tap to set</span>
            )}
          </span>
          <span className="text-accent">{weather?.overridden ? "edited" : "edit"}</span>
        </button>

        <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--accent)]"
            checked={includeRecent}
            onChange={(e) => setIncludeRecent(e.target.checked)}
          />
          Include items worn in the last 3 days
        </label>

        <Button variant="primary" size="lg" className="mt-3 w-full" onClick={suggest} disabled={!mood || loading}>
          {loading ? <Spinner /> : "Suggest outfits"}
        </Button>

        {error && (
          <div className="mt-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        {loading && (
          <div className="mt-4 space-y-4" aria-label="Loading suggestions">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-3xl border border-line bg-surface p-3">
                <Skeleton className="aspect-square w-full rounded-2xl" />
                <Skeleton className="mt-3 h-4 w-4/5" />
                <Skeleton className="mt-3 h-11 w-full" />
              </div>
            ))}
          </div>
        )}

        {!loading && result?.needMoreItems && (
          <Card className="mt-4">
            <h2 className="font-semibold">Add a few more items first</h2>
            <p className="mt-1 text-sm text-muted">
              You have {result.have} item{result.have === 1 ? "" : "s"} registered. Suggestions get good from about{" "}
              {result.min} — add {result.min - result.have} more and I&apos;ll start suggesting outfits.
            </p>
            <Link
              href="/wardrobe/add"
              className="mt-3 inline-flex h-11 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-ink"
            >
              Add items
            </Link>
          </Card>
        )}

        {!loading && result && !result.needMoreItems && (
          <div className="mt-4 space-y-4">
            {result.notice && <p className="text-sm text-muted">{result.notice}</p>}
            <p className="text-xs text-muted">
              {tookMs !== null && `${result.outfits.length} outfits in ${(tookMs / 1000).toFixed(1)} s. `}
              {result.avoidedRecent > 0 && `Skipping ${result.avoidedRecent} item(s) worn in the last 3 days.`}
            </p>
            {result.outfits.map((o, i) => {
              const its = o.item_ids.map((id) => byId.get(id)).filter((x) => !!x);
              const alt = o.swap ? byId.get(o.swap.with_item_id) : null;
              return (
                <OutfitCard
                  key={o.outfit_id}
                  index={i}
                  items={its}
                  rationale={o.rationale}
                  swapHint={
                    alt
                      ? {
                          label: `${alt.colors[0]?.name ?? ""} ${alt.subcategory ?? alt.category} — ${o.swap!.note}`,
                          onApply: () => applyHint(o),
                        }
                      : null
                  }
                  state={cards[o.outfit_id] ?? {}}
                  onWear={() => wear(o)}
                  onFeedback={(r, t, c) => feedback(o, r, t, c)}
                  onSwap={(id) => swap(o, id)}
                />
              );
            })}
          </div>
        )}
      </Page>

      <WeatherSheet
        open={weatherSheet}
        onClose={() => setWeatherSheet(false)}
        weather={weather}
        onSave={(w) => {
          setWeather(w);
          setWeatherState("ok");
          setWeatherSheet(false);
        }}
      />
    </>
  );
}

function WeatherSheet({
  open,
  onClose,
  weather,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  weather: WeatherSnapshot | null;
  onSave: (w: WeatherSnapshot) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Weather">
      <WeatherForm weather={weather} onSave={onSave} />
    </Sheet>
  );
}

/** Mounted fresh each time the sheet opens, so it starts from the current weather. */
function WeatherForm({ weather, onSave }: { weather: WeatherSnapshot | null; onSave: (w: WeatherSnapshot) => void }) {
  const [temp, setTemp] = useState(weather?.temp_c != null ? String(Math.round(weather.temp_c)) : "");
  const [rain, setRain] = useState((weather?.rain_chance ?? 0) >= 50);
  const [windy, setWindy] = useState((weather?.wind_kmh ?? 0) >= 30);
  return (
    <>
      <label className="block text-sm">
        Temperature (°C)
        <input
          className={`${inputClass} mt-1`}
          inputMode="numeric"
          value={temp}
          onChange={(e) => setTemp(e.target.value)}
          aria-label="Temperature"
        />
      </label>
      <div className="mt-3 flex gap-2">
        <Chip selected={rain} onClick={() => setRain(!rain)}>
          Rain
        </Chip>
        <Chip selected={windy} onClick={() => setWindy(!windy)}>
          Windy
        </Chip>
      </div>
      <Button
        variant="primary"
        size="lg"
        className="mt-4 w-full"
        onClick={() => {
          const t = parseFloat(temp.replace(",", "."));
          onSave({
            temp_c: Number.isFinite(t) ? t : null,
            rain_chance: rain ? 80 : 0,
            wind_kmh: windy ? 35 : 5,
            description: [rain && "rain", windy && "windy"].filter(Boolean).join(", ") || null,
            overridden: true,
          });
        }}
      >
        Use this weather
      </Button>
    </>
  );
}
