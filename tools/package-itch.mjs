/**
 * Build the itch.io upload.
 *
 *   npm run package:itch            # build, then zip dist/ for itch
 *   node tools/package-itch.mjs --no-build   # zip the dist/ that is already there
 *
 * Produces `dist-itch/the-brass-compass-v<version>-itch.zip` with `index.html` at the archive
 * root — the layout itch.io's HTML5 player expects. A README.txt written for the itch page goes
 * in beside it, and the zip is checked before the script reports success: the page, the bundle
 * and the asset folders must all be present and correctly rooted.
 *
 * No external archiver: the zip is written here (deflate via node:zlib), so the package builds
 * on a machine with nothing but Node. Media is stored rather than deflated — it is compressed
 * already and re-deflating tens of megabytes only makes the script slow. Timestamps are fixed,
 * so the same build packs to the same archive.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = join(ROOT, "dist");
const OUT = join(ROOT, "dist-itch");
const args = process.argv.slice(2);
const skipBuild = args.includes("--no-build");
const outDir = args.includes("--out") ? resolve(ROOT, args[args.indexOf("--out") + 1]) : OUT;

/** Extensions that do not benefit from another pass of deflate. */
const STORED = new Set([".png", ".webp", ".jpg", ".jpeg", ".gif", ".mp3", ".ogg", ".mp4", ".webm", ".zip", ".woff2"]);

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const version = String(pkg.version ?? "0.0.0");
const slug = String(pkg.name ?? "game").replace(/^@[^/]+\//, "");
const zipName = `${slug}-v${version}-itch.zip`;

function run(command, argv) {
  const result = spawnSync(command, argv, { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    console.error(`\npackage:itch — '${command} ${argv.join(" ")}' failed (exit ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

/** Every file under `dir`, as paths relative to it, in a stable order (index.html first). */
function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full).split(sep).join("/"));
  }
  return out;
}

/* ------------------------------------------------------------------------------------------- */
/* zip writer                                                                                   */
/* ------------------------------------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * One archive entry: a local header, then the data. Sizes and the CRC go in both the local
 * header and the central directory, so no data descriptor is needed.
 */
function entry(name, data) {
  const nameBytes = Buffer.from(name, "utf8");
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  const stored = STORED.has(ext);
  const body = stored ? data : deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  // A fixed DOS timestamp (1980-01-01 00:00) keeps the archive byte-identical between runs.
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); // local file header
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(stored ? 0 : 8, 8); // method: store / deflate
  local.writeUInt16LE(0, 10); // time
  local.writeUInt16LE(0x0021, 12); // date: 1980-01-01
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28); // extra length
  return { nameBytes, head: local, body, crc, stored, size: data.length, offset: 0 };
}

function zip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const e = entry(name, data);
    e.offset = offset;
    chunks.push(e.head, e.nameBytes, e.body);
    offset += e.head.length + e.nameBytes.length + e.body.length;
    central.push(e);
  }
  const directory = [];
  for (const e of central) {
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0); // central directory header
    record.writeUInt16LE(20, 4); // version made by
    record.writeUInt16LE(20, 6); // version needed
    record.writeUInt16LE(0x0800, 8); // UTF-8 names
    record.writeUInt16LE(e.stored ? 0 : 8, 10);
    record.writeUInt16LE(0, 12); // time
    record.writeUInt16LE(0x0021, 14); // date
    record.writeUInt32LE(e.crc, 16);
    record.writeUInt32LE(e.body.length, 20);
    record.writeUInt32LE(e.size, 24);
    record.writeUInt16LE(e.nameBytes.length, 28);
    record.writeUInt16LE(0, 30); // extra
    record.writeUInt16LE(0, 32); // comment
    record.writeUInt16LE(0, 34); // disk
    record.writeUInt16LE(0, 36); // internal attrs
    record.writeUInt32LE(0, 38); // external attrs (regular file, 0644 implied)
    record.writeUInt32LE(e.offset, 42);
    directory.push(record, e.nameBytes);
  }
  const directoryBuffer = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory
  end.writeUInt16LE(0, 4); // disk
  end.writeUInt16LE(0, 6); // disk with central directory
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(directoryBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment
  return Buffer.concat([...chunks, directoryBuffer, end]);
}

/** Read an archive's own central directory: the honest check that the layout is what itch wants. */
function contents(archive) {
  const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error("no end-of-central-directory record");
  const count = archive.readUInt16LE(end + 10);
  let at = archive.readUInt32LE(end + 16);
  const names = [];
  for (let i = 0; i < count; i++) {
    if (archive.readUInt32LE(at) !== 0x02014b50) throw new Error("bad central directory record");
    const nameLength = archive.readUInt16LE(at + 28);
    names.push(archive.subarray(at + 46, at + 46 + nameLength).toString("utf8"));
    at += 46 + nameLength + archive.readUInt16LE(at + 30) + archive.readUInt16LE(at + 32);
  }
  return names;
}

/* ------------------------------------------------------------------------------------------- */
/* README.txt for the itch page                                                                 */
/* ------------------------------------------------------------------------------------------- */

const README = `THE BRASS COMPASS
The Father and the Fog — a tale of Dreadwater Isle
v${version}

Fenn comes back to Dreadwater Isle three months after his father sailed into the Shroud. The
harbour is half empty, the only captain still sailing wants a price, and the fog keeps every
ship it takes.

A family-friendly point-and-click adventure in four acts: 25 painted rooms, twelve verbs, and
one inherited brass compass that has never once pointed north.

HOW TO PLAY
  Click a thing to act on it, or pick a verb and a thing.
  Right-click looks. Hold Q to reveal what is interactive.
  Double-click an exit to walk there.

  Keyboard: Tab and arrow keys move between the scene, verbs and inventory; Enter acts;
  H gives a hint; J opens the chart; L shows recent lines; M mutes; Escape pauses.

  Runs in the browser at 1920x1080 and scales to the window. Sound starts on your first click.

SAVING
  Progress saves automatically. Continue on the title screen picks up where you left off.

  Best in a current Chrome, Firefox, Edge or Safari, desktop or laptop. Fully playable by
  keyboard, mouse, touch or gamepad.

CREDITS AND LICENCE
  See CREDITS.md and LICENSE, both beside this file. Copyright (c) 2026. All rights reserved.
  The artwork and music were produced with AI generation tools under the author's
  direction (the game ships no films); see AI-DISCLOSURE.txt.

The game is an original work of interactive fiction. Any resemblance to actual fog banks is
entirely meteorological.
`;

const AI_DISCLOSURE = `AI DISCLOSURE — THE BRASS COMPASS

The Brass Compass is an original game: its story, characters, dialogue, puzzles, code and
design were written and built by a human author using AI-assisted development tools.

The painted scene backgrounds, character art, props and music were generated with
generative AI models from the author's prompts, then selected, edited, colour-graded, cropped
and composed by hand. This game ships no films or video footage. No third-party copyrighted artwork, music or footage is included. All
character names, places, dialogue and plot are original to this work; the game is not
affiliated with, endorsed by or derived from any existing adventure game or franchise.

The engine, scripting language, tools and all written text in the game are original work.
`;

/* ------------------------------------------------------------------------------------------- */

if (!skipBuild) {
  console.log("package:itch — building…\n");
  run("npm", ["run", "build"]);
} else {
  console.log("package:itch — --no-build: packing the existing dist/\n");
}

if (!existsSync(join(DIST, "index.html"))) {
  console.error(`package:itch — ${DIST}/index.html is missing. Build first, or drop --no-build.`);
  process.exit(1);
}

// The gameplay needs its art; a build without it would upload a game with no scenery. Warn
// loudly but still pack (CI builds test-only bundles, and the owner may package art separately).
// `video` is deliberately absent: the reboot ships no cinematics, so the old films are excluded.
for (const folder of ["scenes", "characters", "props", "audio"]) {
  if (!existsSync(join(DIST, "assets", folder))) console.warn(`package:itch — warning: dist/assets/${folder} is missing.`);
}

const files = [];
for (const path of walk(DIST)) {
  if (path === zipName) continue; // never pack an older upload of ourselves
  files.push({ name: path, data: readFileSync(join(DIST, path)) });
}
// index.html must be the first entry as well as present at the root: some itch tooling peeks.
files.sort((a, b) => (a.name === "index.html" ? -1 : b.name === "index.html" ? 1 : a.name.localeCompare(b.name)));

const readmeFiles = [
  { name: "README.txt", data: Buffer.from(README, "utf8") },
  { name: "AI-DISCLOSURE.txt", data: Buffer.from(AI_DISCLOSURE, "utf8") },
];
if (existsSync(join(ROOT, "LICENSE"))) {
  readmeFiles.push({ name: "LICENSE", data: readFileSync(join(ROOT, "LICENSE")) });
}
if (existsSync(join(ROOT, "CREDITS.md"))) {
  readmeFiles.push({ name: "CREDITS.md", data: readFileSync(join(ROOT, "CREDITS.md")) });
}

const archive = zip([...files, ...readmeFiles]);
const names = contents(archive);

const missing = ["index.html", "README.txt"].filter((n) => !names.includes(n));
if (missing.length) {
  console.error(`package:itch — the archive is missing ${missing.join(", ")} at its root.`);
  process.exit(1);
}
if (names.some((n) => n.startsWith("/") || n.includes(".."))) {
  console.error("package:itch — the archive has an absolute or escaping path.");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const target = join(outDir, zipName);
writeFileSync(target, archive);

const mb = (n) => `${(n / 1_048_576).toFixed(1)} MB`;
const media = names.filter((n) => /\.(webp|png|mp3|mp4)$/.test(n)).length;
console.log(`\npackage:itch — ${relative(ROOT, target)}  (${mb(archive.length)})`);
console.log(`  ${names.length} entries: index.html at the root, ${media} media files, README.txt and AI-DISCLOSURE.txt`);
console.log(`  sha256 ${createHash("sha256").update(archive).digest("hex").slice(0, 16)}…`);
console.log(`\n  Upload that zip at https://itch.io/dashboard → your game → Edit → Uploads.`);
console.log(`  Set the embed size to 1280x720 or larger (the game is 1920x1080) and "Click to launch".`);
