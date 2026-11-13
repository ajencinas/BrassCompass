#!/usr/bin/env node
/**
 * Publish the game to GitHub Pages.
 *
 * The repository keeps the painted art out of git (33 MiB of generated plates), so a Pages
 * branch cannot be built from the source tree alone: it carries the BUILT site, with the
 * paintings in it. This script builds the game, writes that build into a `gh-pages` branch and
 * pushes the branch, and then points the repository's Pages at it.
 *
 *   npm run publish:pages            # build, publish, and point Pages at the branch
 *   npm run publish:pages -- --dry   # everything except the push
 *
 * The branch is written with git plumbing and a temporary index, so the working tree is never
 * touched: the source files cannot end up inside the published site, and the site cannot end up
 * inside the source tree.
 *
 * The one thing this cannot do without a token that has the `workflow` scope is keep
 * `.github/workflows/pages.yml` (which does the same job automatically on every push): the
 * personal access token on this machine may not create or update workflow files. That file is
 * in the working tree; push it with a token that has the scope and the automatic deploy takes
 * over from this script.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The checkout path has a space in it, so the URL has to be decoded, not just sliced.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(ROOT, "dist");
const BRANCH = "gh-pages";
const DRY = process.argv.includes("--dry");

const git = (args, opts = {}) => {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", ...opts });
  if (r.status !== 0) {
    console.error(`git ${args.join(" ")} failed (${r.status})\n${r.stderr ?? ""}`);
    process.exit(r.status ?? 1);
  }
  return (r.stdout ?? "").trim();
};

if (!existsSync(DIST)) {
  console.log("No dist/ yet - building.");
  const build = spawnSync("npm", ["run", "build"], { cwd: ROOT, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

// The built site needs the paintings. A code-only build is a loading screen.
if (!existsSync(join(DIST, "assets/scenes/dock_wide.webp"))) {
  console.error("The build has no paintings in it (public/assets is empty or stale).");
  console.error("Restore the art, run `npm run assets`, and build again.");
  process.exit(1);
}

const site = mkdtempSync(join(tmpdir(), "brass-pages-"));
try {
  console.log("Staging the built site...");
  cpSync(DIST, site, { recursive: true });
  // Jekyll must not touch the build.
  writeFileSync(join(site, ".nojekyll"), "");

  // A temporary index: the branch is written without the working tree ever changing.
  const index = join(site, ".git-index");
  const env = { ...process.env, GIT_INDEX_FILE: index };
  git(["read-tree", "--empty"], { env });
  git(["--work-tree", site, "add", "-A", "."], { env });
  const tree = git(["write-tree"], { env });
  const parent = git(["rev-parse", "main"]);
  const message = `Publish the game: ${new Date().toISOString().slice(0, 19)}Z`;
  const commit = git(["commit-tree", tree, "-p", parent, "-m", message]);
  git(["update-ref", `refs/heads/${BRANCH}`, commit]);

  if (DRY) {
    console.log(`\nDry run: ${BRANCH} is staged (${commit.slice(0, 10)}), nothing was pushed.`);
  } else {
    git(["push", "origin", BRANCH]);
    console.log(`\nPushed ${BRANCH} (${commit.slice(0, 10)}).`);
    console.log("Point the repository's Pages at it:");
    console.log("  Settings -> Pages -> Build and deployment -> Source: Deploy from a branch");
    console.log(`  -> ${BRANCH} / (root)`);
    console.log("  The game will be at https://ajencinas.github.io/BrassCompass/");
  }
} finally {
  rmSync(site, { recursive: true, force: true });
}
