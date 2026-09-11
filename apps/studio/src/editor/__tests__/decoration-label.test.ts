import { describe, it, expect } from 'vitest';
import type { DecorationKind, DecorationShape } from '../scene-objects.js';
import { DEFAULT_DECORATION_STYLE } from '../scene-objects.js';
import { decorationLabel } from '../decoration-label.js';
import { makeTranslate } from '../../i18n/i18n-context.js';

const t = makeTranslate('fr');

function shape(kind: DecorationKind, label: string): DecorationShape {
  return {
    id: 'dec-7',
    orgId: 'org-1',
    layerId: 'layer-0',
    kind,
    geometry: { type: 'polyline', points: [] },
    styleRole: null,
    style: DEFAULT_DECORATION_STYLE,
    label,
    rotation_deg: 0,
  };
}

describe('E6.3 — accessible name of a habillage object', () => {
  it('uses the label the operator gave the object', () => {
    expect(decorationLabel(shape('area', 'Jardin nord'), t)).toBe("Zone d'habillage Jardin nord");
  });

  it('falls back to the identifier when there is no label', () => {
    expect(decorationLabel(shape('path', ''), t)).toBe("Tracé d'habillage dec-7");
  });

  it('names each kind of the model (E9.3)', () => {
    expect(decorationLabel(shape('area', 'x'), t)).toContain('Zone');
    expect(decorationLabel(shape('path', 'x'), t)).toContain('Tracé');
    expect(decorationLabel(shape('symbol', 'x'), t)).toContain('Symbole');
    expect(decorationLabel(shape('group', 'x'), t)).toContain('Groupe');
  });

  it('never describes the geometry, only the object', () => {
    const wide = shape('area', 'Massif');
    const narrow: DecorationShape = {
      ...wide,
      geometry: { type: 'rectangle', origin: { x_m: 0, y_m: 0 }, width_m: 99, height_m: 1 },
    };
    expect(decorationLabel(narrow, t)).toBe(decorationLabel(wide, t));
  });
});
