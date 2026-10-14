// Lifecycle uses gpu-effect's WebGPU support/admission contract. Shader Effects
// Inc. shaders 4.0.0 is MIT; its license is retained in docs/licenses/.
import { createGpuUniformsMap, getWebGPUSupport, rootPassthrough, shaderRendererGPU } from 'shaders/core';
import type { RevealPhase } from '../useSurfDrawPresentation';
import { surfAtmosphereDefinition } from './surfAtmosphereShaders';
import { sampleSurfAtmosphere } from './surfAtmosphereChoreography';
import { sampleSurfField, surfFieldDefinition, surfFieldProps } from './surfAtmosphereField';

export type AtmosphereState = { phase: RevealPhase; stops: number; revision: number; batch?: boolean; boxBatch?: boolean };
type Callbacks = { onReady: () => void; onError: (message: string) => void };

// One stable canvas: a pearl substrate plus the library's layered Aurora.
// Its animation clock follows the real draw. DOM is never captured.
export function createSurfDrawAtmosphere(canvas: HTMLCanvasElement, callbacks: Callbacks) {
  const renderer = shaderRendererGPU();
  const nodeId = 'surf-optical-chamber';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let state: AtmosphereState = { phase: 'idle', stops: 0, revision: -1 };
  let disposed = false, failed = false, initialized = false, admitted = false, painted = false, inView = true;
  let frame = 0, previous = 0, travel = 0, frames = 0;
  let changedAt = performance.now(), stoppedAt = -10000, releaseAt: number | null = null;
  const values = { travel: 0, energy: .035, gather: 0, release: 0, expansion: 0, anticipation: 0, pulse: 0 };
  canvas.dataset.renderer = 'preparing';
  canvas.dataset.gpuEffect = 'Aurora';
  canvas.dataset.gpuTelemetry = 'disabled';
  const timeout = window.setTimeout(() => fail('WebGPU scene preparation timed out.'), 15000);

  function fail(reason: string) {
    if (disposed || failed) return;
    failed = true; admitted = false;
    clearTimeout(timeout); cancelAnimationFrame(frame); frame = 0;
    renderer.stopAnimation(); renderer.cleanup();
    canvas.dataset.renderer = 'error'; canvas.dataset.gpuReason = reason;
    callbacks.onError(reason);
  }
  function write() {
    for (const name of ['travel', 'energy', 'release', 'expansion', 'pulse'] as const) renderer.updateUniformValue(nodeId, name, values[name]);
    const moving = state.phase === 'spinning' || state.phase === 'settling';
    const field = sampleSurfField(values.energy, values.gather, values.release, moving);
    for (const [name, value] of Object.entries(field)) {
      renderer.updateUniformValue('surf-light-volume', name, reduced.matches && name === 'speed' ? 0 : value);
    }
    canvas.dataset.gpuWaveSpeed = (reduced.matches ? 0 : field.speed).toFixed(2);
  }
  function resize() {
    if (!initialized || disposed || failed) return;
    const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
    // Scale is relative to the engine DPR. Bound backing pixels without changing
    // the DOM canvas or the optical coordinate system.
    const scale = Math.min(1, 1.5 / devicePixelRatio, Math.sqrt(1_800_000 / (width * height)) / devicePixelRatio);
    renderer.setResolutionScale(scale); renderer.resize(width, height);
    wake();
  }
  function update(now: number) {
    frame = 0;
    if (disposed || failed || !admitted || document.hidden || !inView) return;
    const dt = previous ? Math.min(.05, (now - previous) / 1000) : 0;
    previous = now;
    const cue = sampleSurfAtmosphere(state.phase, state.stops, (now - changedAt) / 1000,
      releaseAt === null ? null : (now - releaseAt) / 1000, state.batch, state.boxBatch);
    const approach = (current: number, target: number, speed: number) => current + (target - current) * Math.min(1, dt * speed + .02);
    if (!reduced.matches) travel += dt * cue.speed;
    values.travel = travel;
    values.energy = approach(values.energy, reduced.matches ? .05 : cue.energy, 5);
    values.gather = approach(values.gather, cue.gather, 5);
    values.release = approach(values.release, reduced.matches ? 0 : cue.release, 12);
    values.expansion = approach(values.expansion, reduced.matches ? 0 : cue.expansion, 4);
    values.anticipation = approach(values.anticipation, reduced.matches ? 0 : cue.anticipation, 8);
    values.pulse = reduced.matches ? 0 : Math.exp(-(now - stoppedAt) / 210) * .055;
    write();
    canvas.dataset.phase = state.phase;
    canvas.dataset.frames = String(++frames);
    canvas.dataset.energy = values.energy.toFixed(2);
    canvas.dataset.travel = travel.toFixed(2);
    canvas.dataset.release = values.release.toFixed(2);
    canvas.dataset.anticipation = values.anticipation.toFixed(2);
    const active = !reduced.matches && cue.run;
    canvas.dataset.gpuActive = String(active);
    if (frames % 30 === 0) {
      const stats = renderer.getPerformanceStats();
      canvas.dataset.gpuFps = stats.fps.toFixed(1);
      canvas.dataset.gpuFrameMs = stats.avgFrameTime.toFixed(2);
    }
    if (active) {
      renderer.startAnimation(); frame = requestAnimationFrame(update);
    } else {
      renderer.stopAnimation();
      // Fence the actual endpoint only, never every animation frame.
      void renderer.renderAndWait().catch(error => fail(String(error)));
    }
  }
  function wake() { previous = 0; if (admitted && !frame && !document.hidden && inView) frame = requestAnimationFrame(update); }
  function visibility() {
    if (document.hidden || !inView || reduced.matches) {
      cancelAnimationFrame(frame); frame = 0; renderer.stopAnimation(); canvas.dataset.gpuActive = 'false';
    }
    wake();
  }
  const observer = new ResizeObserver(resize);
  const intersection = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.target === canvas) inView = entry.isIntersecting;
    visibility();
  });
  renderer.setOnReady(() => { painted = true; });
  renderer.setOnUnavailable(reason => fail(`WebGPU: ${reason}`));
  renderer.setOnDeviceLost(reason => fail(`WebGPU device lost: ${reason}`));
  observer.observe(canvas); intersection.observe(canvas);
  document.addEventListener('visibilitychange', visibility);
  reduced.addEventListener('change', visibility);

  void (async () => {
    try {
      const support = await getWebGPUSupport();
      if (disposed || failed) return;
      if (!support.supported) { fail(`WebGPU: ${support.reason ?? 'adapter/device unavailable'}`); return; }
      renderer.registerNode('surf-optical-root', rootPassthrough.fragment, null, null, {}, rootPassthrough);
      renderer.registerNode(nodeId, surfAtmosphereDefinition.fragment, 'surf-optical-root',
        { id: nodeId, blendMode: 'normal', opacity: 1, visible: true, renderOrder: 0 },
        createGpuUniformsMap(surfAtmosphereDefinition as unknown as Parameters<typeof createGpuUniformsMap>[0], values, nodeId), surfAtmosphereDefinition);
      renderer.registerNode('surf-light-volume', surfFieldDefinition.fragment, 'surf-optical-root',
        { id: 'surf-light-volume', blendMode: 'normal', opacity: .85, visible: true, renderOrder: 1 },
        createGpuUniformsMap(surfFieldDefinition as unknown as Parameters<typeof createGpuUniformsMap>[0], surfFieldProps, 'surf-light-volume'), surfFieldDefinition);
      await renderer.initialize({ canvas, observeElement: false, colorSpace: 'srgb', toneMapping: 'linear', enablePerformanceTracking: true });
      renderer.stopAnimation();
      if (disposed || failed) { renderer.cleanup(); return; }
      if (!renderer.isInitialized() || renderer.getFailureReason()) { fail(renderer.getFailureReason() ?? 'WebGPU initialization failed.'); return; }
      initialized = true; resize();
      const adapter = renderer.getInternalRenderer()?.adapter;
      canvas.dataset.gpuRenderer = renderer.getRendererType()!;
      canvas.dataset.gpuVendor = adapter?.info.vendor ?? '';
      canvas.dataset.gpuArchitecture = adapter?.info.architecture ?? '';
      // Warm the actual pass and endpoints. A submitted queue and first paint
      // must both finish before controls admit a new draw.
      for (const [energy, gather, release, expansion] of [[1,0,0,0], [.035,1,0,0], [.035,1,1,.4], [.035,0,0,0]]) {
        values.energy = energy; values.gather = gather; values.release = release; values.expansion = expansion; write();
        do {
          await renderer.renderAndWait();
          if (disposed || failed) return;
          if (!painted) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        } while (!painted);
      }
      clearTimeout(timeout); admitted = true; canvas.dataset.renderer = 'ready';
      callbacks.onReady(); wake();
    } catch (error) { fail(error instanceof Error ? error.message : String(error)); }
  })();

  return {
    setState(next: AtmosphereState) {
      const now = performance.now();
      if (next.stops > state.stops) stoppedAt = now;
      if (next.phase === 'spinning' || next.phase === 'idle') releaseAt = null;
      else if (next.batch && next.phase === 'settling' && state.phase !== 'settling') releaseAt = now;
      else if (!next.batch && next.phase === 'identity' && state.phase !== 'identity') releaseAt = now;
      if (next.phase !== state.phase && !(state.phase === 'identity' && next.phase === 'revealed') || next.revision !== state.revision) changedAt = now;
      state = next; wake();
    },
    dispose() {
      disposed = true; clearTimeout(timeout); cancelAnimationFrame(frame);
      observer.disconnect(); intersection.disconnect();
      document.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', visibility);
      renderer.stopAnimation(); renderer.cleanup();
    },
  };
}
