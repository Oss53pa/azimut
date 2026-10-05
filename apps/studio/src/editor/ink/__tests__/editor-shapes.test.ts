import { describe, it, expect } from 'vitest';
import type { Point } from '@azimut/core-model';
import { strokeToEditorEllipse, strokeToEditorRect } from '../editor-shapes.js';

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

/** Un rectangle tracé à main levée, tourné de `tilt_deg`, coins un peu ronds. */
function sketchRect(w: number, h: number, tilt_deg: number): readonly Point[] {
  const t = (tilt_deg * Math.PI) / 180;
  const corners = [[0, 0], [w, 0.05], [w + 0.04, h], [0.03, h - 0.02], [0.02, 0.03]] as const;
  const out: Point[] = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const [x0, y0] = corners[i] ?? [0, 0];
    const [x1, y1] = corners[i + 1] ?? [0, 0];
    for (let k = 0; k < 10; k++) {
      const x = x0 + ((x1 - x0) * k) / 10;
      const y = y0 + ((y1 - y0) * k) / 10;
      out.push({ x_m: 2 + x * Math.cos(t) - y * Math.sin(t), y_m: 3 + x * Math.sin(t) + y * Math.cos(t) });
    }
  }
  const [x, y] = corners[corners.length - 1] ?? [0, 0];
  out.push({ x_m: 2 + x * Math.cos(t) - y * Math.sin(t), y_m: 3 + x * Math.sin(t) + y * Math.cos(t) });
  return out;
}

describe('J1.2 — le rectangle dans l’éditeur d’habillage', () => {
  it('un rectangle approximatif devient un rectangle posé sur les axes', () => {
    const out = strokeToEditorRect(sketchRect(6, 3, 2), context);
    expect(out.kind).toBe('rect');
    if (out.kind !== 'rect') return;
    expect(out.data.corner.x_m - out.data.origin.x_m).toBeCloseTo(6, 0);
    expect(out.data.corner.y_m - out.data.origin.y_m).toBeCloseTo(3, 0);
  });

  it('un rectangle franchement de biais n’est pas redressé d’office', () => {
    expect(strokeToEditorRect(sketchRect(6, 3, 30), context).kind).toBe('oblique');
  });

  it('un ovale n’est pas un rectangle', () => {
    expect(strokeToEditorRect(oval(0, 0, 4, 2, 0), context).kind).toBe('unrecognized');
  });
});
