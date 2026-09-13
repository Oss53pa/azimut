import { useEffect, useRef, useState } from 'react';
import {
  initialRenderBudgetState,
  renderBudgetStep,
  type RenderMode,
} from './render-budget.js';

/**
 * G2.2 — React glue driving the adaptive render-budget controller from the
 * animation frame clock. Each frame the inter-frame interval is fed to the pure
 * reducer (renderBudgetStep) as a proxy for render cost; the reducer decides the
 * mode with its sliding window and hysteresis. The reducer holds all the logic
 * and is unit-tested; this hook only samples frames and exposes the mode.
 */
export function useRenderBudget(): RenderMode {
  const [mode, setMode] = useState<RenderMode>('full');
  const stateRef = useRef(initialRenderBudgetState());
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number): void => {
      const last = lastFrameRef.current;
      if (last !== null) {
        const durationMs = now - last;
        const stepped = renderBudgetStep(stateRef.current, durationMs, now);
        stateRef.current = stepped.state;
        setMode((prev) => (prev === stepped.mode ? prev : stepped.mode));
      }
      lastFrameRef.current = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return mode;
}
