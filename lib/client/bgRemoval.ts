// In-browser background removal (@imgly/background-removal), lazy-loaded so it never slows the
// cold start. Any failure or timeout returns null and the caller keeps the original photo.

const ENABLED = process.env.NEXT_PUBLIC_BG_REMOVAL !== "off";
const TIMEOUT_MS = 45_000;
const INPUT_MAX_SIDE = 1024;

type Lib = typeof import("@imgly/background-removal");
let libPromise: Promise<Lib> | null = null;
const config = {
  model: "isnet_quint8" as const,
  output: { format: "image/png" as const },
};

function load(): Promise<Lib> {
  return (libPromise ??= import("@imgly/background-removal"));
}

/** Starts downloading the model in the background (call when the capture screen opens). */
export function warmUpBackgroundRemoval() {
  if (!ENABLED) return;
  load()
    .then((lib) => lib.preload(config))
    .catch(() => {
      libPromise = null;
    });
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function removeBackgroundSafe(
  photo: Blob,
  opts: { timeoutMs?: number; remove?: (b: Blob) => Promise<Blob> } = {},
): Promise<Blob | null> {
  if (!ENABLED && !opts.remove) return null;
  const started = performance.now();
  try {
    let run = opts.remove;
    if (!run) {
      const lib = await load();
      const { prepareImage } = await import("./image");
      run = async (b) => lib.removeBackground(await prepareImage(b, { maxSide: INPUT_MAX_SIDE }), config);
    }
    const out = await withTimeout(run(photo), opts.timeoutMs ?? TIMEOUT_MS);
    console.info(`background removal took ${Math.round(performance.now() - started)} ms`);
    return out.size > 0 ? out : null;
  } catch (e) {
    console.warn("background removal failed, using the original photo", e);
    return null;
  }
}
