import { describe, it, expect } from 'vitest';
import { isPenEraser } from '../pointer-kind.js';

describe('J1.5 — la gomme du stylet', () => {
  it('le bout gomme et le bouton latéral gomment', () => {
    expect(isPenEraser('pen', 32)).toBe(true);
    expect(isPenEraser('pen', 2)).toBe(true);
    expect(isPenEraser('pen', 1 | 2)).toBe(true);
  });

  it('la pointe seule trace, et ni la souris ni le doigt ne gomment ainsi', () => {
    expect(isPenEraser('pen', 1)).toBe(false);
    expect(isPenEraser('mouse', 2)).toBe(false);
    expect(isPenEraser('touch', 32)).toBe(false);
  });
});
