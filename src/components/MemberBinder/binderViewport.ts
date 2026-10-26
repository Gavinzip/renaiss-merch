export const BINDER_NATIVE_VIEWPORT_EVENT = "merch-native-viewport";
export const BINDER_NATIVE_COVER_CACHED_EVENT = "merch-native-cover-cached";

/** The App publishes one geometry before notifying the responsive book. */
export function nativeBinderViewport() {
  const data = document.documentElement.dataset;
  if (data.merchNativeWidth === undefined) return null;
  const width = Number(data.merchNativeWidth);
  const height = Number(data.merchNativeHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error("Invalid native Merch viewport");
  return { width, height, preparing: data.merchNativePreparing === "true" };
}

export function reportNativeBinderCover(closed: boolean, instance: string, mounted = true, failed = false) {
  const native = window as Window & { webkit?: { messageHandlers?: {
    merchBinderState?: { postMessage: (state: { document: string; instance: string; closed: boolean; mounted: boolean; failed: boolean }) => void };
  } } };
  const documentID = document.documentElement.dataset.merchNativeDocument;
  if (documentID) native.webkit?.messageHandlers?.merchBinderState?.postMessage({ document: documentID, instance, closed, mounted, failed });
}

export function binderViewportIsWide() {
  const native = nativeBinderViewport();
  return native ? native.width >= 760 : matchMedia("(min-width: 760px)").matches;
}
