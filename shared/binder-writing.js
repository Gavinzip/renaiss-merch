// Page-relative vector ink, never executable markup or uploaded SVG.
export const BINDER_INK_COLORS = ["#f4ead5", "#e0b96e", "#e8a8bb", "#a7cedb"];
export const BINDER_MAX_MARKS = 240;
export const BINDER_MAX_POINTS = 16000;
export const BINDER_STROKE_POINTS = 1600;
export const BINDER_BODY_BYTES = 512 * 1024;

export function validateWriting(value, pageIds) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid_writing");
  const surfaces = new Set([
    "inside-front",
    "inside-back",
    ...pageIds.map((id) => "page:" + id),
  ]);
  const ids = new Set();
  let markCount = 0,
    pointCount = 0;
  const writing = {};
  const coordinate = (n) => Number.isInteger(n) && n >= 0 && n <= 1000;
  for (const [surface, marks] of Object.entries(value)) {
    if (!surfaces.has(surface) || !Array.isArray(marks))
      throw new Error("invalid_writing_surface");
    writing[surface] = marks.map((mark) => {
      if (
        ++markCount > BINDER_MAX_MARKS ||
        !mark ||
        typeof mark.id !== "string" ||
        !/^[a-zA-Z0-9-]{1,64}$/.test(mark.id) ||
        ids.has(mark.id) ||
        !BINDER_INK_COLORS.includes(mark.color)
      )
        throw new Error("invalid_writing_mark");
      ids.add(mark.id);
      const { id, color } = mark;
      if (mark.kind === "stroke") {
        if (
          ![3, 6, 10].includes(mark.width) ||
          !Array.isArray(mark.points) ||
          mark.points.length < 1 ||
          mark.points.length > BINDER_STROKE_POINTS
        )
          throw new Error("invalid_writing_stroke");
        pointCount += mark.points.length;
        if (pointCount > BINDER_MAX_POINTS) throw new Error("writing_limit");
        const points = mark.points.map((point) => {
          if (
            !Array.isArray(point) ||
            point.length !== 2 ||
            !point.every(coordinate)
          )
            throw new Error("invalid_writing_point");
          return [point[0], point[1]];
        });
        return { id, kind: "stroke", color, width: mark.width, points };
      }
      if (mark.kind === "text") {
        if (
          !coordinate(mark.x) ||
          !coordinate(mark.y) ||
          ![24, 36, 52].includes(mark.size) ||
          typeof mark.text !== "string" ||
          !mark.text.trim() ||
          mark.text.length > 240 ||
          /[\u0000-\u0008\u000b-\u001f\u007f]/.test(mark.text)
        )
          throw new Error("invalid_writing_text");
        return {
          id,
          kind: "text",
          color,
          x: mark.x,
          y: mark.y,
          size: mark.size,
          text: mark.text,
        };
      }
      throw new Error("invalid_writing_kind");
    });
  }
  return writing;
}
