import type { BinderText } from "../../../shared/binder-writing.js";

let measureCanvas: HTMLCanvasElement | undefined;
/** Constrain the actual ink, not just its editor, to the page bounds. */
export function layoutBinderText(mark: BinderText, aspect: number) {
  measureCanvas ??= document.createElement("canvas");
  const context = measureCanvas.getContext("2d")!;
  context.font = `${mark.size}px Poppins, sans-serif`;
  const lines: string[] = [];
  for (const paragraph of mark.text.split("\n")) {
    let line = "";
    for (const letter of paragraph) {
      if (line && context.measureText(line + letter).width > 900) {
        lines.push(line);
        line = "";
      }
      line += letter;
    }
    lines.push(line);
  }
  const height = lines.length * mark.size * aspect * 1.3;
  const scale = Math.min(1, 960 / Math.max(1, height));
  const width =
    Math.max(...lines.map((line) => context.measureText(line).width)) * scale;
  return {
    lines,
    size: mark.size * scale,
    x: Math.max(10, Math.min(mark.x, 980 - width)),
    y: Math.max(10, Math.min(mark.y, 980 - height * scale)),
  };
}
