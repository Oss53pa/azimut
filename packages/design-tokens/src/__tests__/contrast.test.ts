import { describe, it, expect } from 'vitest';
import { contrastRatio, WCAG_AA_NORMAL } from '../contrast.js';
import { themePapier, stateColors } from '../tokens.js';

const surfaces = [
  { key: 'surface-page', hex: themePapier['surface-page'] },
  { key: 'surface-panel', hex: themePapier['surface-panel'] },
] as const;

const foregrounds = [
  { key: 'text-primary', hex: themePapier['text-primary'] },
  { key: 'text-secondary', hex: themePapier['text-secondary'] },
  { key: 'accent', hex: themePapier['accent'] },
  { key: 'accent-secondary', hex: themePapier['accent-secondary'] },
  { key: 'state-blocking', hex: stateColors['state-blocking'] },
  { key: 'state-warning', hex: stateColors['state-warning'] },
  { key: 'state-valid', hex: stateColors['state-valid'] },
  { key: 'state-info', hex: stateColors['state-info'] },
] as const;

describe('WCAG AA contrast (A11.1)', () => {
  for (const fg of foregrounds) {
    for (const bg of surfaces) {
      it(`${fg.key} on ${bg.key} meets ${WCAG_AA_NORMAL}:1`, () => {
        const ratio = contrastRatio(fg.hex, bg.hex);
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    }
  }
});
