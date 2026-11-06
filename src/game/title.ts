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

/** Buttons top to bottom. Continue only appears when there is a save. */
export function titleButtons(hasSave: boolean): TitleButton[] {
  const list: { id: TitleId; label: string }[] = [
    { id: "start", label: "New Voyage" },
    ...(hasSave ? [{ id: "continue" as const, label: "Continue" }] : []),
    { id: "explore", label: "Explore Scenes" },
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

  for (const b of view.buttons) drawButton(ctx, b.label, b.y, view.focus === b.id);

  drawText(ctx, "Tab / arrows — navigate    ·    Enter — select    ·    right click — quick action / cancel", LOGICAL_W / 2, 986, {
    size: 18, color: "rgba(214,224,238,0.88)", align: "center",
  });
  const dev = view.dev ? "    ·    F2 — Adventure Editor" : "";
  drawText(ctx, `H — tip for what's next    ·    Escape — settings (tip mode)    ·    M — mute${dev}`, LOGICAL_W / 2, 1018, {
    size: 18, color: "rgba(214,224,238,0.7)", align: "center",
  });
}

function drawButton(ctx: CanvasRenderingContext2D, label: string, y: number, hover: boolean): void {
  const w = TITLE_BUTTON.width, h = TITLE_BUTTON.height, x = LOGICAL_W / 2 - w / 2;
  ctx.fillStyle = hover ? "rgba(232,201,138,0.18)" : "rgba(10,16,28,0.55)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = hover ? "rgba(232,201,138,0.9)" : "rgba(201,162,74,0.45)";
  ctx.lineWidth = hover ? 2 : 1.5;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  drawText(ctx, label, LOGICAL_W / 2, y + 17, {
    size: 26, color: hover ? "#fff6e0" : "#d9c9a4", align: "center", weight: "bold",
  });
}
