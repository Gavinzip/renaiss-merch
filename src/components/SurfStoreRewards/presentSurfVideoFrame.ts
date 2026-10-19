// Decoder events alone do not confirm a frame reached the video compositor.
// Both real video layers stay renderable behind the matching poster while
// warming; admission removes that poster only after the closed frame presents.
export function presentSurfVideoFrame(video: HTMLVideoElement, time: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    let callback = 0;
    function cleanup() {
      video.cancelVideoFrameCallback(callback);
      video.removeEventListener('error', fail);
      signal.removeEventListener('abort', fail);
    }
    function fail() {
      cleanup();
      reject(new Error('surf_reveal_presentation_unavailable'));
    }
    function presented(_now: number, metadata: VideoFrameCallbackMetadata) {
      if (Math.abs(metadata.mediaTime - time) > 1 / 24 + .001) {
        callback = video.requestVideoFrameCallback(presented);
        return;
      }
      video.dataset.presentedFrameTime = metadata.mediaTime.toFixed(6);
      cleanup();
      resolve();
    }
    if (signal.aborted || typeof video.requestVideoFrameCallback !== 'function') {
      reject(new Error('surf_reveal_presentation_unavailable'));
      return;
    }
    video.addEventListener('error', fail, { once: true });
    signal.addEventListener('abort', fail, { once: true });
    callback = video.requestVideoFrameCallback(presented);
    try { video.currentTime = time; }
    catch { fail(); }
  });
}
