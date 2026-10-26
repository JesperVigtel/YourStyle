import { describe, expect, it, vi } from "vitest";
import { removeBackgroundSafe, withTimeout } from "@/lib/client/bgRemoval";

describe("background removal falls back to the original photo", () => {
  const photo = new Blob(["photo"], { type: "image/jpeg" });

  it("returns the cutout when removal works", async () => {
    const cut = new Blob(["png"], { type: "image/png" });
    await expect(removeBackgroundSafe(photo, { remove: async () => cut })).resolves.toBe(cut);
  });

  it("returns null (keep the photo) when removal throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      removeBackgroundSafe(photo, { remove: async () => Promise.reject(new Error("wasm failed")) }),
    ).resolves.toBeNull();
    warn.mockRestore();
  });

  it("returns null when removal is too slow", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const never = () => new Promise<Blob>(() => {});
    await expect(removeBackgroundSafe(photo, { remove: never, timeoutMs: 20 })).resolves.toBeNull();
    warn.mockRestore();
  });

  it("returns null for an empty result", async () => {
    await expect(removeBackgroundSafe(photo, { remove: async () => new Blob([]) })).resolves.toBeNull();
  });

  it("withTimeout passes values and errors through", async () => {
    await expect(withTimeout(Promise.resolve(1), 50)).resolves.toBe(1);
    await expect(withTimeout(Promise.reject(new Error("x")), 50)).rejects.toThrow("x");
  });
});
