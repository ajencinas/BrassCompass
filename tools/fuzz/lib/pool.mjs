/** A pool of game pages, each in its own browser context, with the in-page fuzz library loaded. */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startVite } from "../../browser-env.mjs";
import { Browser, waitForGame } from "./cdp.mjs";

const INPAGE = fileURLToPath(new URL("./inpage.js", import.meta.url));

/**
 * The dev server to fuzz (window.__game exists only there): FUZZ_URL when given, otherwise this
 * checkout's own, started on a free port. Returns { url, stop }.
 */
export async function gameServer() {
  if (process.env.FUZZ_URL) return { url: process.env.FUZZ_URL, stop: async () => {} };
  return startVite(5240, 5259);
}

export async function openGamePage(browser, { url, init = {} }) {
  const page = await browser.newPage(url);
  await waitForGame(page);
  await page.evaluate(await readFile(INPAGE, "utf8"));
  page.info = await page.evaluate(`window.__fz.init(${JSON.stringify(init)})`);
  return page;
}

export async function withPool(n, fn, { url, init = {} }) {
  const browser = await Browser.launch();
  const pages = [];
  try {
    const opened = await Promise.allSettled(Array.from({ length: n }, () => openGamePage(browser, { url, init })));
    for (const r of opened) if (r.status === "fulfilled") pages.push(r.value); else console.error("page failed:", r.reason?.message);
    if (!pages.length) throw new Error("no pages");
    return await fn(pages, browser);
  } finally {
    for (const p of pages) await p.close().catch(() => {});
    await browser.close();
  }
}

/** Run work units across pages; each unit is { label, expr } evaluated in a free page. */
export async function runUnits(pages, units, { onResult, timeoutMs = 20 * 60 * 1000 } = {}) {
  const queue = [...units];
  const results = [];
  await Promise.all(pages.map(async (page) => {
    while (queue.length) {
      const unit = queue.shift();
      page.label = unit.label;
      const t0 = Date.now();
      try {
        const value = await page.evaluate(unit.expr, { timeout: timeoutMs });
        const r = { label: unit.label, ok: true, value, ms: Date.now() - t0 };
        results.push(r);
        onResult?.(r, page);
      } catch (e) {
        const r = { label: unit.label, ok: false, error: e.message, ms: Date.now() - t0 };
        results.push(r);
        onResult?.(r, page);
      }
    }
  }));
  return results;
}
