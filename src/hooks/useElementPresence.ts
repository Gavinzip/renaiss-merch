import { useLayoutEffect, useRef, useState } from 'react';
import { transitionElements, type ElementTransition, type ElementTransitionTiming } from '../lib/elementTransition';

// Keep the group mounted until its last child has finished leaving. Each leaf
// has its own animation; the parent is only a layout/accessibility boundary.
export function useElementPresence<T extends HTMLElement = HTMLElement>(open: boolean, exitTiming?: ElementTransitionTiming) {
  const ref = useRef<T>(null);
  const [phase, setPhase] = useState<'hidden' | 'entering' | 'visible' | 'leaving'>('hidden');
  const transition = useRef<ElementTransition | undefined>(undefined);
  const generation = useRef(0);
  const shown = useRef(false);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || (!open && !shown.current)) return;
    const revision = ++generation.current;
    const interrupted = phase === 'entering' || phase === 'leaving';
    shown.current = true;
    setPhase(open ? 'entering' : 'leaving');
    const sequence = transitionElements(root, '[data-motion-item]', open ? 'enter' : 'exit', transition.current, interrupted,
      false, open ? undefined : exitTiming);
    transition.current = sequence;
    void sequence.finished.then(() => {
      if (generation.current !== revision) return;
      setPhase(open ? 'visible' : 'hidden');
    });
    // Phase updates describe this sequence; only a new open intent starts one.
  }, [open, exitTiming]);

  useLayoutEffect(() => () => {
    generation.current++;
    transition.current?.cancel();
  }, []);
  return { ref, phase, visible: phase !== 'hidden' };
}
