let surface;
const mix = (a, b, t) => a + (b - a) * t;
/** Reusable satin gold stock, generated once. Fine grain belongs to the foil, not the card photograph. */
export function goldFoilSurface() {
    if (surface)
        return surface;
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 128;
    const p = canvas.getContext("2d");
    if (!p)
        throw new Error("Gold foil stock needs Canvas2D");
    const pixels = p.createImageData(canvas.width, canvas.height);
    const dark = [158, 126, 72], light = [245, 228, 183];
    let seed = 9137;
    for (let y = 0; y < canvas.height; y++)
        for (let x = 0; x < canvas.width; x++) {
            const u = x / canvas.width, v = y / canvas.height;
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const grain = (seed / 4294967296 - .5) * .035;
            const unevenness = .018 * Math.sin(u * 57 + Math.sin(v * 19)) + .012 * Math.sin(u * 163 - v * 29);
            const reflector = Math.exp(-Math.pow((v + unevenness - .29) / .24, 2));
            const shade = Math.exp(-Math.pow((v + unevenness - .78) / .22, 2));
            const tone = Math.max(0, Math.min(1, .43 + .49 * reflector - .22 * shade + grain));
            const offset = (y * canvas.width + x) * 4;
            for (let c = 0; c < 3; c++)
                pixels.data[offset + c] = mix(dark[c], light[c], tone);
            pixels.data[offset + 3] = 255;
        }
    p.putImageData(pixels, 0, 0);
    surface = canvas;
    return canvas;
}
