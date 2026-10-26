// Renders fixture "photos" for tests (garments, labels, price tag, web-shop screenshot) as JPEGs.
// Usage: node scripts/gen-fixtures.mjs
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "e2e/fixtures";
mkdirSync(OUT, { recursive: true });

const shirt = (fill) =>
  `<path d="M120 70 L170 50 Q200 80 230 50 L280 70 L340 130 L300 165 L280 145 L280 350 L120 350 L120 145 L100 165 L60 130 Z" fill="${fill}" stroke="#0003" stroke-width="3"/>`;
const pants = (fill) => `<path d="M140 40 L260 40 L275 360 L215 360 L200 140 L185 360 L125 360 Z" fill="${fill}" stroke="#0003" stroke-width="3"/>`;
const scene = (inner, bg = "#d9d4cc") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="800" height="800"><rect width="400" height="400" fill="${bg}"/><rect y="300" width="400" height="100" fill="#c9c2b8"/>${inner}</svg>`;
const label = (lines, bg = "#fbfbf8") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="800" height="600"><rect width="400" height="300" fill="#6b6f75"/><rect x="60" y="40" width="280" height="220" rx="8" fill="${bg}"/>${lines
    .map((l, i) => `<text x="200" y="${100 + i * 45}" font-family="Arial" font-size="${i === 0 ? 34 : 24}" text-anchor="middle" fill="#222">${l}</text>`)
    .join("")}</svg>`;

const fixtures = {
  "tshirt.jpg": scene(shirt("#f4f4f2")),
  "sweater.jpg": scene(shirt("#2e4a3a")),
  "jeans.jpg": scene(pants("#2c3e63")),
  "brand-label.jpg": label(["ACNE STUDIOS", "Stockholm"]),
  "care-label.jpg": label(["M", "100% WOOL", "Made in Portugal"]),
  "price-tag.jpg": label(["€ 89,00", "SALE"], "#fff3c4"),
  "screenshot.jpg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" width="390" height="844"><rect width="390" height="844" fill="#fff"/><rect y="0" width="390" height="60" fill="#111"/><text x="20" y="40" fill="#fff" font-family="Arial" font-size="20">SHOP</text><rect x="20" y="90" width="350" height="420" fill="#eee"/><g transform="translate(15 100)">${shirt("#3a3b3d")}</g><text x="20" y="560" font-family="Arial" font-size="22" fill="#111">Wool crewneck sweater</text><text x="20" y="600" font-family="Arial" font-size="22" fill="#111">€ 129</text></svg>`,
};

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, svg] of Object.entries(fixtures)) {
  const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/);
  await page.setViewportSize({ width: Number(w), height: Number(h) });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.screenshot({ path: `${OUT}/${file}`, type: "jpeg", quality: 85 });
  console.log("wrote", file);
}
await browser.close();
