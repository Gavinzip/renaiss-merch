let runtime: Promise<typeof import('./mountSurfProMetal')> | undefined;

// Load the GPU engine on membership intent, independently of the Box reveal.
export function loadSurfProMetal() {
  if (!runtime) {
    let timeout: ReturnType<typeof setTimeout>;
    runtime = Promise.race([
      import('./mountSurfProMetal'),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('gpu-module-timeout')), 12_000);
      })
    ]).catch(error => { runtime = undefined; throw error; })
      .finally(() => clearTimeout(timeout));
  }
  return runtime;
}

export function prepareSurfProMetal() {
  // Opening the scene retries any failed preload and exposes its error there.
  void loadSurfProMetal().catch(() => undefined);
}
