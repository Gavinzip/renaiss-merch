export const BINDER_NATIVE_VIEWPORT_EVENT = "merch-native-viewport";

/** The App publishes one geometry before notifying the responsive book. */
export function nativeBinderViewport() {
  const data = document.documentElement.dataset;
  if (data.merchNativeWidth === undefined) return null;
  const width = Number(data.merchNativeWidth);
  const height = Number(data.merchNativeHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error("Invalid native Merch viewport");
  return { width, height };
}

export function binderViewportIsWide() {
  const native = nativeBinderViewport();
  return native ? native.width >= 760 : matchMedia("(min-width: 760px)").matches;
}
