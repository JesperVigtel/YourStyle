// Renders the app icons (hanger on a rust background) to PNG with the preinstalled Chromium.
// Usage: node scripts/gen-icons.mjs
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });

const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#b4532a"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">
    <g fill="none" stroke="#fbf3ee" stroke-width="30" stroke-linecap="round" stroke-linejoin="round">
      <path d="M256 170a40 40 0 1 1 40-40"/>
      <path d="M256 170v26L84 322a22 22 0 0 0 13 40h318a22 22 0 0 0 13-40L256 196"/>
    </g>
  </g>
</svg>`;

const targets = [
  { file: "icon-192.png", size: 192, pad: 40 },
  { file: "icon-512.png", size: 512, pad: 40 },
  { file: "icon-maskable-512.png", size: 512, pad: 110 },
  { file: "apple-touch-icon.png", size: 180, pad: 40 },
  { file: "favicon-32.png", size: 32, pad: 20 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0">${svg(t.pad).replace("<svg ", `<svg width="${t.size}" height="${t.size}" `)}</body></html>`,
  );
  await page.screenshot({ path: `${OUT}/${t.file}`, omitBackground: false });
  console.log("wrote", t.file);
}
await browser.close();
