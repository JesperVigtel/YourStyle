import type { ContentBlock } from "../provider";

export type ImageInput = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
};

export function imageBlocks(images: ImageInput[]): ContentBlock[] {
  return images.map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: img.mediaType,
      data: img.base64,
    },
  }));
}

/** Small stable hash, used by mocks to pick a fixture deterministically. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += Math.max(1, Math.floor(s.length / 512))) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
