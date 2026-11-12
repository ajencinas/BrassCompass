#!/usr/bin/env node
/**
 * Bundle-size budget: fail when the built JavaScript or CSS grows past a gzip budget.
 *
 *   node tools/check-bundle-size.mjs [dist-dir]     # default: dist
 *   MAX_JS_GZIP_KB=250 MAX_CSS_GZIP_KB=30 node tools/check-bundle-size.mjs
 *
 * The game is one bundle; gzip is what a player's connection actually pays for. The budget leaves
 * headroom over today's size (about 185 KB JS) so ordinary work passes and an accidental
 * dependency or a pasted-in data blob does not.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const dist = resolve(process.argv[2] ?? "dist");
const maxJs = Number(process.env.MAX_JS_GZIP_KB ?? 250);
const maxCss = Number(process.env.MAX_CSS_GZIP_KB ?? 30);
const dir = join(dist, "assets");
if (!existsSync(dir)) {
  console.error(`bundle size: ${dir} does not exist — build first.`);
  process.exit(1);
}

const totals = { js: 0, css: 0 };
for (const name of readdirSync(dir)) {
  const kind = name.endsWith(".js") ? "js" : name.endsWith(".css") ? "css" : null;
  if (!kind) continue;
  const kb = gzipSync(readFileSync(join(dir, name)), { level: 9 }).length / 1024;
  totals[kind] += kb;
  console.log(`  ${name}  ${kb.toFixed(1)} KB gzip`);
}

let failed = false;
for (const [kind, max] of [["js", maxJs], ["css", maxCss]]) {
  const kb = totals[kind];
  const ok = kb > 0 && kb <= max;
  console.log(`bundle size: ${kind.toUpperCase()} ${kb.toFixed(1)} KB gzip (budget ${max} KB) ${ok ? "ok" : "FAIL"}`);
  if (!ok) failed = true;
}
if (failed) process.exitCode = 1;
