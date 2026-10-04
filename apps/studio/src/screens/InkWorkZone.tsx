import { type JSX, useEffect, useMemo, useRef, useState } from 'react';
import type { Point } from '@azimut/core-model';
import { Button, StateBanner, SPACE, TEXT } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { fitToContent, toMetres, toView } from '../viewport/view-transform.js';
import type { ViewState, Viewport } from '../viewport/view-transform.js';
import { imageMatrix, imageToWorld } from '../domain/plan-placement.js';
import type { PlanPlacement } from '../domain/plan-placement.js';
import { useStrokeCapture } from '../editor/ink/use-stroke-capture.js';
import type { PointerKind } from '../editor/ink/pointer-kind.js';

/**
 * J1 et J1.4 (partie J) — la zone de travail de l'atelier des empreintes.
 *
 * Le plan calé en fond, les empreintes déjà posées, le contour en cours, et le
 * trait que l'on trace. À la levée du stylet, le trait est remis à l'atelier,
 * qui le lit (J1.1). Le trait reste en filigrane tant que l'arbitrage n'est
 * pas clos ; la forme reconnue prend l'accent, réservé à ce que le logiciel a
 * calculé (M7.10, partie M).
 *
 * Le doigt ne trace pas (G3.1) : il est refusé avec son motif (G3.5). La paume
 * posée pendant que le stylet est actif est ignorée (G3.4).
 *
 * La saisie numérique reste le moyen le plus précis et le seul accessible au
 * clavier ; cette zone s'y ajoute, elle ne la remplace pas.
 */
export type PlanBackground = {
  readonly href: string;
  readonly width_px: number;
  readonly height_px: number;
  readonly placement: PlanPlacement;
};

export type InkWorkZoneProps = {
  readonly footprints: readonly { readonly id: string; readonly outline: readonly Point[] }[];
  readonly draft: readonly Point[];
  /** Le dernier trait, tant que l'arbitrage n'est pas clos. */
  readonly ghost: readonly Point[] | null;
  readonly background: PlanBackground | null;
  /** Ce que la zone doit dire : fond absent, trait non reconnu, doigt refusé. */
  readonly notices: readonly string[];
  readonly recognized: string | null;
  readonly alternative: string | null;
  readonly onAlternative: () => void;
  readonly onStroke: (points: readonly Point[], pointer: PointerKind, pxPerMeter: number) => void;
  readonly onTouchRefused: () => void;
};

const ZONE_HEIGHT_PX = 420;

function corners(background: PlanBackground): readonly Point[] {
  const { width_px: w, height_px: h, placement } = background;
  return [
    { x_px: 0, y_px: 0 }, { x_px: w, y_px: 0 }, { x_px: w, y_px: h }, { x_px: 0, y_px: h },
  ].map(px => imageToWorld(px, placement));
}

function pathOf(points: readonly Point[], view: ViewState, viewport: Viewport, closed: boolean): string {
  if (points.length === 0) return '';
  const d = points.map((p, i) => {
    const v = toView(p, view, viewport);
    return `${i === 0 ? 'M' : 'L'}${v.x_px.toFixed(2)},${v.y_px.toFixed(2)}`;
  }).join(' ');
  return closed ? `${d} Z` : d;
}

export function InkWorkZone(props: InkWorkZoneProps): JSX.Element {
  const { t } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const viewport: Viewport = { width_px: width, height_px: ZONE_HEIGHT_PX };

  useEffect(() => {
    const element = host.current;
    if (element === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const box = entries[0]?.contentRect.width;
      if (box !== undefined && box > 0) setWidth(Math.round(box));
    });
    observer.observe(element);
    return () => { observer.disconnect(); };
  }, []);

  // La vue s'ajuste sur le plan quand il y en a un, sinon sur ce qui est posé,
  // sinon sur le contour proposé à l'ouverture. Elle ne suit pas le contour en
  // cours : un cadrage qui bouge pendant qu'on trace rend le geste imprévisible.
  const opening = useRef(props.draft).current;
  const { background, footprints } = props;
  const view = useMemo(() => {
    const anchor = background !== null ? corners(background) : footprints.flatMap(f => f.outline);
    return fitToContent(anchor.length > 0 ? anchor : opening, { width_px: width, height_px: ZONE_HEIGHT_PX });
  }, [background, footprints, opening, width]);

  const { handlers, live } = useStrokeCapture({
    viewWidth_px: viewport.width_px,
    scale_px_per_m: view.scale_px_per_m,
    toMetres: at => toMetres(at, view, viewport),
    onStroke: props.onStroke,
    onTouchRefused: props.onTouchRefused,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
      <div ref={host} style={{ width: '100%' }}>
        <svg
          role="img"
          aria-label={t('ink.zone.label')}
          width={width}
          height={ZONE_HEIGHT_PX}
          style={{ display: 'block', background: 'var(--surface-canvas)', touchAction: 'none', cursor: 'crosshair' }}
          {...handlers}
        >
          {props.background !== null && (
            <image
              href={props.background.href}
              width={props.background.width_px}
              height={props.background.height_px}
              transform={imageMatrix(props.background.placement, view, viewport)}
              opacity={0.6}
              preserveAspectRatio="none"
            />
          )}
          {props.footprints.map(f => (
            <path
              key={f.id}
              d={pathOf(f.outline, view, viewport, true)}
              fill="var(--surface-panel)"
              fillOpacity={0.5}
              stroke="var(--border-strong)"
              strokeWidth={1}
            />
          ))}
          {props.ghost !== null && (
            <path d={pathOf(props.ghost, view, viewport, false)} fill="none"
              stroke="var(--text-muted)" strokeOpacity={0.5} strokeWidth={1.5} strokeLinecap="round" />
          )}
          {props.draft.length > 0 && (
            <path data-testid="ink-draft" d={pathOf(props.draft, view, viewport, true)} fill="none"
              stroke="var(--accent)" strokeWidth={2} />
          )}
          {live !== null && (
            <path d={pathOf(live, view, viewport, false)} fill="none"
              stroke="var(--text-primary)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </div>
      {props.recognized !== null && (
        <div style={{ display: 'flex', gap: SPACE.md, alignItems: 'center', flexWrap: 'wrap', fontSize: TEXT.body }}>
          <span role="status">{props.recognized}</span>
          {props.alternative !== null && (
            <>
              <span style={{ color: 'var(--text-secondary)' }}>{props.alternative}</span>
              <Button rank="secondary" onClick={props.onAlternative}>{t('ink.take_alternative')}</Button>
            </>
          )}
        </div>
      )}
      {props.notices.map(notice => <StateBanner key={notice} severity="info" message={notice} />)}
    </div>
  );
}
