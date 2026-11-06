/**
 * The title screen. Pure rendering plus the button layout, which the hit-test also uses — so
 * the two can never drift apart.
 */

import { LOGICAL_W, LOGICAL_H } from "../engine/view";
import { drawText } from "../engine/text";

export type TitleId = "start" | "continue" | "explore";

export interface TitleButton {
  id: TitleId;
  label: string;
  /** Top edge of the button in logical pixels. */
  y: number;
}

export const TITLE_BUTTON = { width: 400, height: 62, left: 760, right: 1160 };

/**
 * Buttons top to bottom. Continue only appears when there is a save; Chapter select (walk any
 * scene, nothing saved) once the voyage has been finished, or always on the dev server.
 * `confirmNew` turns New Voyage into its own confirmation when it would replace a save.
 */
export function titleButtons(hasSave: boolean, chapters: boolean, confirmNew = false): TitleButton[] {
  const list: { id: TitleId; label: string }[] = [
    { id: "start", label: confirmNew ? "Yes — start anew" : "New Voyage" },
    ...(hasSave ? [{ id: "continue" as const, label: "Continue" }] : []),
    ...(chapters ? [{ id: "explore" as const, label: "Chapter select" }] : []),
  ];
  return list.map((b, i) => ({ ...b, y: 670 + i * 88 }));
}

/** Whether a point is on the button whose top edge is `top`. */
export function hitTitleButton(top: number, x: number, y: number): boolean {
  return x > TITLE_BUTTON.left && x < TITLE_BUTTON.right && y > top - 10 && y < top + 68;
}

export interface TitleView {
  bg?: HTMLImageElement;
  buttons: TitleButton[];
  focus: TitleId | null;
  /** The Adventure Editor is a dev-server feature; don't advertise it in a build. */
  dev: boolean;
  /** New Voyage is waiting for its confirmation. */
  confirmNew?: boolean;
}

export function drawTitle(ctx: CanvasRenderingContext2D, view: TitleView): void {
  const bg = view.bg;
  if (bg) {
    const width = LOGICAL_H * (bg.width / bg.height);
    ctx.drawImage(bg, (LOGICAL_W - width) / 2, 0, width, LOGICAL_H);
  } else {
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }

  const g = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
  g.addColorStop(0, "rgba(3,5,12,0.72)");
  g.addColorStop(0.45, "rgba(3,5,12,0.35)");
  g.addColorStop(1, "rgba(3,5,12,0.88)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  drawText(ctx, "THE BRASS", LOGICAL_W / 2, 300, {
    size: 96, color: "#e8c98a", align: "center", weight: "bold",
  });
  drawText(ctx, "COMPASS", LOGICAL_W / 2, 400, {
    size: 96, color: "#e8c98a", align: "center", weight: "bold",
  });
  drawText(ctx, "a tale of the Vela Straits", LOGICAL_W / 2, 530, {
    size: 26, color: "rgba(200,215,235,0.75)", align: "center", weight: "normal",
  });

  if (view.confirmNew) {
    // Sits where the gap between the subtitle and the buttons is.
    ctx.fillStyle = "rgba(60,20,12,0.85)";
    ctx.fillRect(LOGICAL_W / 2 - 360, 596, 720, 54);
    drawText(ctx, "This replaces your saved voyage. Choose again to confirm.", LOGICAL_W / 2, 610, {
      size: 22, color: "#ffd9b8", align: "center", shadow: false,
    });
  }
  for (const b of view.buttons) drawButton(ctx, b.label, b.y, view.focus === b.id, view.confirmNew && b.id === "start");

  drawText(ctx, "Click a thing to act on it    ·    right-click to look    ·    hold Q to reveal what's interactive", LOGICAL_W / 2, 982, {
    size: 20, color: "#dbe3ee", align: "center",
  });
  const dev = view.dev ? "    ·    F2 — Adventure Editor" : "";
  drawText(ctx, `Tab / arrows, Enter — keyboard    ·    H — tip    ·    Escape — settings    ·    M — mute${dev}`, LOGICAL_W / 2, 1018, {
    size: 20, color: "#c9d3e0", align: "center",
  });
}

function drawButton(ctx: CanvasRenderingContext2D, label: string, y: number, hover: boolean, warn = false): void {
  const w = TITLE_BUTTON.width, h = TITLE_BUTTON.height, x = LOGICAL_W / 2 - w / 2;
  ctx.fillStyle = warn ? "rgba(120,40,20,0.75)" : hover ? "rgba(232,201,138,0.18)" : "rgba(10,16,28,0.55)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = warn ? "rgba(255,190,150,0.95)" : hover ? "rgba(232,201,138,0.9)" : "rgba(201,162,74,0.45)";
  ctx.lineWidth = hover ? 2 : 1.5;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  drawText(ctx, label, LOGICAL_W / 2, y + 17, {
    size: 26, color: hover ? "#fff6e0" : "#d9c9a4", align: "center", weight: "bold",
  });
}
