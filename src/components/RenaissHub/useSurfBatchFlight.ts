import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { turnSurfWinnerCard } from './draw-effects/turnSurfWinnerCard';
import type { RevealPhase } from './useSurfDrawPresentation';
import type { Prize } from './useSurfDraw';
import type { SurfProLogoUrls } from '../SurfStoreRewards/prepareSurfProLogos';
import type { CeremonyState, createSurfBatchCeremony } from './draw-effects/batch-ceremony/createSurfBatchCeremony';

// React owns readiness and authoritative phase boundaries. One imperative scene
// owns high-frequency 3D motion, as in the existing 30th anniversary project.
export function useSurfBatchFlight({ root, canvas, phase, revision, kind, duration, progress, images, logos, onSettled, onRevealed }: {
  root: RefObject<HTMLDivElement | null>; canvas: RefObject<HTMLCanvasElement | null>;
  phase: RevealPhase; revision: number; kind: Prize['kind']; duration: string; progress: { current: number; total: number } | null;
  images?: ImageBitmap[]; logos?: SurfProLogoUrls; onSettled: () => void; onRevealed: () => void;
}) {
  const [ready, setReady] = useState(false), [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [packOpened, setPackOpened] = useState(false);
  const [flipping, setFlipping] = useState<number | null>(null);
  const scene = useRef<Awaited<ReturnType<typeof createSurfBatchCeremony>> | null>(null);
  const turn = useRef<ReturnType<typeof turnSurfWinnerCard> | null>(null);
  useLayoutEffect(() => {
    if (flipping === null) { turn.current?.cancel(); turn.current = null; }
  }, [flipping]);
  useEffect(() => () => { turn.current?.cancel(); turn.current = null; }, [revision]);
  const confirmed = progress?.current ?? 0;
  const latest = useRef<{ state: CeremonyState; onSettled: () => void; onRevealed: () => void }>({ state: { phase, revision, kind, duration, confirmed }, onSettled, onRevealed });
  latest.current = { state: { phase, revision, kind, duration, confirmed }, onSettled, onRevealed };
  useEffect(() => {
    if (!images || !logos || !root.current || !canvas.current) return;
    const controller = new AbortController(); let live = true;
    setReady(false); setError(null);
    const timer = window.setTimeout(() => { controller.abort(); if (live) setError('The 3D ceremony did not prepare in time. Reload to retry.'); }, 15000);
    void import('./draw-effects/batch-ceremony/createSurfBatchCeremony').then(async ({ createSurfBatchCeremony }) => {
      controller.signal.throwIfAborted();
      const prepared = await createSurfBatchCeremony(root.current!, canvas.current!, { images, logos }, latest.current.state, {
        // The scene reports GPU readiness before this promise returns. Expose
        // controls only after scene.current can receive their first input.
        onReady: () => {},
        onError: message => { if (live) { setReady(false); setError(message); } },
        onSettled: () => latest.current.onSettled(),
        onCardRevealed: index => { if (live) { setRevealed(previous => previous.includes(index) ? previous : [...previous, index]); setFlipping(null); } },
        onRevealed: () => latest.current.onRevealed(),
      }, controller.signal);
      if (!live || controller.signal.aborted) { prepared.dispose(); return; }
      clearTimeout(timer); scene.current = prepared; prepared.setState(latest.current.state); setReady(true);
    }).catch(reason => { clearTimeout(timer); if (live && !controller.signal.aborted) { setReady(false); setError(reason instanceof Error ? reason.message : String(reason)); } });
    return () => { live = false; clearTimeout(timer); controller.abort(); scene.current?.dispose(); scene.current = null; };
  }, [root, canvas, images, logos]);
  useEffect(() => { setRevealed([]); setFlipping(null); setPackOpened(false); }, [revision]);
  useEffect(() => { scene.current?.setState({ phase, revision, kind, duration, confirmed }); }, [phase, revision, kind, duration, confirmed]);
  function flipCard(index: number) {
    if (!ready || phase !== 'identity' || flipping !== null || revealed.includes(index)) return false;
    const currentScene = scene.current;
    const element = root.current?.querySelectorAll<HTMLElement>('.surf-batch-card__turn')[index];
    if (!currentScene || !element || turn.current || document.hidden) return false;
    setFlipping(index);
    turn.current = turnSurfWinnerCard(element, () => {
      if (scene.current === currentScene) currentScene.revealCard(index);
    });
    return true;
  }
  function openPack() { if (scene.current?.openPack()) setPackOpened(true); }
  function previewPack(progress: number) { scene.current?.previewPack(progress); }
  function releasePack() { scene.current?.releasePack(); }
  return { ready, error, revealed, flipping, flipCard, packOpened, openPack, previewPack, releasePack,
    selectPack: (index: number) => scene.current?.selectPack(index),
    rotatePack: (delta: number, animated = false) => scene.current?.rotatePack(delta, animated),
    focusPack: (focused: boolean) => scene.current?.focusPack(focused),
  };
}
