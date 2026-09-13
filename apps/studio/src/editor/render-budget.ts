import type { Finding } from '@azimut/core-model';

/**
 * G2.2 — Adaptive render budget. The fixed 3 000-object threshold is removed
 * and replaced by a budget measured at runtime: the view targets a per-frame
 * time budget; frame time is averaged over a sliding window; if the average
 * stays over budget long enough the view switches to lightweight rendering, and
 * returns to full rendering once the average sits durably below a fraction of
 * the budget, with hysteresis to prevent oscillation. The current mode is shown
 * in the status bar, never silent (RENDER.BUDGET_EXCEEDED on the switch down).
 *
 * The lightweight mode changes how the scene is drawn, never the coordinates
 * produced (G2.3), so this controller is a pure, deterministic reducer.
 *
 * These are named, tunable constants (G2.4: starting points to be measured on
 * the first real site), not regulatory values.
 */
export const RENDER_BUDGET_MS = 16;
export const SLIDING_WINDOW_FRAMES = 30;
export const OVER_BUDGET_TRIGGER_MS = 500;
export const RECOVERY_FRACTION = 0.6;
export const RECOVERY_HOLD_MS = 500;

export type RenderMode = 'full' | 'lightweight';

export type RenderBudgetState = {
  readonly mode: RenderMode;
  /** Recent frame durations (ms), most recent last, capped to the window. */
  readonly window: readonly number[];
  /** When the average first exceeded budget while full; null otherwise. */
  readonly over_budget_since: number | null;
  /** When the average first dropped under the recovery line while light. */
  readonly under_recovery_since: number | null;
};

export type RenderBudgetStep = {
  readonly state: RenderBudgetState;
  readonly mode: RenderMode;
  /** Emitted only on the switch down to lightweight; null otherwise. */
  readonly finding: Finding | null;
};

export function initialRenderBudgetState(): RenderBudgetState {
  return {
    mode: 'full',
    window: [],
    over_budget_since: null,
    under_recovery_since: null,
  };
}

function average(window: readonly number[]): number {
  if (window.length === 0) return 0;
  let sum = 0;
  for (const v of window) sum += v;
  return sum / window.length;
}

/**
 * Advance the controller by one measured frame. `frameDurationMs` is the frame's
 * render time; `atMs` is the frame's timestamp (monotonic). Returns the next
 * state, the effective mode, and a RENDER.BUDGET_EXCEEDED info finding on the
 * frame where the view switches to lightweight.
 */
export function renderBudgetStep(
  state: RenderBudgetState,
  frameDurationMs: number,
  atMs: number,
): RenderBudgetStep {
  const window = [...state.window, frameDurationMs].slice(-SLIDING_WINDOW_FRAMES);
  const avg = average(window);

  if (state.mode === 'full') {
    if (avg > RENDER_BUDGET_MS) {
      const since = state.over_budget_since ?? atMs;
      if (atMs - since > OVER_BUDGET_TRIGGER_MS) {
        return {
          state: {
            mode: 'lightweight',
            window,
            over_budget_since: null,
            under_recovery_since: null,
          },
          mode: 'lightweight',
          finding: {
            code: 'RENDER.BUDGET_EXCEEDED',
            severity: 'info',
            entity: null,
            params: { average_ms: avg, budget_ms: RENDER_BUDGET_MS },
            ruleRef: 'G2.2',
          },
        };
      }
      return {
        state: { ...state, window, over_budget_since: since },
        mode: 'full',
        finding: null,
      };
    }
    return {
      state: { ...state, window, over_budget_since: null },
      mode: 'full',
      finding: null,
    };
  }

  // Lightweight: recover once the average sits durably under the recovery line.
  const recoveryLine = RENDER_BUDGET_MS * RECOVERY_FRACTION;
  if (avg < recoveryLine) {
    const since = state.under_recovery_since ?? atMs;
    if (atMs - since > RECOVERY_HOLD_MS) {
      return {
        state: {
          mode: 'full',
          window,
          over_budget_since: null,
          under_recovery_since: null,
        },
        mode: 'full',
        finding: null,
      };
    }
    return {
      state: { ...state, window, under_recovery_since: since },
      mode: 'lightweight',
      finding: null,
    };
  }
  return {
    state: { ...state, window, under_recovery_since: null },
    mode: 'lightweight',
    finding: null,
  };
}
