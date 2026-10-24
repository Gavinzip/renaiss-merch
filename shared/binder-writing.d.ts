export type InkPoint = [number, number];
export type BinderStroke = {
  id: string;
  kind: "stroke";
  color: string;
  width: 3 | 6 | 10;
  points: InkPoint[];
};
export type BinderText = {
  id: string;
  kind: "text";
  color: string;
  x: number;
  y: number;
  size: 24 | 36 | 52;
  text: string;
};
export type BinderMark = BinderStroke | BinderText;
export type BinderWriting = Record<string, BinderMark[]>;
export const BINDER_INK_COLORS: readonly string[];
export const BINDER_MAX_MARKS: number;
export const BINDER_MAX_POINTS: number;
export const BINDER_STROKE_POINTS: number;
export const BINDER_BODY_BYTES: number;
export function validateWriting(
  value: unknown,
  pageIds: string[],
): BinderWriting | undefined;
