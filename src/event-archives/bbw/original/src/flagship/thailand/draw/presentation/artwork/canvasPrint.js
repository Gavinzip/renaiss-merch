export function surface(width, height, color) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const pen = canvas.getContext("2d");
    if (!pen)
        throw new Error("Travel artwork needs Canvas2D");
    pen.fillStyle = color;
    pen.fillRect(0, 0, width, height);
    return { canvas, pen };
}
export function text(p, value, x, y, size, color, weight = 400, max) {
    p.fillStyle = color;
    const font = () => { p.font = `${weight} ${size}px Arial, "PingFang TC", "Microsoft JhengHei", sans-serif`; };
    font();
    if (max)
        while (p.measureText(value).width > max && size > 20) {
            size--;
            font();
        }
    if (max === undefined)
        p.fillText(value, x, y);
    else
        p.fillText(value, x, y, max);
}
