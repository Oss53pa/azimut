/**
 * E7.1 — Tool preview renderer.
 *
 * Renders the intermediate geometry while a tool gesture is active.
 * This is a meter-space component (placed inside the view transform `<g>`).
 *
 * Each tool preview kind has its own SVG rendering:
 *   - rect: dashed rectangle
 *   - ellipse: dashed ellipse
 *   - polygon: dashed regular polygon
 *   - polyline: dashed polyline with vertex dots
 *   - measure/dimension: line with endpoints
 *
 * Styling uses design-token CSS variables (A2.4 — no hardcoded colors).
 */

import type { JSX } from 'react';
import type { ToolPreview } from '../tool-state.js';

type ToolPreviewRendererProps = {
  readonly preview: ToolPreview;
};

const STROKE_DASH = '4 3';

function renderRect(
  origin: { x_m: number; y_m: number },
  corner: { x_m: number; y_m: number },
): JSX.Element {
  const x = Math.min(origin.x_m, corner.x_m);
  const y = Math.min(origin.y_m, corner.y_m);
  const w = Math.abs(corner.x_m - origin.x_m);
  const h = Math.abs(corner.y_m - origin.y_m);

  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill="none"
      stroke="var(--az-tool-preview)"
      strokeWidth={0.02}
      strokeDasharray={STROKE_DASH}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
      data-testid="tool-preview-rect"
    />
  );
}

function renderEllipse(
  center: { x_m: number; y_m: number },
  rx_m: number,
  ry_m: number,
): JSX.Element {
  return (
    <ellipse
      cx={center.x_m}
      cy={center.y_m}
      rx={rx_m}
      ry={ry_m}
      fill="none"
      stroke="var(--az-tool-preview)"
      strokeWidth={0.02}
      strokeDasharray={STROKE_DASH}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
      data-testid="tool-preview-ellipse"
    />
  );
}

function renderPolygon(
  center: { x_m: number; y_m: number },
  radius_m: number,
  sides: number,
  rotation_deg: number,
): JSX.Element {
  const points: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = ((2 * Math.PI * i) / sides) + (rotation_deg * Math.PI) / 180;
    const px = center.x_m + radius_m * Math.cos(angle);
    const py = center.y_m + radius_m * Math.sin(angle);
    points.push(`${px},${py}`);
  }

  return (
    <polygon
      points={points.join(' ')}
      fill="none"
      stroke="var(--az-tool-preview)"
      strokeWidth={0.02}
      strokeDasharray={STROKE_DASH}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
      data-testid="tool-preview-polygon"
    />
  );
}

function renderPolyline(
  pts: readonly { x_m: number; y_m: number }[],
): JSX.Element {
  if (pts.length === 0) return <g />;

  const pointStr = pts.map(p => `${p.x_m},${p.y_m}`).join(' ');

  return (
    <g pointerEvents="none" data-testid="tool-preview-polyline">
      <polyline
        points={pointStr}
        fill="none"
        stroke="var(--az-tool-preview)"
        strokeWidth={0.02}
        strokeDasharray={STROKE_DASH}
        vectorEffect="non-scaling-stroke"
      />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x_m}
          cy={p.y_m}
          r={0.05}
          fill="var(--az-tool-preview)"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

function renderMeasure(
  from: { x_m: number; y_m: number },
  to: { x_m: number; y_m: number },
): JSX.Element {
  return (
    <g pointerEvents="none" data-testid="tool-preview-measure">
      <line
        x1={from.x_m}
        y1={from.y_m}
        x2={to.x_m}
        y2={to.y_m}
        stroke="var(--az-tool-preview)"
        strokeWidth={0.02}
        strokeDasharray={STROKE_DASH}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={from.x_m} cy={from.y_m} r={0.05}
        fill="var(--az-tool-preview)" vectorEffect="non-scaling-stroke" />
      <circle cx={to.x_m} cy={to.y_m} r={0.05}
        fill="var(--az-tool-preview)" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

export function ToolPreviewRenderer(
  { preview }: ToolPreviewRendererProps,
): JSX.Element | null {
  switch (preview.kind) {
    case 'none':
      return null;
    case 'rect':
      return renderRect(preview.origin, preview.corner);
    case 'ellipse':
      return renderEllipse(preview.center, preview.rx_m, preview.ry_m);
    case 'polygon':
      return renderPolygon(
        preview.center, preview.radius_m,
        preview.sides, preview.rotation_deg,
      );
    case 'polyline':
    case 'bezier':
      return renderPolyline(preview.points);
    case 'measure':
    case 'dimension':
      return renderMeasure(preview.from, preview.to);
  }
}
