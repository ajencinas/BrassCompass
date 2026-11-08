/**
 * The Adventure Editor: a dev-only panel over the running game (F2). Loaded by main.ts only
 * under `npm run dev`, so none of this is in the production bundle.
 *
 *   Script   edit the .adv files; Apply hot-swaps the content, Save writes the file
 *   State    act, room, inventory and flags, with controls
 *   Log      a trace of what fired
 *   Map      the puzzle map per act
 *   Overlay  walk areas, hotspots and stand points on the scene; drag to edit
 *
 * Alt+click a hotspot (or a line of dialogue) to open its script.
 */

import "./editor.css";
import type { Game } from "../game/game";
import type { View } from "../engine/view";
import { compile, formatError, type AdvError, type Compiled, type Loc } from "../adv/compile";
import { COMPILE_OPTIONS, SOURCES, locOf, swapContent } from "../content/content";
import { CodeArea } from "./codearea";
import { LogPanel, MapPanel, StatePanel } from "./panels";
import { OverlayPanel } from "./overlay";

export interface Buffer { path: string; text: string; saved: string }

/** What the panels share. */
export interface EditorCtx {
  game: Game;
  buffers: Map<string, Buffer>;
  open(loc: Loc | undefined): void;
  openObj(obj: object | undefined): void;
  /** Recompile every buffer and swap the result in; false (with errors shown) if it won't compile. */
  apply(): boolean;
  /** A buffer's text changed outside the code area (e.g. a dragged point). */
  edited(path: string): void;
  save(path: string): Promise<void>;
  status(text: string, kind?: "ok" | "warn" | "err"): void;
}

type Tab = "script" | "state" | "log" | "map" | "overlay";
const TABS: [Tab, string][] = [["script", "Script"], ["state", "State"], ["log", "Log"], ["map", "Map"], ["overlay", "Overlay"]];
const OPEN_KEY = "brasscompass.editor.v1";

