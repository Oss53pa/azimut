import { describe, it, expect } from 'vitest';
import { transitionSupportVersion, admittedEvents } from '../support-version-state.js';
import type { SupportVersionEvent } from '../support-version-state.js';
import type { SupportVersionState } from '../site.js';

const STATES: readonly SupportVersionState[] = ['draft', 'in_review', 'approved', 'superseded'];
const EVENTS: readonly SupportVersionEvent[] = ['modify', 'emit_proof', 'reject', 'approve', 'supersede'];

const ALLOWED: ReadonlyArray<[SupportVersionState, SupportVersionEvent, SupportVersionState, string]> = [
  ['draft', 'modify', 'draft', 'recompute_hash'],
  ['draft', 'emit_proof', 'in_review', 'freeze'],
  ['in_review', 'reject', 'draft', 'none'],
  ['in_review', 'approve', 'approved', 'write_approval'],
  ['approved', 'supersede', 'superseded', 'automatic'],
];

describe('transitionSupportVersion (T-2.14a §5 / §6.8)', () => {
  it('accepts every listed transition with the right target and effect', () => {
    for (const [from, event, to, effect] of ALLOWED) {
      const opts = event === 'reject' ? { motif: 'à revoir' } : undefined;
      const r = transitionSupportVersion(from, event, opts);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.to).toBe(to);
        expect(r.value.effect).toBe(effect);
      }
    }
  });

  it('refuses every unlisted transition with a stable code', () => {
    const allowedKeys = new Set(ALLOWED.map(([f, e]) => `${f}|${e}`));
    for (const from of STATES) {
      for (const event of EVENTS) {
        if (allowedKeys.has(`${from}|${event}`)) continue;
        const r = transitionSupportVersion(from, event, { motif: 'x' });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.findings[0]?.code).toBe('DATA.SUPPORT_VERSION_TRANSITION_FORBIDDEN');
      }
    }
  });

  it('an approved version is never modifiable (approved+modify forbidden)', () => {
    const r = transitionSupportVersion('approved', 'modify');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.findings[0]?.code).toBe('DATA.SUPPORT_VERSION_TRANSITION_FORBIDDEN');
  });

  it('requires a reason to reject', () => {
    for (const motif of [undefined, '', '   ']) {
      const r = transitionSupportVersion('in_review', 'reject', motif === undefined ? undefined : { motif });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.findings[0]?.code).toBe('DATA.SUPPORT_VERSION_REJECT_MOTIF_REQUIRED');
    }
  });

  it('only draft recomputes the hash; frozen states do not (§6.10, logic)', () => {
    // A modify is only legal from draft, and its effect is the recompute. From
    // in_review or approved the modify is forbidden, so no recompute path exists
    // — the empreinte stays frozen.
    expect(transitionSupportVersion('draft', 'modify').ok).toBe(true);
    expect(transitionSupportVersion('in_review', 'modify').ok).toBe(false);
    expect(transitionSupportVersion('approved', 'modify').ok).toBe(false);
    expect(transitionSupportVersion('superseded', 'modify').ok).toBe(false);
  });
});

/**
 * G7 — « Une version approuvée est immuable. Une correction crée une nouvelle
 * version. » C'est la table d'événements qui le dit ; ce test l'y tient.
 */
describe('G7 — ce qu’une version approuvée admet', () => {
  it('n’admet que le remplacement', () => {
    expect(admittedEvents('approved')).toEqual([
      { event: 'supersede', to: 'superseded' },
    ]);
  });

  it('refuse toute modification d’une version approuvée', () => {
    for (const event of ['modify', 'emit_proof', 'reject', 'approve'] as const) {
      const result = transitionSupportVersion('approved', event);
      expect(result.ok, event).toBe(false);
      if (result.ok) continue;
      expect(result.findings[0]?.code).toBe('DATA.SUPPORT_VERSION_TRANSITION_FORBIDDEN');
    }
  });

  it('fait de « remplacé » un état terminal', () => {
    expect(admittedEvents('superseded')).toEqual([]);
  });

  it('laisse un brouillon se modifier, et lui seul', () => {
    const modifiable = STATES.filter(
      state => admittedEvents(state).some(a => a.event === 'modify')
        || transitionSupportVersion(state, 'modify').ok,
    );
    expect(modifiable).toEqual(['draft']);
  });

  it('rend les mêmes transitions que celles que la table porte', () => {
    for (const state of STATES) {
      for (const { event, to } of admittedEvents(state)) {
        const result = transitionSupportVersion(event === 'reject' ? state : state, event, { motif: 'x' });
        expect(result.ok, `${state}|${event}`).toBe(true);
        if (!result.ok) continue;
        expect(result.value.to).toBe(to);
      }
    }
  });
});
