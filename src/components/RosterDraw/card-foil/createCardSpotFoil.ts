// Shader Effects Inc. shaders 4.0.0, MIT (docs/licenses). Direct core renderer:
// no telemetry collector, one WebGPU pass, finite input-driven frame updates.
import { createGpuUniformsMap, getWebGPUSupport, rootPassthrough, shaderRendererGPU } from 'shaders/core';
import type { CeremonyArtwork } from '../../RenaissHub/draw-effects/batch-ceremony/ceremonyArtwork';
import { spotFoilShader } from './spotFoilShader';
import { createCardFoilPrint } from './cardFoilPrint';
import { PRO_BOOSTER, proDealDuration } from '../../RenaissHub/draw-effects/batch-ceremony/proBoosterTimeline';

export type CardSpotFoil = Awaited<ReturnType<typeof createCardSpotFoil>>;
export async function createCardSpotFoil(card: HTMLElement, art: CeremonyArtwork,
  onPrint: () => void, onError: (message: string) => void, signal: AbortSignal) {
  const support = await getWebGPUSupport(); signal.throwIfAborted();
  if (!support.supported) throw new Error(`Card foil WebGPU: ${support.reason}`);
  const renderer = shaderRendererGPU(), field = document.createElement('canvas');
  const print = createCardFoilPrint(card, art), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const values = { light: -.3, strength: 0, angle: 0 }, nodeId = 'renaiss-spot-foil';
  let disposed = false, failed = false, painted = false, ready = false, visible = true;
  let frame = 0, drawing = false, dirty = true, frames = 0, flipAt = -Infinity;
  let lastTurning = false;
  card.dataset.foilState = 'preparing'; card.dataset.foilTelemetry = 'disabled';
  const timeout = setTimeout(() => fail('Card foil first frame timed out'), 12000);
  function fail(reason: string) {
    if (disposed || failed) return;
    failed = true; card.dataset.foilState = 'error'; card.dataset.foilError = reason;
    dispose(); onError(reason);
  }
  function schedule() {
    if (!ready || disposed || failed || frame || drawing || document.hidden || !visible) return;
    frame = requestAnimationFrame(() => { frame = 0; void draw(); });
  }
  async function draw() {
    if (disposed || failed || document.hidden || !visible) return;
    drawing = true; dirty = false;
    const flip = Math.min(1, (performance.now() - flipAt) / 1050), active = flip < 1 && !reduced.matches;
    const next = active ? { light: -.2 + flip * 1.75, strength: Math.sin(Math.PI * flip) * .72, angle: flip - .5 } : values;
    for (const [name, value] of Object.entries(next)) renderer.updateUniformValue(nodeId, name, reduced.matches ? 0 : value);
    const start = performance.now();
    try {
      await renderer.renderAndWait();
      if (disposed || failed) return;
      const error = renderer.getFailureReason(); if (error) throw new Error(error);
      if (!painted) { dirty = true; return; }
      print.compose(field); onPrint();
      card.dataset.foilFrames = String(++frames);
      card.dataset.foilFrameMs = (performance.now() - start).toFixed(2);
      card.dataset.foilState = 'ready'; card.dataset.foilActive = String(active || dirty);
    } catch (error) { fail(String(error)); }
    finally { drawing = false; if (active || dirty) schedule(); }
  }
  function set(light: number, strength: number, angle = 0) {
    if (values.light === light && values.strength === strength && values.angle === angle) return;
    Object.assign(values, { light, strength, angle }); dirty = true; schedule();
  }
  function pointer(event: PointerEvent) {
    if (card.dataset.turning === 'true' || reduced.matches) return;
    const rect = card.getBoundingClientRect(), x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = (event.clientY - rect.top) / rect.height;
    set(.15 + x, .52, x + y * .25 - .5);
  }
  function leave() { set(-.3, 0); }
  const mutation = new MutationObserver(() => {
    const turning = card.dataset.turning === 'true';
    if (turning && !lastTurning) { flipAt = performance.now(); leave(); dirty = true; schedule(); }
    lastTurning = turning;
  });
  function visibility() {
    if (document.hidden || !visible) { cancelAnimationFrame(frame); frame = 0; card.dataset.foilActive = 'false'; }
    else { dirty = true; schedule(); }
  }
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visibility(); });
  function dispose() {
    if (disposed) return; disposed = true; clearTimeout(timeout); cancelAnimationFrame(frame);
    mutation.disconnect(); intersection.disconnect();
    card.removeEventListener('pointermove', pointer); card.removeEventListener('pointerleave', leave);
    document.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', visibility);
    signal.removeEventListener('abort', dispose); renderer.stopAnimation(); renderer.cleanup();
    card.dataset.foilActive = 'false';
  }
  try {
    signal.addEventListener('abort', dispose, { once: true });
    renderer.setOnReady(() => { painted = true; });
    renderer.setOnUnavailable(fail); renderer.setOnDeviceLost(fail);
    renderer.registerNode('spot-root', rootPassthrough.fragment, null, null, {}, rootPassthrough);
    renderer.registerNode(nodeId, spotFoilShader.fragment, 'spot-root',
      { id: nodeId, blendMode: 'normal', opacity: 1, visible: true, renderOrder: 0 },
      createGpuUniformsMap(spotFoilShader as unknown as Parameters<typeof createGpuUniformsMap>[0], values, nodeId), spotFoilShader);
    await renderer.initialize({ canvas: field, observeElement: false, colorSpace: 'srgb', toneMapping: 'linear' });
    renderer.stopAnimation(); signal.throwIfAborted();
    if (failed || !renderer.isInitialized()) throw new Error(renderer.getFailureReason() || 'Card foil initialization failed');
    renderer.setResolutionScale(2 / devicePixelRatio); renderer.resize(520, 325);
    do {
      await renderer.renderAndWait(); signal.throwIfAborted();
      if (failed) throw new Error('Card foil preparation failed');
      if (!painted) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    } while (!painted);
    print.compose(field); clearTimeout(timeout); ready = true;
    card.dataset.foilRenderer = renderer.getRendererType()!; card.dataset.foilState = 'ready';
    mutation.observe(card, { attributes: true, attributeFilter: ['data-turning'] });
    intersection.observe(card);
    card.addEventListener('pointermove', pointer); card.addEventListener('pointerleave', leave);
    document.addEventListener('visibilitychange', visibility); reduced.addEventListener('change', visibility);
  } catch (error) { dispose(); throw error; }
  return {
    print: print.canvas,
    flight(age: number) {
      const progress = Math.max(0, Math.min(1, (age - PRO_BOOSTER.clear) / (proDealDuration(1) - PRO_BOOSTER.clear)));
      set(-.2 + progress * 1.75, Math.sin(Math.PI * progress) * .65, progress - .5);
    },
    resize() { print.resize(); dirty = true; schedule(); },
    dispose,
  };
}
