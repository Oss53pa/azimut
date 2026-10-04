import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  sketchPalette, stateColorsInstrument, stateColorsPapier, themeInstrument, themePapier,
} from '../tokens.js';

const css = readFileSync(fileURLToPath(new URL('../studio-theme.css', import.meta.url)), 'utf8');

describe('J3.2 — la palette de l’esquisse', () => {
  it('porte les quatre couleurs que sketch_stroke.color accepte (migration 0072)', () => {
    expect(Object.keys(sketchPalette).map(k => k.replace('sketch-', '')))
      .toEqual(['graphite', 'brick', 'ultramarine', 'fir']);
  });

  it('n’emprunte aucune couleur d’interface ni d’état, dans aucun thème', () => {
    const ui = new Set([
      ...Object.values(themePapier), ...Object.values(themeInstrument),
      ...Object.values(stateColorsPapier), ...Object.values(stateColorsInstrument),
    ].map(v => v.toUpperCase()));
    for (const value of Object.values(sketchPalette)) expect(ui.has(value.toUpperCase())).toBe(false);
    expect(new Set(Object.values(sketchPalette)).size).toBe(4);
  });

  it('la feuille de thème déclare les mêmes valeurs que le module', () => {
    for (const [key, value] of Object.entries(sketchPalette)) {
      expect(css).toContain(`--${key}: ${value};`);
    }
  });
});