export function install(game: Game, view: View): void {
  const buffers = new Map<string, Buffer>(SOURCES.map((f) => [f.path, { path: f.path, text: f.text, saved: f.text }]));
  let current = buffers.has("rooms/dock.adv") ? "rooms/dock.adv" : [...buffers.keys()][0];
  let tab: Tab = "script";
  let errors: AdvError[] = [];

  // ------------------------------------------------------------ DOM

  const root = document.createElement("div");
  root.id = "adv";
  root.innerHTML = `
    <header>
      <b>Adventure Editor</b>
      <nav>${TABS.map(([id, label]) => `<button data-tab="${id}">${label}</button>`).join("")}</nav>
      <button class="adv-close" title="Close (F2)">×</button>
    </header>
    <section data-panel="script">
      <aside class="adv-files"><input class="adv-filter" placeholder="filter files"><div class="adv-list"></div></aside>
      <div class="adv-main">
        <div class="adv-toolbar">
          <span class="adv-file"></span>
          <span class="adv-spacer"></span>
          <button class="adv-revert" title="Back to the saved file">Revert</button>
          <button class="adv-apply" title="Recompile and swap into the running game (Ctrl+Enter)">Apply</button>
          <button class="adv-save" title="Write the file (Ctrl+S)">Save</button>
        </div>
        <div class="adv-editor"></div>
        <div class="adv-errors"></div>
      </div>
    </section>
    <section data-panel="state"></section>
    <section data-panel="log"></section>
    <section data-panel="map"></section>
    <section data-panel="overlay"></section>
    <footer class="adv-status"></footer>`;
  document.body.appendChild(root);
  const $ = <T extends HTMLElement>(sel: string): T => root.querySelector(sel) as T;
  const code = new CodeArea();
  $(".adv-editor").appendChild(code.el);
  const listEl = $(".adv-list"), filterEl = $<HTMLInputElement>(".adv-filter"), errorsEl = $(".adv-errors");
  const statusEl = $(".adv-status");

  let statusTimer = 0;
  const status = (text: string, kind: "ok" | "warn" | "err" = "ok"): void => {
    statusEl.textContent = text;
    statusEl.className = `adv-status ${kind}`;
    window.clearTimeout(statusTimer);
    if (kind === "ok") statusTimer = window.setTimeout(() => { statusEl.textContent = ""; }, 5000);
  };

  // ------------------------------------------------------------ files

  const renderList = (): void => {
    const q = filterEl.value.trim().toLowerCase();
    let html = "", folder = "";
    // Top-level files first, then each folder.
    const sortKey = (p: string): string => (p.includes("/") ? "1" : "0") + p;
    for (const b of [...buffers.values()].sort((x, y) => sortKey(x.path).localeCompare(sortKey(y.path)))) {
      if (q && !b.path.toLowerCase().includes(q)) continue;
      const slash = b.path.lastIndexOf("/");
      const dir = slash < 0 ? "" : b.path.slice(0, slash);
      if (dir !== folder) { folder = dir; html += `<div class="adv-dir">${dir}/</div>`; }
      const bad = errors.some((e) => e.file === b.path && !e.warning);
      const cls = [b.path === current ? "on" : "", b.text !== b.saved ? "dirty" : "", bad ? "bad" : ""].filter(Boolean).join(" ");
      html += `<div class="adv-f ${cls}" data-path="${b.path}">${b.path.slice(slash + 1).replace(/\.adv$/, "")}</div>`;
    }
    listEl.innerHTML = html;
  };
  const renderToolbar = (): void => {
    const b = buffers.get(current)!;
    $(".adv-file").innerHTML = `${current}${b.text !== b.saved ? ' <i title="unsaved changes">●</i>' : ""}`;
  };
  const renderErrors = (): void => {
    const mine = errors.filter((e) => e.file === current);
    code.setMarks(mine.map((e) => ({ line: e.line, col: e.col, message: e.message, warning: e.warning })));
    const fatal = errors.filter((e) => !e.warning);
    const shown = [...fatal, ...errors.filter((e) => e.warning && e.file === current)].slice(0, 60);
    errorsEl.innerHTML = shown.length
      ? shown.map((e, i) => `<div class="${e.warning ? "warn" : "err"}" data-i="${i}">${formatError(e).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`).join("")
      : `<div class="ok">No errors.</div>`;
    errorsEl.querySelectorAll<HTMLElement>("[data-i]").forEach((el) => {
      el.onclick = () => open(shown[Number(el.dataset.i)]);
    });
    renderList();
  };
  const select = (path: string): void => {
    if (!buffers.has(path)) return;
    current = path;
    code.load(buffers.get(path)!.text);
    renderToolbar();
    renderErrors();
  };

  // ------------------------------------------------------------ compile, apply, save

  const compileAll = (): Compiled => {
    const result = compile([...buffers.values()].map((b) => ({ path: b.path, text: b.text })), COMPILE_OPTIONS);
    errors = result.errors;
    return result;
  };
  let checkTimer = 0;
  code.onChange(() => {
    buffers.get(current)!.text = code.text;
    renderToolbar();
    window.clearTimeout(checkTimer);
    checkTimer = window.setTimeout(() => { compileAll(); renderErrors(); }, 300);
  });

  const apply = (): boolean => {
    const result = compileAll();
    renderErrors();
    const fatal = result.errors.filter((e) => !e.warning);
    if (fatal.length) {
      status(`${fatal.length} error${fatal.length > 1 ? "s" : ""}: not applied. ${formatError(fatal[0])}`, "err");
      return false;
    }
    swapContent(result);
    game.devReload();
    status(`Applied ${buffers.size} scripts to the running game.`);
    map.refresh();
    return true;
  };

  const save = async (path = current): Promise<void> => {
    const b = buffers.get(path)!;
    try {
      const res = await fetch("/__adv/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, text: b.text }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      b.saved = b.text;
      renderToolbar();
      renderList();
      status(`Saved src/content/scripts/${path}${errors.some((e) => !e.warning) ? " (it still has errors)" : ""}.`, errors.some((e) => !e.warning) ? "warn" : "ok");
    } catch (e) {
      status(`Save failed: ${(e as Error).message}`, "err");
    }
  };

  $(".adv-apply").onclick = () => apply();
  $(".adv-save").onclick = () => void save();
  $(".adv-revert").onclick = () => {
    const b = buffers.get(current)!;
    b.text = b.saved;
    code.text = b.text;
    renderToolbar();
    compileAll();
    renderErrors();
    status(`Reverted ${current} to the saved file.`);
  };
  listEl.onclick = (e) => {
    const path = (e.target as HTMLElement).closest<HTMLElement>("[data-path]")?.dataset.path;
    if (path) select(path);
  };
  filterEl.oninput = renderList;

  // Edits made outside the editor (another editor, git): pick them up unless ours are unsaved.
  import.meta.hot?.on("adv:changed", async ({ path }: { path: string }) => {
    const files: { path: string; text: string }[] = await (await fetch("/__adv/files")).json();
    const disk = files.find((f) => f.path === path);
    if (!disk) return;
    const b = buffers.get(path);
    if (!b) { buffers.set(path, { path, text: disk.text, saved: disk.text }); renderList(); return; }
    if (b.saved === disk.text) return; // our own save
    if (b.text !== b.saved) { status(`${path} changed on disk, but has unsaved edits here; kept the edits.`, "warn"); return; }
    b.text = b.saved = disk.text;
    if (path === current) code.text = disk.text;
    compileAll();
    renderErrors();
    status(`${path} changed on disk: reloaded. Apply to use it.`, "warn");
  });

  // ------------------------------------------------------------ navigation

  const open = (loc: Loc | undefined): void => {
    if (!loc || !buffers.has(loc.file)) { status("No script line for that.", "warn"); return; }
    setOpen(true);
    setTab("script");
    if (current !== loc.file) select(loc.file);
    code.goto(loc.line, loc.col);
  };
  const openObj = (obj: object | undefined): void => open(locOf(obj));

  const ctx: EditorCtx = {
    game, buffers, open, openObj, apply, status, save,
    edited: (path) => {
      if (path === current) code.text = buffers.get(path)!.text;
      renderToolbar();
      renderList();
    },
  };
  const state = new StatePanel(ctx, $("[data-panel=state]"));
  const log = new LogPanel(ctx, $("[data-panel=log]"));
  const map = new MapPanel(ctx, $("[data-panel=map]"));
  const overlay = new OverlayPanel(ctx, $("[data-panel=overlay]"));
  game.trace = (e) => log.add(e);

  const setTab = (t: Tab): void => {
    tab = t;
    root.querySelectorAll<HTMLElement>("nav button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
    root.querySelectorAll<HTMLElement>("section").forEach((s) => s.classList.toggle("on", s.dataset.panel === t));
    state.active = t === "state";
    if (t === "state") state.refresh();
    if (t === "map") map.refresh();
    if (t === "overlay") overlay.refresh();
    try { localStorage.setItem(OPEN_KEY, JSON.stringify({ open: isOpen, tab })); } catch { /* ignore */ }
  };
  root.querySelector("nav")!.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).dataset.tab as Tab | undefined;
    if (t) setTab(t);
  });

  let isOpen = false;
  const setOpen = (on: boolean): void => {
    if (on === isOpen) return;
    isOpen = on;
    root.classList.toggle("open", on);
    document.body.classList.toggle("adv-open", on);
    view.resize();
    try { localStorage.setItem(OPEN_KEY, JSON.stringify({ open: isOpen, tab })); } catch { /* ignore */ }
    if (on && tab === "script") code.ta.focus({ preventScroll: true });
    if (!on) (document.getElementById("game") as HTMLElement | null)?.focus({ preventScroll: true });
  };
  $(".adv-close").onclick = () => setOpen(false);

  // ------------------------------------------------------------ keyboard and mouse

  // Capture phase: runs before the game's own listener, so keys typed here never reach it.
  window.addEventListener("keydown", (e) => {
    if (e.key === "F2") {
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(!isOpen);
      return;
    }
    if (!root.contains(e.target as Node)) return;
    e.stopPropagation();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === "s") { e.preventDefault(); void save(); }
    else if (mod && e.key === "Enter") { e.preventDefault(); apply(); }
  }, true);

  // Alt+click opens the script behind a hotspot or a dialogue line.
  window.addEventListener("mousedown", (e) => {
    if (!e.altKey || (e.target as HTMLElement).id !== "game") return;
    e.preventDefault();
    e.stopPropagation();
    const pick = game.devPick(e.clientX, e.clientY);
    if (!pick) { status("Nothing with a script there (Alt+click a hotspot or a line of dialogue).", "warn"); return; }
    openObj(pick.kind === "hotspot" ? pick.hotspot : pick.kind === "choice" ? pick.choice : pick.node);
  }, true);

  // ------------------------------------------------------------ start

  select(current);
  compileAll();
  renderErrors();
  let saved: { open?: boolean; tab?: Tab } = {};
  try { saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}"); } catch { /* ignore */ }
  setTab(saved.tab && TABS.some(([t]) => t === saved.tab) ? saved.tab : "script");
  if (saved.open) setOpen(true);
  (window as unknown as Record<string, unknown>).__editor = { open: setOpen, tab: setTab, apply, select, buffers, ctx };
  console.info("Adventure Editor: F2 to open; Alt+click a hotspot to open its script.");
}
