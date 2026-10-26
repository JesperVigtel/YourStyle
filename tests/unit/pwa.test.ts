import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

function pngSize(file: string) {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString()).toBe("PNG");
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

describe("web app manifest", () => {
  const m = manifest();
  it("is installable as a standalone app", () => {
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBe("/today");
    expect(m.display).toBe("standalone");
    expect(m.background_color).toMatch(/^#/);
    expect(m.theme_color).toMatch(/^#/);
  });
  it("has 192 and 512 icons (plus maskable) that exist at the declared sizes", () => {
    const icons = m.icons ?? [];
    expect(icons.some((i) => i.sizes === "192x192")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
    for (const icon of icons) {
      const file = path.join("public", icon.src);
      expect(existsSync(file), file).toBe(true);
      const [w, h] = icon.sizes!.split("x").map(Number);
      expect(pngSize(file)).toEqual({ width: w, height: h });
    }
    expect(pngSize("public/icons/apple-touch-icon.png")).toEqual({ width: 180, height: 180 });
  });
});

describe("service worker", () => {
  const sw = readFileSync("public/sw.js", "utf8");
  it("never caches writes and keeps the shop shell offline", () => {
    expect(sw).toContain('request.method !== "GET"');
    expect(sw).toContain('"/shop"');
    expect(sw).toContain('"/offline"');
  });
});
