import { text } from "./canvasPrint";
import { goldFoilSurface } from "./foilSurface";
export const restingFoilLight = { x: .34, y: .3 };
/** Spot foil: satin stock and a confined reflection, with a fine pressed edge rather than extruded lettering. */
export function foilText(p, value, x, y, size, weight = 500, max, light = restingFoilLight) {
    const layer = document.createElement("canvas");
    layer.width = p.canvas.width;
    layer.height = p.canvas.height;
    const metal = layer.getContext("2d");
    if (!metal)
        throw new Error("Foil lettering needs Canvas2D");
    text(metal, value, x, y, size, "#fff", weight, max);
    const metrics = metal.measureText(value), width = Math.min(metrics.width, max ?? Infinity);
    const top = y - metrics.actualBoundingBoxAscent, height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    metal.globalCompositeOperation = "source-in";
    metal.drawImage(goldFoilSurface(), x, top, width, height);
    metal.globalCompositeOperation = "source-atop";
    const centre = x + width * light.x, spread = width * .38;
    const reflection = metal.createLinearGradient(centre - spread, top - height * light.y, centre + spread, y + height * (1 - light.y));
    reflection.addColorStop(0, "#fff8de00");
    reflection.addColorStop(.25, "#fff8de00");
    reflection.addColorStop(.5, "#fff8de7a");
    reflection.addColorStop(.75, "#fff8de00");
    reflection.addColorStop(1, "#fff8de00");
    metal.fillStyle = reflection;
    metal.fillRect(x - 1, top - 1, width + 2, height + 2);
    metal.strokeStyle = "#76572429";
    metal.lineWidth = .45;
    if (max === undefined)
        metal.strokeText(value, x, y);
    else
        metal.strokeText(value, x, y, max);
    p.drawImage(layer, 0, 0);
}
