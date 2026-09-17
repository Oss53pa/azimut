import { type JSX, useMemo } from 'react';
import type { SiteData } from '@azimut/core-model';
import { useI18n } from '../../i18n/useI18n.js';
import type { PlanPoint } from '../../domain/plan-calibration.js';
import { projectLevel, SURFACE_HEIGHT, SURFACE_WIDTH } from './surface-projection.js';

export { SURFACE_WIDTH, SURFACE_HEIGHT };

type CalibrationSurfaceProps = {
  readonly site: SiteData;
  readonly levelId: string;
  readonly pointA: PlanPoint | null;
  readonly pointB: PlanPoint | null;
  readonly onPlace: (point: PlanPoint) => void;
};

/**
 * Surface de calage. À défaut d'un fond de plan téléversé — l'application n'a
 * pas encore de dépôt de fichier — elle rend les empreintes du niveau comme
 * fond : les clics portent donc sur une géométrie réelle du site, et la mesure
 * qui en sort est celle de cette géométrie.
 */
export function CalibrationSurface(
  { site, levelId, pointA, pointB, onPlace }: CalibrationSurfaceProps,
): JSX.Element {
  const { t } = useI18n();

  const outlines = useMemo(() => projectLevel(site, levelId).outlines, [site, levelId]);

  function handleClick(event: React.MouseEvent<SVGSVGElement>): void {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = SURFACE_WIDTH / rect.width;
    const scaleY = SURFACE_HEIGHT / rect.height;
    onPlace({
      x_px: (event.clientX - rect.left) * scaleX,
      y_px: (event.clientY - rect.top) * scaleY,
    });
  }

  return (
    <svg
      viewBox={`0 0 ${String(SURFACE_WIDTH)} ${String(SURFACE_HEIGHT)}`}
      width="100%"
      role="img"
      aria-label={t('calibration.surface.aria')}
      onClick={handleClick}
      style={{ display: 'block', background: 'var(--surface-canvas)', cursor: 'crosshair' }}
    >
      {outlines.map(outline => (
        <polygon
          key={outline.id}
          points={outline.points}
          fill="var(--surface-sunken)"
          stroke="var(--border-strong)"
          strokeWidth={1}
        />
      ))}
      {pointA !== null && pointB !== null && (
        <line
          x1={pointA.x_px} y1={pointA.y_px}
          x2={pointB.x_px} y2={pointB.y_px}
          stroke="var(--accent)"
          strokeWidth={2}
        />
      )}
      {pointA !== null && <Marker point={pointA} label="A" />}
      {pointB !== null && <Marker point={pointB} label="B" />}
    </svg>
  );
}

type MarkerProps = {
  readonly point: PlanPoint;
  readonly label: string;
};

function Marker({ point, label }: MarkerProps): JSX.Element {
  return (
    <g>
      <circle
        cx={point.x_px}
        cy={point.y_px}
        r={6}
        fill="var(--surface-panel)"
        stroke="var(--accent)"
        strokeWidth={3}
      />
      <text
        x={point.x_px + 10}
        y={point.y_px - 8}
        fill="var(--text-primary)"
        fontSize={12}
        fontFamily="var(--font-mono)"
      >
        {label}
      </text>
    </g>
  );
}
