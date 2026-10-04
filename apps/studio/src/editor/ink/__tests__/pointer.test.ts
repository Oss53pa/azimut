import { describe, it, expect } from 'vitest';
import {
  POINTER_TOLERANCES, canTraceFreely, pointerKindOf, toleranceFor,
} from '../pointer-kind.js';
import { INITIAL_ARBITER, PEN_IDLE_MS, arbitrate, penActive } from '../pointer-arbiter.js';
import type { ArbiterState, ArbitratedEvent } from '../pointer-arbiter.js';

describe('G3.1 — trois types de pointeur', () => {
  it('lit le type depuis pointerType, et tient l’inconnu pour une souris', () => {
    expect(pointerKindOf('pen')).toBe('pen');
    expect(pointerKindOf('touch')).toBe('touch');
    expect(pointerKindOf('mouse')).toBe('mouse');
    expect(pointerKindOf('')).toBe('mouse');
  });

  it('le doigt ne trace pas librement ; le stylet et la souris, si', () => {
    expect(canTraceFreely('touch')).toBe(false);
    expect(canTraceFreely('pen')).toBe(true);
    expect(canTraceFreely('mouse')).toBe(true);
  });
});

describe('G3.2 — tolérances par type de pointeur', () => {
  it('reprend la table : souris 4 et 8, stylet 3 et 6, doigt 12 et 16', () => {
    expect(POINTER_TOLERANCES).toEqual({
      mouse: { select_px: 4, snap_px: 8 },
      pen: { select_px: 3, snap_px: 6 },
      touch: { select_px: 12, snap_px: 16 },
    });
    expect(toleranceFor('pen')).toEqual({ select_px: 3, snap_px: 6 });
  });
});

describe('G3.4 et J1.5 — rejet de la paume', () => {
  const ev = (kind: ArbitratedEvent['kind'], phase: ArbitratedEvent['phase'], at_ms: number, pointerId = 1): ArbitratedEvent =>
    ({ kind, phase, at_ms, pointerId });

  function run(events: readonly ArbitratedEvent[]): readonly boolean[] {
    let state: ArbiterState = INITIAL_ARBITER;
    return events.map(e => {
      const out = arbitrate(state, e);
      state = out.state;
      return out.accept;
    });
  }

  it('sans stylet, le doigt est transmis', () => {
    expect(run([ev('touch', 'down', 0), ev('touch', 'up', 10)])).toEqual([true, true]);
  });

  it('la paume posée pendant que le stylet trace est ignorée', () => {
    expect(run([
      ev('pen', 'down', 0, 7),
      ev('touch', 'down', 5, 2),
      ev('pen', 'move', 10, 7),
      ev('touch', 'move', 12, 2),
      ev('pen', 'up', 20, 7),
    ])).toEqual([true, false, true, false, true]);
  });

  it('la paume qui précède la pointe est ignorée dès que le stylet survole', () => {
    expect(run([ev('pen', 'hover', 0, 7), ev('touch', 'down', 100, 2)])).toEqual([true, false]);
  });

  it('le doigt revient après le délai d’inactivité du stylet, pas avant', () => {
    const accepts = run([
      ev('pen', 'down', 0, 7),
      ev('pen', 'up', 50, 7),
      ev('touch', 'down', 50 + PEN_IDLE_MS - 1, 2),
      ev('touch', 'down', 50 + PEN_IDLE_MS, 3),
    ]);
    expect(accepts).toEqual([true, true, false, true]);
  });

  it('un stylet encore posé reste actif, quel que soit le temps écoulé', () => {
    const { state } = arbitrate(INITIAL_ARBITER, ev('pen', 'down', 0, 7));
    expect(penActive(state, 10 * PEN_IDLE_MS)).toBe(true);
  });

  it('la souris n’est jamais écartée', () => {
    expect(run([ev('pen', 'down', 0, 7), ev('mouse', 'down', 1, 1)])).toEqual([true, true]);
  });

  it('deux suites identiques donnent deux suites de décisions identiques', () => {
    const events = [ev('touch', 'down', 0, 2), ev('pen', 'hover', 3, 7), ev('touch', 'move', 4, 2)];
    expect(run(events)).toEqual(run(events));
  });
});
