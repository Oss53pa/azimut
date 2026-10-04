import { type JSX } from 'react';
import type { Point } from '@azimut/core-model';
import { strokeStyle } from '../state/sketch.js';
import type { SketchStroke } from '../state/sketch.js';

/**
 * J3.2 (partie J) — les traits d'esquisse, tels qu'ils ont été tracés.
 *
 * Chaque segment prend l'épaisseur et l'opacité de la pression moyenne de
 * ses deux extrémités. Le marqueur est translucide d'un bloc : l'opacité est portée par le
 * groupe, pour que les segments ne se foncent pas à leurs jointures.
 *
 * La couleur vient des jetons d'esquisse, sans rapport avec ceux de
 * l'interface ni avec les chartes (J3.2).
 */
export function SketchStrokes(props: {
  readonly strokes: readonly SketchStroke[];
  readonly project: (point: Point) => { readonly x_px: number; readonly y_px: number };
  readonly scale_px_per_m: number;
}): JSX.Element {
  return (
    <g data-testid="sketch-layer" pointerEvents="none">
      {props.strokes.map(stroke => {
        const color = `var(--sketch-${stroke.color})`;
        const marker = stroke.tool === 'marker';
        const at = stroke.points.map(props.project);
        const first = at[0];
        return (
          <g key={stroke.id} data-testid="sketch-stroke" data-sketch-tool={stroke.tool}
            opacity={marker ? strokeStyle('marker', 0).opacity : 1}>
            {stroke.points.length === 1 && first !== undefined && (
              <circle cx={first.x_px} cy={first.y_px} fill={color}
                r={(stroke.width_base_m * props.scale_px_per_m) / 2} />
            )}
            {stroke.points.slice(1).map((point, i) => {
              const from = at[i];
              const to = at[i + 1];
              const start = stroke.points[i];
              if (from === undefined || to === undefined || start === undefined) return null;
              const style = strokeStyle(stroke.tool, (start.p + point.p) / 2);
              return (
                <line key={`${stroke.id}:${String(i)}`} x1={from.x_px} y1={from.y_px} x2={to.x_px} y2={to.y_px}
                  stroke={color} strokeLinecap="round"
                  strokeWidth={Math.max(stroke.width_base_m * style.widthFactor * props.scale_px_per_m, 0.5)}
                  strokeOpacity={marker ? 1 : style.opacity} />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}
