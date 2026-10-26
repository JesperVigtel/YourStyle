import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface BlobStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}

export const BUCKET = "wardrobe";

/** Local folder store for development and tests. */
export class LocalBlobStore implements BlobStore {
  constructor(private dir: string) {}

  private resolve(key: string) {
    const p = path.resolve(this.dir, key);
    if (!p.startsWith(path.resolve(this.dir) + path.sep)) throw new Error("Invalid storage key");
    return p;
  }

  async put(key: string, bytes: Uint8Array, contentType: string) {
    const p = this.resolve(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, bytes);
    await fs.writeFile(`${p}.type`, contentType);
  }

  async get(key: string) {
    const p = this.resolve(key);
    try {
      const [bytes, contentType] = await Promise.all([fs.readFile(p), fs.readFile(`${p}.type`, "utf8")]);
      return { bytes: new Uint8Array(bytes), contentType };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
}

/**
 * Supabase Storage, private bucket. Objects live under `<user_id>/<key>`, which is what the
 * storage RLS policies in the migration check.
 */
export class SupabaseBlobStore implements BlobStore {
  constructor(
    private db: SupabaseClient,
    private userId: string,
  ) {}

  async put(key: string, bytes: Uint8Array, contentType: string) {
    const { error } = await this.db.storage
      .from(BUCKET)
      .upload(`${this.userId}/${key}`, bytes, { contentType, upsert: true });
    if (error) throw new Error(`storage.put: ${error.message}`);
  }

  async get(key: string) {
    const { data, error } = await this.db.storage.from(BUCKET).download(`${this.userId}/${key}`);
    if (error || !data) return null;
    return {
      bytes: new Uint8Array(await data.arrayBuffer()),
      contentType: data.type || "image/jpeg",
    };
  }
}

/** Storage keys are referenced from the client as /api/img/<key>. */
export function imageUrl(key: string) {
  return `/api/img/${key}`;
}

export function keyFromImageUrl(url: string): string | null {
  return url.startsWith("/api/img/") ? url.slice("/api/img/".length) : null;
}
