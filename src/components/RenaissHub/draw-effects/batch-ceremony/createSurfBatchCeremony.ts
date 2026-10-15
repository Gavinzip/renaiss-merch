import * as THREE from 'three';
import { createFilmBoxEnvironment } from '../film-box/filmBoxStudio';
import { loadFilmBoxAtlas } from '../film-box/filmBoxTextureAtlas';
import type { RevealPhase } from '../../useSurfDrawPresentation';
import type { Prize } from '../../useSurfDraw';
import { createSurfCeremonyBox } from './createSurfCeremonyBox';
import { createSurfCeremonyRetreat } from './createSurfCeremonyRetreat';
import { createSurfCeremonyCard } from './createSurfCeremonyCards';
import { createSurfCeremonyBurst } from './createSurfCeremonyBurst';
import { createSurfCeremonyWhiteout } from './createSurfCeremonyWhiteout';
import { prepareCeremonyArtwork, cardBack, cardTicketBack, credential, canvasTexture } from './ceremonyArtwork';
import { createSurfProBooster } from './createSurfProBooster';
import { PRO_BOOSTER, proCardFlight, proDealDuration, proBoosterLayout, proAgeForTear } from './proBoosterTimeline';
import { PRO_TEAR_FROM_TOP } from './proBoosterGeometry';
import { createRewardLandingShadow } from './createRewardLandingShadow';
import type { CardSpotFoil } from '../../../RosterDraw/card-foil/createCardSpotFoil';
import { CEREMONY, boxCardFlight, boxCeremonyDuration, smooth, type CeremonyLayout } from './ceremonyTimeline';

export type CeremonyState = { phase: RevealPhase; revision: number; kind: Prize['kind']; duration: string; confirmed: number };
type Callbacks = { onReady: () => void; onError: (message: string) => void; onSettled: () => void;
  onCardRevealed: (index: number) => void; onRevealed: () => void };

