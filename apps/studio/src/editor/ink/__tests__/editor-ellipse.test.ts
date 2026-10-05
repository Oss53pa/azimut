import { describe, it, expect } from 'vitest';
import type { Point } from '@azimut/core-model';
import { strokeToEditorEllipse } from '../editor-ellipse.js';

/** Un ovale tracé à main levée : centre, demi-axes, inclinaison, tremblé. */
function oval(cx: number, cy: number, rx: number, ry: number, tilt_deg: number, wobble = 0.02): readonly Point[] {
  const out: Point[] = [];
  const t = (tilt_deg * Math.PI) / 180;
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * 2 * Math.PI;
    const k = 1 + wobble * Math.sin(7 * a);
    const x = rx * k * Math.cos(a);
    const y = ry * k * Math.sin(a);
    out.push({ x_m: cx + x * Math.cos(t) - y * Math.sin(t), y_m: cy + x * Math.sin(t) + y * Math.cos(t) });
  }
  return out;
}

const context = { pxPerMeter: 40, strictness: 'normal' as const };

describe('J1.2 — cercle et ovale dans l’éditeur d’habillage', () => {
  it('un ovale à peu près droit devient une ellipse posée sur les axes', () => {
    const out = strokeToEditorEllipse(oval(5, 5, 4, 2, 3), context);
    expect(out.kind).toBe('ellipse');
    if (out.kind !== 'ellipse') return;
    expect(out.data.rx_m).toBeGreaterThan(out.data.ry_m);
    expect(out.data.center.x_m).toBeCloseTo(5, 0);
  });

  it('un ovale debout garde sa hauteur pour grand axe', () => {
    const out = strokeToEditorEllipse(oval(0, 0, 4, 2, 88), context);
    expect(out.kind === 'ellipse' && out.data.ry_m > out.data.rx_m).toBe(true);
  });

  it('un cercle approximatif devient un cercle', () => {
    const out = strokeToEditorEllipse(oval(0, 0, 3, 2.9, 0), context);
    expect(out.kind === 'ellipse' && out.circle && out.data.rx_m === out.data.ry_m).toBe(true);
  });

  it('un ovale franchement de biais n’est pas redressé d’office', () => {
    expect(strokeToEditorEllipse(oval(0, 0, 4, 2, 45), context).kind).toBe('oblique');
  });

  it('un trait qui n’est pas rond n’est pas lu', () => {
    const line = [{ x_m: 0, y_m: 0 }, { x_m: 5, y_m: 0.1 }, { x_m: 10, y_m: 0 }];
    expect(strokeToEditorEllipse(line, context).kind).toBe('unrecognized');
  });
});
