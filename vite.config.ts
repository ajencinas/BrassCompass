import { defineConfig, type Plugin } from "vite";
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const SCRIPTS = resolve(__dirname, "src/content/scripts");

/** A script path the editor may write: `name.adv` or `folder/name.adv` inside the scripts folder. */
function scriptPath(path: unknown): string | null {
  if (typeof path !== "string" || !/^([A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.adv$/.test(path)) return null;
  const full = resolve(SCRIPTS, path);
  return full.startsWith(SCRIPTS + sep) ? full : null;
}

function listScripts(dir = SCRIPTS): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...listScripts(p));
    else if (f.endsWith(".adv")) out.push({ path: relative(SCRIPTS, p).split(sep).join("/"), text: readFileSync(p, "utf8") });
  }
  return out;
}

/**
 * Dev server only (`apply: "serve"`; never part of a build): the Adventure Editor's file access.
 *
 *   GET  /__adv/files                 every script, { path, text }[]
 *   POST /__adv/save  { path, text }  write one script under src/content/scripts/
 *
 * A changed .adv file doesn't reload the page (that would lose the game in progress); the
 * editor is told instead, and applies changes itself.
 */
function advScripts(): Plugin {
  return {
    name: "adv-scripts",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__adv", (req, res) => {
        const reply = (status: number, body: unknown): void => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };
        // The editor can write game scripts, so keep it on this machine. `npm run dev` binds
        // 127.0.0.1; this still rejects a LAN client or proxy that reaches the port.
        const remote = req.socket.remoteAddress;
        if (remote !== "127.0.0.1" && remote !== "::1" && remote !== "::ffff:127.0.0.1") {
          return reply(403, { error: "the editor is available on loopback only" });
        }
        if (req.method === "GET" && req.url === "/files") return reply(200, listScripts());
        if (req.method !== "POST" || req.url !== "/save") return reply(404, { error: "not found" });
        let body = "";
        req.setEncoding("utf8");
        req.on("data", (chunk: string) => {
          body += chunk;
          if (body.length > 2_000_000) req.destroy();
        });
        req.on("end", () => {
          let data: { path?: unknown; text?: unknown };
          try { data = JSON.parse(body); } catch { return reply(400, { error: "bad JSON" }); }
          const full = scriptPath(data.path);
          if (!full) return reply(403, { error: "only .adv files under src/content/scripts/ can be saved" });
          if (typeof data.text !== "string") return reply(400, { error: "no text" });
          if (!existsSync(resolve(full, ".."))) return reply(403, { error: "no such folder" });
          writeFileSync(full, data.text);
          reply(200, { ok: true, path: data.path });
        });
      });
    },
    handleHotUpdate(ctx) {
      if (!ctx.file.endsWith(".adv")) return;
      ctx.server.ws.send({ type: "custom", event: "adv:changed", data: { path: relative(SCRIPTS, ctx.file).split(sep).join("/") } });
      return [];
    },
  };
}


/**
 * Copy only the active art into the build.
 *
 * `public/` is also the source shelf, so the automatic publicDir copy would ship the archived
 * plates, earlier character studies, superseded item icons and the previous story's films —
 * tens of megabytes the live game never asks for. `active-assets.json` is generated from the
 * content by tools/asset-manifest.mjs (`prebuild`); this emits exactly its files. The dev
 * server still serves the whole folder, so artists can inspect source art.
 */
function activePublicAssets(): Plugin {
  return {
    name: "active-public-assets",
    apply: "build",
    generateBundle() {
      const manifestPath = resolve(__dirname, "src/content/active-assets.json");
      if (!existsSync(manifestPath)) {
        this.error("src/content/active-assets.json is missing — run npm run assets.");
        return;
      }
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { files?: unknown };
      const files = Array.isArray(manifest.files) ? manifest.files : [];
      const publicDir = resolve(__dirname, "public");
      const artShelf = existsSync(join(publicDir, "assets"));
      if (!artShelf) {
        this.warn("public/assets is absent — building a code-only bundle. Copy the shared art folder to include the game's paintings and music.");
      }
      for (const file of files) {
        if (typeof file !== "string" || file.startsWith("/") || file.includes("..")) {
          this.error(`active-assets.json has an unsafe path: ${String(file)}`);
          continue;
        }
        const full = resolve(publicDir, file);
        if (!full.startsWith(publicDir + sep)) {
          this.error(`active-assets.json has a path outside public/: ${file}`);
          continue;
        }
        if (!existsSync(full)) {
          // A code-only clone has no art shelf at all; anything else missing is a broken build.
          if (artShelf) this.error(`active asset is missing from public/: ${file}`);
          continue;
        }
        this.emitFile({ type: "asset", fileName: file, source: readFileSync(full) });
      }
    },
  };
}

export default defineConfig({
  // Relative base: the build works at a domain root, in a subdirectory (itch.io serves a
  // packaged game under /html/…/index.html), or opened from the filesystem. Runtime asset
  // URLs are resolved against it too — see `assetUrl` in src/content/assets.ts.
  base: "./",
  plugins: [advScripts(), activePublicAssets()],
  build: {
    // The active-art plugin above is the only thing that writes public files into dist.
    copyPublicDir: false,
  },
});
