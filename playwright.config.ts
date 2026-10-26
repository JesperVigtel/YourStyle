import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

// iPhone 15: 393×852 CSS px, DPR 3. Only Chromium is installed in this environment, so the default
// project emulates the iPhone in Chromium; `--project=iphone-webkit` runs real WebKit where available
// (`npx playwright install webkit`). See DECISIONS.md D19.
const iphone15 = {
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
};

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1, // tests share one local data directory
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    geolocation: { latitude: 44.494, longitude: 11.343 }, // Bologna
    permissions: ["geolocation"],
    locale: "en-GB",
    timezoneId: "Europe/Rome",
  },
  projects: [
    { name: "iphone-15", use: { ...iphone15, browserName: "chromium" } },
    { name: "iphone-webkit", use: { ...devices["iPhone 15"] } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    port: PORT,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(PORT),
      DATA_BACKEND: "local",
      LOCAL_DATA_DIR: ".data-e2e",
      AI_PROVIDER: "mock",
      MOCK_AI_LATENCY_MS: "150",
      NEXT_PUBLIC_BG_REMOVAL: "off",
    },
  },
});
