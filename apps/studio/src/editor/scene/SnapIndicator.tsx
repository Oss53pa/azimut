/**
 * E8.3 — Visual snap indicator.
 *
 * Renders a small visual cue at the snap target position when
 * the snap pipeline locks onto a target. Different shapes for
 * different snap kinds:
 *   - vertex: small diamond
 *   - midpoint: small triangle
 *   - intersection: small X
 *   - guide: small circle
 *   - grid: small dot
 *
 * Rendered in pixel-space (overlaid on the SVG), not in meter-space,
 * so the indicator size is constant regardless of zoom.
 */

import type { JSX } from 'react';
import type { SnapResult } from '../snap.js';
import type { SnapKind } from '../snap.js';

type SnapIndicatorProps = {
  readonly snapResult: SnapResult;
};

const INDICATOR_SIZE = 6;

function indicatorPath(kind: SnapKind, x: number, y: number): string {
  const s = INDICATOR_SIZE;
  switch (kind) {
    case 'vertex':
      // Diamond
      return `M${x},${y - s} L${x + s},${y} L${x},${y + s} L${x - s},${y} Z`;
    case 'midpoint':
      // Upward triangle
      return `M${x},${y - s} L${x + s},${y + s} L${x - s},${y + s} Z`;
    case 'intersection':
      // Plus sign
      return `M${x - s},${y} L${x + s},${y} M${x},${y - s} L${x},${y + s}`;
    case 'guide':
      // Rendered as circle via separate element
      return '';
    case 'grid':
      // Small dot — rendered as circle
      return '';
  }
}

export function SnapIndicator({ snapResult }: SnapIndicatorProps): JSX.Element | null {
  if (snapResult.target === null) return null;

  const { screenX, screenY, kind } = snapResult.target;

  // Circle-based indicators
  if (kind === 'guide' || kind === 'grid') {
    const r = kind === 'grid' ? 3 : INDICATOR_SIZE;
    return (
      <circle
        cx={screenX}
        cy={screenY}
        r={r}
        fill="none"
        stroke="var(--az-snap-indicator)"
        strokeWidth={1.5}
        pointerEvents="none"
        data-testid="snap-indicator"
      />
    );
  }

  const path = indicatorPath(kind, screenX, screenY);

  return (
    <path
      d={path}
      fill="none"
      stroke="var(--az-snap-indicator)"
      strokeWidth={1.5}
      pointerEvents="none"
      data-testid="snap-indicator"
    />
  );
}
