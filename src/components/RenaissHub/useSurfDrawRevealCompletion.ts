import { useCallback, useRef } from 'react';
import type { RevealPhase } from './useSurfDrawPresentation';

// A batch advances only after BOTH the name and the prize finish revealing.
export function useSurfDrawRevealCompletion(phase: RevealPhase, revision: number, complete: () => void) {
  const current = useRef({ phase, revision, name: false, prize: false, completed: false });
  const done = useRef(complete);
  done.current = complete;
  if (current.current.phase !== phase || current.current.revision !== revision) {
    current.current = { phase, revision, name: false, prize: false, completed: false };
  }
  const finish = useCallback((part: 'name' | 'prize') => {
    const state = current.current;
    if (state.phase !== 'identity' || state.completed) return;
    state[part] = true;
    if (state.name && state.prize) { state.completed = true; done.current(); }
  }, []);
  const onNameRevealed = useCallback(() => finish('name'), [finish]);
  const onPrizeRevealed = useCallback(() => finish('prize'), [finish]);
  return { onNameRevealed, onPrizeRevealed };
}
