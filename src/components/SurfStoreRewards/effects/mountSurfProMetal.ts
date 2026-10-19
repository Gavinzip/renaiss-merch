// Lifecycle adapted from gpu-effect/assets/integration/mountEffect.ts.
// Shader Effects Inc. shaders 4.0.0, MIT; license retained in docs/licenses/.
import { createGpuUniformsMap, getWebGPUSupport, rootPassthrough, shaderRendererGPU } from 'shaders/core';
import { surfProMetalDefinition, surfProMetalLight, surfProMetalProps } from './surfProMetal';

export type SurfProMetalStatus =
  | { state: 'checking' | 'initializing' | 'ready' | 'paused' }
  | { state: 'error'; reason: string };

export type SurfProMetalController = {
  setProgress: (progress: number) => void;
  destroy: () => void;
};

type Options = { disableTelemetry: true; onStatus: (status: SurfProMetalStatus) => void };

// Use the public core renderer and explicitly register just BrushedMetal.
// Its bundled registry remains part of the lazy engine; no telemetry collector
// is imported, and only this one material is mounted on the GPU graph.
export function mountSurfProMetal(canvas: HTMLCanvasElement, options: Options): SurfProMetalController {
  const renderer = shaderRendererGPU();
  const rootId = 'surf-pro-metal-root';
  const nodeId = 'surf-pro-metal';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let failed = false;
  let initialized = false;
  let painted = false;
  let inView = true;
  let pending = true;
  let drawing = false;
  let frame = 0;
  let progress = 0;
  let renderedProgress = -1;
  let frames = 0;
  let lastStatus = '';

  canvas.dataset.gpuTelemetry = options.disableTelemetry ? 'disabled' : 'enabled';
  canvas.dataset.gpuEffect = 'BrushedMetal';
  const timeout = window.setTimeout(() => fail('first-frame-timeout'), 15_000);

  function report(status: SurfProMetalStatus) {
    if (disposed || (failed && status.state !== 'error')) return;
    canvas.dataset.gpuState = status.state;
    if (status.state === 'error') canvas.dataset.gpuReason = status.reason;
    if (lastStatus !== status.state) { lastStatus = status.state; options.onStatus(status); }
  }
  function detach() {
    observer.disconnect(); resizeObserver.disconnect();
    reducedMotion.removeEventListener('change', invalidate);
    document.removeEventListener('visibilitychange', invalidate);
  }
  function fail(reason: string) {
    if (disposed || failed) return;
    failed = true;
    clearTimeout(timeout); cancelAnimationFrame(frame);
    detach(); renderer.stopAnimation();
    report({ state: 'error', reason });
    renderer.cleanup();
    console.error('[Surf Pro BrushedMetal]', reason);
  }
  function schedule() {
    if (disposed || failed || !initialized || frame || drawing) return;
    if (document.hidden || !inView) {
      renderer.stopAnimation(); canvas.dataset.gpuActive = 'false';
      if (painted) report({ state: 'paused' });
      return;
    }
    if (painted && !reducedMotion.matches && progress > 0 && progress < 1) {
      // The renderer submits normal animation frames without a GPU queue fence
      // for every scroll update. Fence only the first and settled endpoint frames.
      updateLight(progress);
      pending = false;
      renderer.startAnimation(); canvas.dataset.gpuActive = 'true';
      report({ state: 'ready' });
      return;
    }
    renderer.stopAnimation(); canvas.dataset.gpuActive = 'false';
    if (pending || !painted) frame = requestAnimationFrame(() => { frame = 0; void draw(); });
  }
  function updateLight(value: number) {
    const light = surfProMetalLight(value);
    renderer.updateUniformValue(nodeId, 'envRotation', light.envRotation);
    renderer.updateUniformValue(nodeId, 'lightAngle', light.lightAngle);
    canvas.dataset.gpuRequestedProgress = value.toFixed(4);
  }
  async function draw() {
    if (disposed || failed || document.hidden || !inView) return;
    drawing = true; pending = false;
    const currentProgress = reducedMotion.matches ? (progress >= .5 ? 1 : 0) : progress;
    updateLight(currentProgress);
    const started = performance.now();
    try {
      await renderer.renderAndWait({ waitForGpu: true });
      if (disposed || failed) return;
      const failure = renderer.getFailureReason();
      if (failure) { fail(failure); return; }
      if (painted) {
        clearTimeout(timeout);
        renderedProgress = currentProgress;
        canvas.dataset.gpuFrames = String(++frames);
        canvas.dataset.gpuProgress = currentProgress.toFixed(4);
        canvas.dataset.gpuFrameWaitMs = (performance.now() - started).toFixed(2);
        report({ state: pending ? 'ready' : 'paused' });
      } else pending = true; // Pipeline compilation has not presented its first frame yet.
    } catch (error) { fail(error instanceof Error ? error.message : String(error)); }
    finally { drawing = false; schedule(); }
  }
  function invalidate() {
    pending = true;
    if (document.hidden || !inView || reducedMotion.matches) {
      cancelAnimationFrame(frame); frame = 0;
      renderer.stopAnimation(); canvas.dataset.gpuActive = 'false';
    }
    schedule();
  }
  const observer = new IntersectionObserver(entries => {
    inView = entries.some(entry => entry.target === canvas && entry.isIntersecting);
    if (!inView || document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    invalidate();
  });
  const resizeObserver = new ResizeObserver(() => {
    if (!initialized || disposed || failed) return;
    renderer.resize(canvas.clientWidth, canvas.clientHeight);
    invalidate();
  });

  renderer.setOnReady(() => { painted = true; });
  renderer.setOnUnavailable(reason => fail(reason));
  renderer.setOnDeviceLost(reason => fail(`device-lost: ${reason}`));
  observer.observe(canvas); resizeObserver.observe(canvas);
  reducedMotion.addEventListener('change', invalidate);
  document.addEventListener('visibilitychange', invalidate);
  report({ state: 'checking' });

  void (async () => {
    try {
      const support = await getWebGPUSupport();
      if (disposed || failed) return;
      if (!support.supported) { fail(support.reason ?? 'unsupported'); return; }
      report({ state: 'initializing' });
      const values = Object.fromEntries(Object.entries(surfProMetalDefinition.props).map(([key, config]) =>
        [key, key in surfProMetalProps ? surfProMetalProps[key as keyof typeof surfProMetalProps] : config.default]));
      renderer.registerNode(rootId, rootPassthrough.fragment, null, null, {}, rootPassthrough);
      renderer.registerNode(nodeId, surfProMetalDefinition.fragment, rootId,
        { id: nodeId, blendMode: 'normal', opacity: 1, visible: true, renderOrder: 0 },
        // The package bridge erases prop types to unknown; its function parameter
        // variance rejects a typed built-in definition although every value is seeded.
        createGpuUniformsMap(surfProMetalDefinition as unknown as Parameters<typeof createGpuUniformsMap>[0], values, nodeId), surfProMetalDefinition);
      await renderer.initialize({ canvas, observeElement: false, colorSpace: 'srgb', toneMapping: 'linear', enablePerformanceTracking: true });
      renderer.stopAnimation();
      if (disposed || failed) { renderer.cleanup(); return; }
      const failure = renderer.getFailureReason();
      if (failure || !renderer.isInitialized()) { fail(failure ?? 'init-failed'); return; }
      initialized = true;
      canvas.dataset.gpuRenderer = renderer.getRendererType()!;
      const device = renderer.getInternalRenderer();
      if (device?.adapter) {
        canvas.dataset.gpuVendor = device.adapter.info.vendor;
        canvas.dataset.gpuArchitecture = device.adapter.info.architecture;
        canvas.dataset.gpuDevice = device.adapter.info.device;
      }
      renderer.resize(canvas.clientWidth, canvas.clientHeight);
      schedule();
    } catch (error) { fail(error instanceof Error ? error.message : String(error)); }
  })();

  return {
    setProgress(next) {
      if (disposed || failed) return;
      progress = Math.min(1, Math.max(0, next));
      if (progress !== renderedProgress) invalidate();
    },
    destroy() {
      disposed = true;
      clearTimeout(timeout); cancelAnimationFrame(frame);
      detach(); renderer.stopAnimation(); renderer.cleanup();
    }
  };
}
