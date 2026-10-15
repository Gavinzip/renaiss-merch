import { renaissDrawTaglineLines } from "../../../RosterDraw/renaissDrawBrand";

// Original Renaiss-only skin. Shared foil geometry and flight stay unchanged.
export function renaissDrawArtwork(
  logo: HTMLImageElement,
  pack = false,
  reverse = false,
) {
  const width = pack ? 1050 : 1440,
    height = pack ? 1920 : 944;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Renaiss artwork unavailable");
  const silver = ctx.createLinearGradient(0, 0, width, height);
  [
    [0, "#f9f7f3"],
    [0.3, "#e6e8ed"],
    [0.6, "#fff9f0"],
    [1, "#e7e1ea"],
  ].forEach(([at, color]) => silver.addColorStop(Number(at), String(color)));
  ctx.fillStyle = silver;
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "#87919b30";
  for (let i = 0; pack && i < 20; i++) {
    ctx.beginPath();
    ctx.moveTo(width * 0.52 + i * 22, height);
    ctx.bezierCurveTo(
      -width * 0.2 + i * 35,
      height * 0.6,
      width * 1.3 + i * 18,
      height * 0.45,
      width * 0.3 + i * 24,
      0,
    );
    ctx.stroke();
  }
  ctx.strokeStyle = "#ffffffd9";
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, width - 56, height - 56);
  const logoWidth = width * (pack ? 0.68 : 0.3);
  ctx.drawImage(
    logo,
    width * 0.1,
    height * (pack ? 0.16 : 0.13),
    logoWidth,
    (logoWidth * logo.height) / logo.width,
  );
  ctx.fillStyle = "#46484f";
  ctx.font = `500 ${width * 0.018}px Inter,sans-serif`;
  ctx.fillText(
    "RENAISS COLLECTION",
    width * 0.1,
    height * (pack ? 0.34 : 0.32),
  );
  ctx.fillStyle = "#292d32";
  ctx.font = `500 ${width * (pack ? 0.105 : 0.052)}px Inter,sans-serif`;
  renaissDrawTaglineLines.forEach((line, index) => {
    ctx.fillText(
      line,
      width * 0.095,
      height * ((pack ? 0.44 : 0.43) + index * (pack ? 0.073 : 0.088)),
    );
  });
  const spectrum = ctx.createLinearGradient(width * 0.1, 0, width * 0.9, 0);
  ["#454d9e", "#59a4c6", "#80bd5e", "#e3cf65", "#d78677"].forEach((color, i) =>
    spectrum.addColorStop(i / 4, color),
  );
  ctx.fillStyle = spectrum;
  ctx.fillRect(width * 0.1, height * 0.78, width * 0.8, pack ? 4 : 3);
  ctx.font = `500 ${width * 0.018}px Inter,sans-serif`;
  ctx.fillStyle = "#83778f";
  ctx.fillText(
    pack && reverse ? "RENAISS · COLLECTIBLES" : "RENAISS · SPECIAL REWARD",
    width * 0.1,
    height * 0.85,
  );
  ctx.textAlign = "right";
  ctx.font = `${width * 0.04}px Inter,sans-serif`;
  ctx.fillText("↗", width * 0.9, height * 0.86);
  if (pack)
    for (const y of [0, height - 90]) {
      ctx.fillStyle = "#b8b7bd33";
      ctx.fillRect(0, y, width, 90);
      for (let x = 2; x < width; x += 9) {
        ctx.fillStyle = x % 18 ? "#ffffff70" : "#7a788340";
        ctx.fillRect(x, y, 3, 90);
      }
    }
  return canvas;
}
