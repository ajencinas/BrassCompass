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

export default defineConfig({
  plugins: [advScripts()],
});
