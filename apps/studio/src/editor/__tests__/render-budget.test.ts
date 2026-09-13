import { describe, it, expect } from 'vitest';
import {
  initialRenderBudgetState,
  renderBudgetStep,
  RENDER_BUDGET_MS,
  OVER_BUDGET_TRIGGER_MS,
  RECOVERY_HOLD_MS,
  type RenderBudgetState,
} from '../render-budget.js';

/** Feed a constant frame duration for a span of time at a fixed frame step. */
function run(
  state: RenderBudgetState,
  frameMs: number,
  fromMs: number,
  spanMs: number,
  stepMs: number,
): { state: RenderBudgetState; switches: number } {
  let s = state;
  let switches = 0;
  for (let t = fromMs; t <= fromMs + spanMs; t += stepMs) {
    const r = renderBudgetStep(s, frameMs, t);
    if (r.finding !== null) switches += 1;
    s = r.state;
  }
  return { state: s, switches };
}

describe('G2.2 — renderBudgetStep', () => {
  it('stays full while frames are within budget', () => {
    const { state, switches } = run(initialRenderBudgetState(), 10, 0, 3000, 16);
    expect(state.mode).toBe('full');
    expect(switches).toBe(0);
  });

  it('does not switch on a brief spike under the trigger window', () => {
    const r = run(initialRenderBudgetState(), 40, 0, OVER_BUDGET_TRIGGER_MS - 50, 16);
    expect(r.state.mode).toBe('full');
    expect(r.switches).toBe(0);
  });

  it('switches to lightweight once over budget past the trigger window', () => {
    const r = run(initialRenderBudgetState(), 40, 0, OVER_BUDGET_TRIGGER_MS + 200, 16);
    expect(r.state.mode).toBe('lightweight');
    expect(r.switches).toBe(1);
  });

  it('emits RENDER.BUDGET_EXCEEDED exactly on the switch frame', () => {
    let s = initialRenderBudgetState();
    let emitted: string | null = null;
    for (let t = 0; t <= OVER_BUDGET_TRIGGER_MS + 100; t += 16) {
      const r = renderBudgetStep(s, 50, t);
      if (r.finding !== null) {
        emitted = r.finding.code;
        expect(r.finding.severity).toBe('info');
        expect(r.finding.ruleRef).toBe('G2.2');
        expect(Number(r.finding.params['budget_ms'])).toBe(RENDER_BUDGET_MS);
      }
      s = r.state;
    }
    expect(emitted).toBe('RENDER.BUDGET_EXCEEDED');
  });

  it('returns to full only after sitting durably under the recovery line', () => {
    // Drive into lightweight first.
    const down = run(initialRenderBudgetState(), 40, 0, OVER_BUDGET_TRIGGER_MS + 200, 16);
    expect(down.state.mode).toBe('lightweight');
    // Then feed fast frames (well under 60% of budget) long enough that the
    // 30-frame window flushes AND the recovery hold elapses.
    const up = run(down.state, 4, 100000, RECOVERY_HOLD_MS + 1500, 16);
    expect(up.state.mode).toBe('full');
    expect(up.switches).toBe(0); // recovery emits no anomaly
  });

  it('is deterministic: identical inputs give identical state', () => {
    const a = run(initialRenderBudgetState(), 40, 0, 2000, 16);
    const b = run(initialRenderBudgetState(), 40, 0, 2000, 16);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });
});