// Three.js owns the box and flight. At the ticket hold it hands each parked
// card to its DOM faces, which retain their typography throughout a click turn.
export async function createSurfBatchCeremony(root: HTMLDivElement, canvas: HTMLCanvasElement,
  assets: { logos: { renaiss: string; surf: string }; images: ImageBitmap[]; brand?: 'surf' | 'renaiss' }, initial: CeremonyState, callbacks: Callbacks, signal: AbortSignal) {
  const art = { ...await prepareCeremonyArtwork(assets.logos, assets.images), brand: assets.brand }; signal.throwIfAborted();
  const boxAtlas = await loadFilmBoxAtlas(signal); signal.throwIfAborted();
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0xffffff, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 20000); camera.position.z = 14000;
  const environment = createFilmBoxEnvironment(renderer); scene.environment = environment.texture; scene.environmentIntensity = .8;
  const fill = new THREE.HemisphereLight('#fffdf9', '#9c9cae', .65); scene.add(fill);
  const key = new THREE.DirectionalLight('#fff5e3', 2.4); key.position.set(-300, 500, 800); scene.add(key);
  const rim = new THREE.DirectionalLight('#b6d4ef', 1.3); rim.position.set(500, 100, 100); scene.add(rim);
  const sharedBack = canvasTexture(cardBack(art), true);
  const box = createSurfCeremonyBox(scene,boxAtlas), burst = createSurfCeremonyBurst(scene);
  const whiteout = createSurfCeremonyWhiteout();
  const retreat = createSurfCeremonyRetreat(scene, camera, renderer, box.root, [fill, key, rim]);
  const models = Array.from({ length: 20 }, () => { const card = createSurfCeremonyCard(sharedBack, sharedBack); card.resize(275, 172); scene.add(card.group); return card; });
  let proArt = credential(art, initial.duration);
  const booster = createSurfProBooster(scene, renderer, art);
  const landingShadow = art.brand === 'renaiss' ? createRewardLandingShadow(root) : null;
  let panelActive = true;
  let spinFinished: ((index: number | null) => void) | null = null;
  let packOpened = false, packPreview = 0, returningPreview = false;
  const shadowArt = document.createElement('canvas'); shadowArt.width = 256; shadowArt.height = 64;
  const shadowPen = shadowArt.getContext('2d')!; shadowPen.scale(1, .25);
  const shadowGradient = shadowPen.createRadialGradient(128, 128, 12, 128, 128, 128);
  shadowGradient.addColorStop(0, '#3230414d'); shadowGradient.addColorStop(.45, '#32304125'); shadowGradient.addColorStop(1, '#32304100');
  shadowPen.fillStyle = shadowGradient; shadowPen.fillRect(0, 0, 256, 256);
  const shadowTexture = canvasTexture(shadowArt), shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false });
  const shadowGeometry = new THREE.PlaneGeometry(1, 1), shadow = new THREE.Mesh(shadowGeometry, shadowMaterial); scene.add(shadow);
  const textures = new Map<number, { front?: THREE.Texture; back?: THREE.Texture }>();
  let spotFoil: CardSpotFoil | null = null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let state = initial, age = 0, frame = 0, lastTime = 0, disposed = false, failed = false, completed = false, visible = true;
  const revealed = new Set<number>();
  let layout!: CeremonyLayout;
  let screenLeft = 0, screenTop = 0;
  let nodes: HTMLElement[] = [], ratio = 1, renderWidth = 0, renderHeight = 0, printedGeometry = '';
  const observedCards = new Set<HTMLElement>();
  canvas.dataset.engine = 'three';
  const flash = root.querySelector<HTMLElement>('.surf-batch-flash')!;
  function measure() {
    const rect = root.getBoundingClientRect(), gallery = root.querySelector<HTMLElement>('.surf-batch-gallery')!, area = gallery.getBoundingClientRect();
    screenLeft = rect.left; screenTop = rect.top;
    root.style.setProperty('--surf-batch-gallery-top', `${Math.max(0, area.top - rect.top)}px`);
    nodes = [...root.querySelectorAll<HTMLElement>('.surf-batch-card')];
    for (const node of observedCards) if (!nodes.includes(node)) { resizeObserver.unobserve(node); observedCards.delete(node); }
    for (const node of nodes) if (!observedCards.has(node)) { resizeObserver.observe(node); observedCards.add(node); }
    const height = Math.max(1, rect.height), width = Math.max(1, rect.width);
    layout = { width, height, emitter: { x: width / 2, y: area.top - rect.top + area.height * .49, z: 100 }, safeTop: area.top - rect.top, safeBottom: Math.max(0, rect.bottom - area.bottom), center: { x: width / 2, y: area.top - rect.top + area.height * .49 },
      unit: Math.min(width * .78, area.height * .82, 480) / 1.8,
      cards: nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.left - rect.left + r.width / 2, y: r.top - rect.top + r.height / 2, width: r.width, height: r.height }; }) };
    const settled = state.phase === 'ticket' || state.phase === 'identity' || state.phase === 'revealed';
    // The departing foil must clear the viewport, not hit an invisible stage
    // boundary halfway down the page. Layout/card coordinates remain unchanged.
    const drawingHeight = state.kind === 'surf-pro-month' && state.phase === 'settling'
      ? Math.max(height, window.innerHeight - rect.top + 32) : height;
    const pixelBudget = settled ? 4_500_000 : 3_600_000;
    ratio = Math.min(2, devicePixelRatio || 1, Math.sqrt(pixelBudget / (width * drawingHeight)));
    if (width !== renderWidth || drawingHeight !== renderHeight || ratio !== renderer.getPixelRatio()) {
      renderer.setPixelRatio(ratio); renderer.setSize(width, drawingHeight, false);
      canvas.style.height = `${drawingHeight}px`;
      retreat.resize(width, drawingHeight, ratio); renderWidth = width; renderHeight = drawingHeight;
    }
    camera.left = -width / 2; camera.right = width / 2; camera.top = height / 2; camera.bottom = height / 2 - drawingHeight; camera.updateProjectionMatrix();
    layout.cards.forEach((card, i) => {
      const face = nodes[i].querySelector<HTMLElement>('.surf-batch-card__face')!;
      models[i].resize(card.width, card.height, parseFloat(getComputedStyle(face).borderTopLeftRadius));
    });
    const pack = proBoosterLayout(layout);
    root.style.setProperty('--pro-pack-spacing', `${pack.width * 1.04}px`);
    root.style.setProperty('--pro-pack-x', `${pack.x}px`);
    root.style.setProperty('--pro-pack-y', `${pack.y}px`);
    root.style.setProperty('--pro-pack-width', `${pack.width}px`);
    root.style.setProperty('--pro-pack-height', `${pack.height}px`);
    root.style.setProperty('--pro-seal-offset', String(.5 - PRO_TEAR_FROM_TOP));
  }
  function replacePrint(i: number, face: 'front' | 'back', image: HTMLCanvasElement) {
    const previous = textures.get(i) || {}, texture = canvasTexture(image, true);
    renderer.initTexture(texture); models[i][face].material.map = texture; previous[face]?.dispose(); previous[face] = texture; textures.set(i, previous);
  }
  function printGeometry() { return layout.cards.map(card => `${card.width.toFixed(2)}x${card.height.toFixed(2)}`).join('|'); }
  function updatePrints() {
    spotFoil?.resize();
    if (state.phase === 'idle' || state.phase === 'spinning') nodes.forEach((node, i) => {
      replacePrint(i, 'back', cardBack(art, '', node.querySelector('.surf-batch-card__top > span')?.textContent || ''));
    });
    if (state.phase === 'settling' || state.phase === 'ticket') nodes.forEach((node, i) => {
      const ticket = i === 0 && spotFoil ? spotFoil.print : cardTicketBack(node, art, proArt);
      replacePrint(i, 'back', ticket);
    });
    printedGeometry = printGeometry();
  }
  function paint() {
    if (disposed || failed || !layout) return;
    const boxFrame=box.render(state.kind === 'mystery-box' ? state.phase : 'revealed', age, layout, reduced.matches);
    if(state.kind !== 'mystery-box') layout.emitter={x:layout.center.x,y:layout.center.y,z:100};
    const proFrame = booster.render(state.kind === 'surf-pro-month' ? state.phase : 'revealed', age, layout, packOpened && booster.carousel.settled, packPreview, reduced.matches);
    root.style.setProperty('--pro-pack-x', `${proFrame.x}px`);
    root.style.setProperty('--pro-pack-y', `${proFrame.y}px`);
    root.style.setProperty('--pro-pack-width', `${proFrame.width}px`);
    root.style.setProperty('--pro-pack-height', `${proFrame.height}px`);
    shadow.visible = state.kind === 'mystery-box' ? boxFrame.visible : booster.root.visible;
    shadow.position.set(0, layout.height / 2 - (state.kind === 'mystery-box' ? boxFrame.floorY : proFrame.y + proFrame.height / 2 + 16), -500);
    shadow.scale.set(state.kind === 'mystery-box' ? boxFrame.size * 2.25 : proFrame.width * 1.3,
      state.kind === 'mystery-box' ? boxFrame.size * .3 : 30, 1);
    shadowMaterial.opacity = state.kind === 'mystery-box' ? boxFrame.opacity : proFrame.opacity * .5;
    burst.render(state.kind === 'mystery-box' ? state.phase : 'idle', age, layout, ratio, reduced.matches);
    whiteout.render(state.phase, state.kind, age, reduced.matches,
      { x: screenLeft + boxFrame.light.x, y: screenTop + boxFrame.light.y, width: boxFrame.light.width });
    const impactAge = age - CEREMONY.burst;
    const cavityGlow = smooth((age - CEREMONY.sealBreakEnd) / .36)
      * (1 - smooth((age - CEREMONY.launch - .65) / 1.4));
    const burstGlow = impactAge >= 0 ? .26 * Math.exp(-impactAge * 7) : 0;
    flash.style.opacity = state.phase === 'settling' && state.kind === 'mystery-box' && !reduced.matches
      ? String(cavityGlow * .32 + burstGlow) : '0';
    flash.style.setProperty('--burst-y', `${layout.emitter.y}px`);

    if (landingShadow && layout.cards[0]) {
      const target = layout.cards[0], parked = state.phase === 'identity' || state.phase === 'revealed';
      const pose = parked ? { ...target, scale: 1, rz: 0 } : proCardFlight(age, 0, target, layout);
      landingShadow.render(target, pose, parked ? 1 : (age - PRO_BOOSTER.deal + .15) / .55, parked);
    }
    models.forEach((model, i) => {
      const target = layout.cards[i]; model.group.visible = false;
      if (!target || state.phase === 'identity' || state.phase === 'revealed') return;
      if (state.phase === 'idle' || state.phase === 'spinning') return;
      if (state.kind === 'surf-pro-month' && state.phase === 'settling' && (!packOpened || !booster.carousel.settled)) return;
      const flight = state.kind === 'mystery-box' ? boxCardFlight(age, i, target, layout) : proCardFlight(age, i, target, layout);
      if (i === 0 && state.phase === 'settling') spotFoil?.flight(age);
      if (state.phase === 'settling') {
        model.group.visible = !reduced.matches && flight.progress > 0;
        model.group.position.set(flight.x - layout.width / 2, layout.height / 2 - flight.y, flight.z);
        model.group.scale.setScalar(flight.scale);
        if ('depthScale' in flight && typeof flight.depthScale === 'number') model.group.scale.z *= flight.depthScale;
        model.group.rotation.set(flight.rx, flight.ry, flight.rz);
      } else {
        model.group.visible = !reduced.matches;
        model.group.position.set(target.x - layout.width / 2, layout.height / 2 - target.y, 180 + (nodes.length - i) * Math.hypot(target.width, target.height));
        model.group.scale.setScalar(1); model.group.rotation.set(0, Math.PI, 0);
      }
    });
    retreat.draw(boxFrame.opacity); canvas.dataset.drawCalls = String(renderer.info.render.calls); canvas.dataset.triangles = String(renderer.info.render.triangles); canvas.dataset.phase = state.phase; canvas.dataset.handed = String(revealed.size);
    if (!completed && state.phase === 'settling' && (state.kind !== 'surf-pro-month' || packOpened) && (reduced.matches || age >= (state.kind === 'surf-pro-month' ? proDealDuration(nodes.length) : boxCeremonyDuration(nodes.length)))) { completed = true; callbacks.onSettled(); }
  }
  function fail(error: unknown) { if (disposed || failed) return; failed = true; cancelAnimationFrame(frame); frame = 0; canvas.dataset.rendering = 'false'; callbacks.onError(error instanceof Error ? error.message : String(error)); }
  function tick(now: number) {
    frame = 0; if (disposed || failed || document.hidden || !visible || !panelActive) return;
    const delta = lastTime ? Math.min(.05, (now - lastTime) / 1000) : 1 / 60;
    if (state.kind !== 'surf-pro-month' || state.phase !== 'settling' || packOpened && booster.carousel.settled) age += delta;
    if (returningPreview) {
      packPreview *= Math.exp(-delta * 12);
      if (packPreview < .002) { packPreview = 0; returningPreview = false; }
    }
    booster.carousel.advance(delta, reduced.matches); lastTime = now;
    if (spinFinished && !booster.carousel.spinning) { const done = spinFinished; spinFinished = null; canvas.dataset.carouselStoppedAt = performance.now().toFixed(1); done(booster.carousel.selected); }
    canvas.dataset.carouselPosition = booster.carousel.position.toFixed(3);
    canvas.dataset.carouselSpinning = String(booster.carousel.spinning);
    try { paint(); } catch (error) { fail(error); return; }
    const active = state.kind === 'surf-pro-month' && (booster.carousel.moving || returningPreview) || state.phase === 'spinning' || state.phase === 'settling' && (state.kind !== 'surf-pro-month' || packOpened);
    canvas.dataset.rendering = String(active && !reduced.matches && !completed);
    if (active && !reduced.matches && !completed) frame = requestAnimationFrame(tick);
  }
  function request() { lastTime = 0; cancelAnimationFrame(frame); frame = 0; if (!document.hidden && visible && panelActive && !failed && !disposed) frame = requestAnimationFrame(tick); }
  function visibility() { if (document.hidden || !visible || !panelActive) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; canvas.dataset.rendering = 'false'; } else request(); }
  function resize() { if (disposed || failed) return; try {
    if (!panelActive) return;
    measure();
    if (printGeometry() !== printedGeometry) updatePrints();
    paint();
  } catch (error) { fail(error); } }
  const resizeObserver = new ResizeObserver(resize), visibilityObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; visibility(); });
  const gallery = root.querySelector('.surf-batch-gallery')!;
  const lost = (event: Event) => { event.preventDefault(); fail(new Error('The 3D ceremony lost its graphics context. Reload to retry.')); };
  function dispose() {
    if (disposed) return; disposed = true; spinFinished?.(null); spinFinished = null; cancelAnimationFrame(frame); resizeObserver.disconnect(); visibilityObserver.disconnect();
    reduced.removeEventListener('change', request); document.removeEventListener('visibilitychange', visibility); gallery.removeEventListener('scroll', resize); canvas.removeEventListener('webglcontextlost', lost);
    signal.removeEventListener('abort', dispose);
    landingShadow?.dispose();
    spotFoil?.dispose();
    whiteout.dispose(); retreat.dispose(); box.dispose(); burst.dispose(); models.forEach(model => model.dispose()); booster.dispose(); shadowGeometry.dispose(); shadowMaterial.dispose(); shadowTexture.dispose(); sharedBack.dispose(); textures.forEach(pair => { pair.front?.dispose(); pair.back?.dispose(); }); environment.dispose(); renderer.dispose();
    canvas.dataset.rendering = 'false';
  }
  try {
    signal.addEventListener('abort', dispose, { once: true });
    measure();
    if (art.brand === 'renaiss') {
      const { createCardSpotFoil } = await import('../../../RosterDraw/card-foil/createCardSpotFoil');
      signal.throwIfAborted();
      spotFoil = await createCardSpotFoil(nodes[0], art, () => {
        const texture = models[0].back.material.map; if (texture) texture.needsUpdate = true;
      }, reason => fail(new Error(reason)), signal);
      signal.throwIfAborted();
      updatePrints();
    }
    models.forEach(model => { model.group.visible = true; }); booster.render('idle', 0, layout, false, 0, false);
    box.render('settling', .9, layout, false); burst.render('settling', 1.1, layout, ratio, false);
    await renderer.compileAsync(scene, camera); signal.throwIfAborted();
    renderer.initTexture(sharedBack); renderer.render(scene, camera); renderer.getContext().finish();
    const gpuError = renderer.getContext().getError(); if (gpuError !== 0) throw new Error(`3D ceremony preparation failed (${gpuError})`);
    canvas.dataset.prepared = 'true'; canvas.dataset.preparedAt = performance.now().toFixed(1); models.forEach(model => { model.group.visible = false; }); paint();
    resizeObserver.observe(root); resizeObserver.observe(gallery); visibilityObserver.observe(root); reduced.addEventListener('change', request); document.addEventListener('visibilitychange', visibility); gallery.addEventListener('scroll', resize, { passive: true }); canvas.addEventListener('webglcontextlost', lost);
    callbacks.onReady(); request();
  } catch (error) { dispose(); throw error; }
  return {
    setActive(active: boolean) { panelActive = active; if (active) resize(); visibility(); },
    spinPacks(): Promise<number | null> {
      if (disposed || failed || !panelActive || state.kind !== 'surf-pro-month' || state.phase !== 'settling' || packOpened || booster.carousel.focused || booster.carousel.spinning) return Promise.resolve(null);
      booster.carousel.spin(); canvas.dataset.carouselStartedAt = performance.now().toFixed(1); request();
      return new Promise(resolve => { spinFinished = resolve; });
    },
    selectPack(index: number) {
      if (disposed || failed || state.kind !== 'surf-pro-month' || state.phase !== 'settling' || packOpened || !Number.isInteger(index)) return;
      booster.carousel.select(index); request();
    },
    browsePacks(delta: number, settle: boolean) {
      if (disposed || failed || !panelActive || packOpened || !Number.isFinite(delta)) return;
      const selected = booster.carousel.browse(delta, settle); if (settle) request(); else paint(); return selected;
    },
    rotatePack(delta: number, animated = false) {
      if (disposed || failed || state.kind !== 'surf-pro-month' || state.phase !== 'settling' || packOpened || !Number.isFinite(delta)) return;
      booster.carousel.rotate(delta, animated); if (animated) request(); else paint();
    },
    focusPack(focused: boolean) {
      if (disposed || failed || state.kind !== 'surf-pro-month' || state.phase !== 'settling' || packOpened) return;
      booster.carousel.focus(focused); packPreview = 0; request();
    },
    previewPack(progress: number) {
      if (disposed || failed || state.kind !== 'surf-pro-month' || state.phase !== 'settling' || packOpened || !booster.carousel.focused) return;
      returningPreview = false; packPreview = Math.max(0, Math.min(1, progress)); paint();
    },
    releasePack() {
      if (disposed || failed || packOpened || packPreview <= 0) return;
      returningPreview = true; request();
    },
    openPack() {
      if (disposed || failed || state.kind !== 'surf-pro-month' || state.phase !== 'settling' || packOpened || !booster.carousel.focused || packPreview < 1) return false;
      // Focusing a pack scrolls its stage into view without a resize event.
      measure();
      age = proAgeForTear(packPreview); packOpened = true; packPreview = 0; returningPreview = false; request(); return true;
    },
    revealCard(index: number) {
      if (disposed || failed || state.phase !== 'identity' || revealed.has(index)
        || !Number.isInteger(index) || !nodes[index]) return false;
      revealed.add(index); canvas.dataset.handed = String(revealed.size);
      callbacks.onCardRevealed(index);
      if (revealed.size === nodes.length) { completed = true; callbacks.onRevealed(); }
      return true;
    },
    setState(next: CeremonyState) {
      if (disposed || failed) return;
      const reset = next.phase !== state.phase || next.revision !== state.revision;
      const newBatch = next.revision !== state.revision;
      if (next.duration !== state.duration) proArt = credential(art, next.duration);
      state = next;
      if (newBatch) { spinFinished?.(null); spinFinished = null; }
      if (reset) { age = 0; completed = false; if (newBatch || next.phase === 'spinning' || next.phase === 'idle') {
        gallery.scrollTop = 0; revealed.clear(); packOpened = false; packPreview = 0; returningPreview = false; booster.carousel.reset();
      } }
      try { measure(); updatePrints(); paint(); request(); } catch (error) { fail(error); }
    }, dispose,
  };
}
