import { type JSX, useMemo } from 'react';
import type { GraphNode, PlanPixelPoint, SiteData } from '@azimut/core-model';
import { useI18n } from '../../i18n/useI18n.js';
import type { PairDraft } from '../../domain/measured-calibration.js';
import { projectLevel, SURFACE_HEIGHT, SURFACE_WIDTH } from './surface-projection.js';

type MeasuredSurfaceProps = {
  readonly site: SiteData;
  readonly levelId: string;
  readonly drafts: readonly PairDraft[];
  readonly landmarks: readonly GraphNode[];
  /** Amer en attente de son point sur le fond ; nul quand aucun n'est armé. */
  readonly armed: GraphNode | null;
  readonly onPlace: (point: PlanPixelPoint) => void;
};

/**
 * Surface du calage mesuré.
 *
 * Chaque paire se lit comme un segment : l'amer où le site le situe, le point
 * où l'opérateur l'a posé sur le fond, et le trait entre les deux. Ce trait est
 * l'écart de saisie, pas le résidu — le résidu ne se connaît qu'après
 * ajustement et se lit au tableau. Les montrer ensemble sur la carte ferait
 * croire qu'il s'agit de la même chose.
 */
export function MeasuredSurface(
  { site, levelId, drafts, landmarks, armed, onPlace }: MeasuredSurfaceProps,
): JSX.Element {
  const { t } = useI18n();
  const projection = useMemo(() => projectLevel(site, levelId), [site, levelId]);
  const placed = useMemo(() => new Set(drafts.map((d) => d.node_id)), [drafts]);

  function handleClick(event: React.MouseEvent<SVGSVGElement>): void {
    if (armed === null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onPlace({
      x_px: (event.clientX - rect.left) * (SURFACE_WIDTH / rect.width),
      y_px: (event.clientY - rect.top) * (SURFACE_HEIGHT / rect.height),
    });
  }

  return (
    <svg
      viewBox={`0 0 ${String(SURFACE_WIDTH)} ${String(SURFACE_HEIGHT)}`}
      width="100%"
      role="img"
      aria-label={t('measured.surface.aria')}
      onClick={handleClick}
      style={{
        display: 'block',
        background: 'var(--surface-canvas)',
        cursor: armed === null ? 'default' : 'crosshair',
      }}
    >
      {projection.outlines.map((outline) => (
        <polygon
          key={outline.id}
          points={outline.points}
          fill="var(--surface-sunken)"
          stroke="var(--border-strong)"
          strokeWidth={1}
        />
      ))}

      {landmarks.map((node) => {
        const at = projection.toSurface(node.position);
        const isPlaced = placed.has(node.id);
        const isArmed = armed?.id === node.id;
        return (
          <g key={node.id}>
            <circle
              cx={at.x}
              cy={at.y}
              r={isArmed ? 8 : 5}
              fill="none"
              stroke={isArmed ? 'var(--accent)' : 'var(--border-strong)'}
              strokeWidth={isArmed ? 3 : 1.5}
              strokeDasharray={isPlaced ? undefined : '3 3'}
            />
            <text
              x={at.x + 10}
              y={at.y - 6}
              fill="var(--text-secondary)"
              fontSize={11}
              fontFamily="var(--font-mono)"
            >
              {node.label}
            </text>
          </g>
        );
      })}

      {drafts.map((draft) => {
        const node = landmarks.find((n) => n.id === draft.node_id);
        if (node === undefined) return null;
        const at = projection.toSurface(node.position);
        return (
          <g key={draft.node_id}>
            <line
              x1={at.x}
              y1={at.y}
              x2={draft.source.x_px}
              y2={draft.source.y_px}
              stroke="var(--accent)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <circle
              cx={draft.source.x_px}
              cy={draft.source.y_px}
              r={5}
              fill="var(--surface-panel)"
              stroke="var(--accent)"
              strokeWidth={2.5}
            />
          </g>
        );
      })}
    </svg>
  );
}
