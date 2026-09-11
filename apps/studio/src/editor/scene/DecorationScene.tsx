/**
 * E9 — SVG rendering of the habillage layer.
 *
 * Renders the decoration shapes of one level, in draw order, with
 * native hit-testing and accessibility attributes. Coordinates are in
 * meter-space: the parent viewport's `<g transform>` applies the view
 * transform, this component never converts coordinates (E3.1).
 *
 * The layer is purely graphical (E9.2): nothing drawn here takes part
 * in routing, coverage, quantities or clickable zones.
 */

import type { JSX } from 'react';
import { formatSvg } from '@azimut/core-model';
import type { Point } from '@azimut/core-model';
import type { DecorationGeometry, DecorationShape } from '../scene-objects.js';
import { decorationLabel } from '../decoration-label.js';
import { useI18n } from '../../i18n/useI18n.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type DecorationSceneProps = {
  /** Shapes of the active level, in draw order. */
  readonly shapes: readonly DecorationShape[];
  readonly selectedIds: readonly string[];
  readonly activeId?: string | null | undefined;
  readonly onSelect?: ((id: string, additive: boolean) => void) | undefined;
};

// ---------------------------------------------------------------------------
// Geometry → SVG
// ---------------------------------------------------------------------------

function pointList(points: readonly Point[]): string {
  return points.map(p => `${formatSvg(p.x_m)},${formatSvg(p.y_m)}`).join(' ');
}

type ShapeVisual = {
  readonly fill: string;
  readonly stroke: string;
  readonly strokeWidth: number;
};

function renderGeometry(
  geometry: DecorationGeometry,
  visual: ShapeVisual,
): JSX.Element | null {
  const common = {
    stroke: visual.stroke,
    strokeWidth: visual.strokeWidth,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  switch (geometry.type) {
    case 'polygon':
      return <polygon points={pointList(geometry.points)} fill={visual.fill} {...common} />;
    case 'polyline':
      return <polyline points={pointList(geometry.points)} fill="none" {...common} />;
    case 'rectangle':
      return (
        <rect
          x={formatSvg(geometry.origin.x_m)}
          y={formatSvg(geometry.origin.y_m)}
          width={formatSvg(geometry.width_m)}
          height={formatSvg(geometry.height_m)}
          fill={visual.fill}
          {...common}
        />
      );
    case 'ellipse':
      return (
        <ellipse
          cx={formatSvg(geometry.center.x_m)}
          cy={formatSvg(geometry.center.y_m)}
          rx={formatSvg(geometry.rx_m)}
          ry={formatSvg(geometry.ry_m)}
          fill={visual.fill}
          {...common}
        />
      );
    case 'symbol_ref':
      // The symbol library (E9.5) is not loaded by the editor yet; the
      // anchor is shown so the object stays selectable and is never
      // silently invisible.
      return (
        <circle
          cx={formatSvg(geometry.position.x_m)}
          cy={formatSvg(geometry.position.y_m)}
          r={0.1}
          fill={visual.stroke}
          {...common}
        />
      );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DecorationScene({
  shapes,
  selectedIds,
  activeId = null,
  onSelect,
}: DecorationSceneProps): JSX.Element {
  const { t } = useI18n();
  const selectedSet = new Set(selectedIds);

  return (
    <g data-layer="decoration">
      {shapes.map(shape => {
        const isSelected = selectedSet.has(shape.id);
        const isActive = shape.id === activeId;
        const visual: ShapeVisual = {
          fill: 'var(--az-decoration-fill)',
          stroke: isSelected
            ? 'var(--az-decoration-selected)'
            : 'var(--az-decoration-stroke)',
          strokeWidth: isSelected ? shape.style.strokeWidth_m * 3 : shape.style.strokeWidth_m,
        };

        return (
          <g
            key={shape.id}
            data-id={shape.id}
            data-kind={shape.kind}
            data-selected={isSelected ? 'true' : undefined}
            data-active={isActive ? 'true' : undefined}
            opacity={shape.style.opacity}
            role="graphics-symbol"
            aria-label={decorationLabel(shape, t)}
            style={{ cursor: 'pointer' }}
            onClick={e => onSelect?.(shape.id, e.ctrlKey || e.metaKey)}
          >
            {renderGeometry(shape.geometry, visual)}
          </g>
        );
      })}
    </g>
  );
}
