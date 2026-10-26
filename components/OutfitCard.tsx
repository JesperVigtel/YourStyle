"use client";

import { useState } from "react";
import clsx from "clsx";
import { Collage, type CollageItem } from "./Collage";
import { Button, Chip, Spinner } from "./ui";
import { Sheet } from "./Sheet";
import { REASON_TAGS_NEGATIVE, REASON_TAGS_POSITIVE, type Rating } from "@/lib/types";

export type OutfitCardState = {
  worn?: boolean;
  rating?: Rating;
  busy?: "wear" | "swap" | "feedback" | null;
};

export function OutfitCard({
  index,
  items,
  rationale,
  swapHint,
  state,
  onWear,
  onFeedback,
  onSwap,
}: {
  index: number;
  items: CollageItem[];
  rationale: string;
  swapHint?: { label: string; onApply: () => void } | null;
  state: OutfitCardState;
  onWear: () => void;
  onFeedback: (rating: Rating, tags: string[], comment: string | null) => Promise<void>;
  onSwap?: (itemId: string) => void;
}) {
  const [swapMode, setSwapMode] = useState(false);
  const [sheet, setSheet] = useState<Rating | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  const openSheet = (r: Rating) => {
    setTags([]);
    setComment("");
    setSheet(r);
  };
  const submit = async () => {
    if (sheet === null) return;
    await onFeedback(sheet, tags, comment.trim() || null);
    setSheet(null);
  };
  const reasons = sheet === 1 ? REASON_TAGS_POSITIVE : REASON_TAGS_NEGATIVE;

  return (
    <article
      className="rounded-3xl border border-line bg-surface p-3"
      aria-label={`Outfit ${index + 1}`}
      data-testid="outfit-card"
    >
      <Collage
        items={items}
        onItemClick={
          swapMode && onSwap
            ? (id) => {
                setSwapMode(false);
                onSwap(id);
              }
            : undefined
        }
      />
      {swapMode && <p className="mt-2 text-center text-sm text-accent">Tap the item you want to swap</p>}
      <p className="mt-3 px-1 text-[15px] leading-snug">{rationale}</p>
      {swapHint && (
        <button
          type="button"
          onClick={swapHint.onApply}
          className="mt-1 min-h-11 px-1 text-left text-sm text-muted underline decoration-dotted"
        >
          Alternative: {swapHint.label}
        </button>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Button
          variant={state.worn ? "secondary" : "primary"}
          className="flex-1"
          onClick={onWear}
          disabled={state.worn || state.busy === "wear"}
        >
          {state.busy === "wear" ? <Spinner /> : state.worn ? "✓ Logged for today" : "Wear this"}
        </Button>
        <button
          type="button"
          aria-label="Like"
          aria-pressed={state.rating === 1}
          onClick={() => openSheet(1)}
          className={clsx(
            "h-11 w-11 rounded-xl border text-lg",
            state.rating === 1 ? "border-good bg-good-soft" : "border-line",
          )}
        >
          👍
        </button>
        <button
          type="button"
          aria-label="Dislike"
          aria-pressed={state.rating === -1}
          onClick={() => openSheet(-1)}
          className={clsx(
            "h-11 w-11 rounded-xl border text-lg",
            state.rating === -1 ? "border-bad bg-bad-soft" : "border-line",
          )}
        >
          👎
        </button>
        {onSwap && (
          <button
            type="button"
            aria-label="Swap one item"
            aria-pressed={swapMode}
            onClick={() => setSwapMode((s) => !s)}
            disabled={state.busy === "swap"}
            className={clsx(
              "flex h-11 w-11 items-center justify-center rounded-xl border",
              swapMode ? "border-accent text-accent" : "border-line",
            )}
          >
            {state.busy === "swap" ? (
              <Spinner />
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                <path d="M7 7h11l-3-3M17 17H6l3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}
      </div>

      <Sheet open={sheet !== null} onClose={() => setSheet(null)} title={sheet === 1 ? "What works?" : "What's off?"}>
        <div className="flex flex-wrap gap-2">
          {reasons.map((t) => (
            <Chip
              key={t}
              selected={tags.includes(t)}
              onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}
            >
              {t}
            </Chip>
          ))}
        </div>
        <textarea
          aria-label="Comment"
          placeholder="Anything else? (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-3 h-20 w-full rounded-xl border border-line bg-surface p-3"
        />
        <Button
          variant="primary"
          size="lg"
          className="mt-3 w-full"
          onClick={submit}
          disabled={state.busy === "feedback"}
        >
          {state.busy === "feedback" ? <Spinner /> : "Save feedback"}
        </Button>
      </Sheet>
    </article>
  );
}
