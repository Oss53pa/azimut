import { type JSX, useMemo, useRef } from 'react';
import type { Edge, GraphNode, Point } from '@azimut/core-model';
import { useStrokeCapture } from '../editor/ink/use-stroke-capture.js';
import { pathLength } from '../editor/ink/stroke-geometry.js';
import { RECOGNITION_THRESHOLDS } from '../editor/ink/recognition-thresholds.js';
import type { StrokeCaptureOptions } from '../editor/ink/use-stroke-capture.js';
import { NODE_SHAPE, edgeStroke } from '../state/graph-encoding.js';
import type { NodeShape } from '../state/graph-encoding.js';
import { toMetres, toView } from './view-transform.js';
import { useZoneView } from './use-zone-view.js';
import { ZoneViewControls } from '../screens/ZoneViewControls.js';
import type { ViewPoint, Viewport } from './view-transform.js';
import { useI18n } from '../i18n/useI18n.js';

/**
 * F15, `viewport/` — la zone de travail du graphe.
 *
 * M4 (partie M), « Affichage » : « Les nœuds sont différenciés par leur forme,
 * jamais par la seule couleur. Les arêtes non accessibles sont tracées en
 * trait interrompu. Les cheminements d'évacuation portent un liseré distinct.
 * Aucune de ces distinctions ne repose sur la couleur seule. »
 *
 * L'encodage vit dans `graph-encoding`, en donnée, et cette vue s'y adosse.
 * Aucune forme n'est décidée ici : les redécider donnerait un second encodage,
 * et le contrôle en niveaux de gris porterait sur l'un pendant que l'écran
 * emploie l'autre.
 *
 * E3.1 : la conversion entre repères vient de `view-transform`, et de nulle
 * part ailleurs. E6.2 et E6.3 : chaque objet est atteignable au clavier et
 * porte un nom construit depuis ses données métier, jamais depuis sa forme.
 */

/** La fenêtre de dessin. Fixe : le redimensionnement vient avec la vue libre. */
const VIEWPORT: Viewport = { width_px: 640, height_px: 420 };

/** Demi-côté d'un nœud, en pixels. Constante nommée, jamais dispersée. */
const NODE_RADIUS_PX = 7;

/**
 * Demi-largeur de la zone de clic d'une arête, en pixels.
 *
 * Un segment n'a pas de surface : son rectangle englobant est plat, et ni un
 * opérateur ni un essai ne peuvent le viser. La cible est donc un quadrilatère
 * transparent posé autour du trait. La valeur vaut la tolérance de sélection
 * au pointeur de la section G3.2, portée de part et d'autre.
 */
const EDGE_HIT_HALF_WIDTH_PX = 8;

/** Le quadrilatère qui épaissit un segment, perpendiculairement à lui. */
function hitArea(from: ViewPoint, to: ViewPoint): string {
  const dx = to.x_px - from.x_px;
  const dy = to.y_px - from.y_px;
  const length = Math.hypot(dx, dy);
  if (length === 0) return '';
  const nx = (-dy / length) * EDGE_HIT_HALF_WIDTH_PX;
  const ny = (dx / length) * EDGE_HIT_HALF_WIDTH_PX;
  return [
    `${from.x_px + nx},${from.y_px + ny}`,
    `${to.x_px + nx},${to.y_px + ny}`,
    `${to.x_px - nx},${to.y_px - ny}`,
    `${from.x_px - nx},${from.y_px - ny}`,
  ].join(' ');
}

export type GraphSelection =
  | { readonly kind: 'node'; readonly id: string }
  | { readonly kind: 'edge'; readonly id: string };

export type GraphViewProps = {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly Edge[];
  readonly selected: GraphSelection | null;
  readonly onSelect: (selection: GraphSelection) => void;
  /**
   * J1 (partie J) — le tracé au stylet ou à la souris dans la vue. Absent, la
   * vue ne fait que montrer et sélectionner.
   */
  readonly ink?: Pick<StrokeCaptureOptions, 'onStroke' | 'onTouchRefused'>;
  /**
   * Ce sur quoi la vue s'ajuste, en plus des nœuds : les empreintes du niveau.
   * Sans lui, la vue suivrait chaque nœud posé, et un point appuyé tomberait
   * ailleurs que là où le précédent l'annonçait.
   */
  readonly frame?: readonly Point[];
  /** Clé de mémoire de la vue : la zone et son niveau (E3.3). */
  readonly viewKey?: string;
};

const IDLE_INK: Pick<StrokeCaptureOptions, 'onStroke' | 'onTouchRefused'> = {
  onStroke: () => undefined,
  onTouchRefused: () => undefined,
};

export function GraphView(props: GraphViewProps): JSX.Element {
  const { t } = useI18n();
  const { frame } = props;
  const surface = useRef<SVGSVGElement>(null);
  const zone = useZoneView({
    memoryKey: props.viewKey ?? null,
    viewport: VIEWPORT,
    fitTo: [...(frame ?? []), ...props.nodes.map(n => n.position)],
    surface,
  });
  const { view } = zone;
  const ink = props.ink ?? IDLE_INK;
  const { handlers, live } = useStrokeCapture({
    viewWidth_px: VIEWPORT.width_px,
    scale_px_per_m: view.scale_px_per_m,
    toMetres: at => toMetres(at, view, VIEWPORT),
    // Un point appuyé sur un nœud ou une arête est une sélection, comme un clic
    // hors tracé : la capture du pointeur détourne le clic vers la vue, et le
    // geste poserait sinon un nœud sur l'arête que l'on voulait choisir.
    onStroke: (points, pointer, pxPerMeter, origin, pressures) => {
      const item = origin?.closest('[data-select-kind]') ?? null;
      const tap = pathLength(points) * pxPerMeter <= RECOGNITION_THRESHOLDS.normal.tap_px;
      const kind = item?.getAttribute('data-select-kind');
      const id = item?.getAttribute('data-select-id');
      if (tap && (kind === 'node' || kind === 'edge') && typeof id === 'string') {
        props.onSelect({ kind, id });
        return;
      }
      ink.onStroke(points, pointer, pxPerMeter, origin, pressures);
    },
    onTouchRefused: ink.onTouchRefused,
  });
  const livePath = live === null ? '' : live.map((p, i) => {
    const v = toView(p, view, VIEWPORT);
    return `${i === 0 ? 'M' : 'L'}${v.x_px.toFixed(2)},${v.y_px.toFixed(2)}`;
  }).join(' ');
  const placed = useMemo(() => {
    const at = new Map<string, ViewPoint>();
    for (const node of props.nodes) at.set(node.id, toView(node.position, view, VIEWPORT));
    return at;
  }, [props.nodes, view]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
    {props.ink !== undefined && (
      <ZoneViewControls onZoomIn={() => { zone.zoomBy(1); }} onZoomOut={() => { zone.zoomBy(-1); }} onRefit={zone.refit} />
    )}
    <svg
      ref={surface}
      role="group"
      aria-label={t('graph.view.label')}
      viewBox={`0 0 ${String(VIEWPORT.width_px)} ${String(VIEWPORT.height_px)}`}
      style={{
        width: '100%', height: '100%',
        background: 'var(--surface-canvas)',
        border: '1px solid var(--border-strong)',
        ...(props.ink === undefined ? {} : { touchAction: 'none' }),
      }}
      {...(props.ink === undefined ? {} : zone.intercept(handlers))}
    >
      {props.edges.map(edge => {
        const from = placed.get(edge.from_node_id);
        const to = placed.get(edge.to_node_id);
        if (from === undefined || to === undefined) return null;
        const stroke = edgeStroke({
          accessible: edge.accessible,
          evacuationRoute: edge.evacuation_route,
        });
        const chosen = props.selected?.kind === 'edge' && props.selected.id === edge.id;
        return (
          <g key={edge.id}>
            {/* Le liseré d'évacuation : un second trait, plus large, dessous. */}
            {stroke.outlined && (
              <line
                x1={from.x_px} y1={from.y_px} x2={to.x_px} y2={to.y_px}
                stroke="var(--text-muted)" strokeWidth={6} strokeLinecap="round"
              />
            )}
            <line
              x1={from.x_px} y1={from.y_px} x2={to.x_px} y2={to.y_px}
              stroke="var(--text-primary)"
              strokeWidth={chosen ? 4 : 2}
              strokeDasharray={stroke.dashed ? '6 4' : undefined}
            />
            <polygon
              tabIndex={0}
              role="button"
              aria-label={t('graph.view.edge', {
                from: edge.from_node_id, to: edge.to_node_id,
                length: edge.length_m.toFixed(3),
              })}
              aria-pressed={chosen}
              points={hitArea(from, to)}
              data-select-kind="edge"
              data-select-id={edge.id}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => { props.onSelect({ kind: 'edge', id: edge.id }); }}
              onKeyDown={event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                props.onSelect({ kind: 'edge', id: edge.id });
              }}
            />
          </g>
        );
      })}

      {props.nodes.map(node => {
        const at = placed.get(node.id);
        if (at === undefined) return null;
        const chosen = props.selected?.kind === 'node' && props.selected.id === node.id;
        return (
          <g
            key={node.id}
            tabIndex={0}
            role="button"
            aria-label={t('graph.view.node', {
              kind: t(`graph.node.kind.${node.kind}`),
              label: node.label === '' ? t('graph.view.unlabelled') : node.label,
              x: node.position.x_m.toFixed(3),
              y: node.position.y_m.toFixed(3),
            })}
            aria-pressed={chosen}
            data-select-kind="node"
            data-select-id={node.id}
            style={{ cursor: 'pointer' }}
            onClick={() => { props.onSelect({ kind: 'node', id: node.id }); }}
            onKeyDown={event => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              props.onSelect({ kind: 'node', id: node.id });
            }}
          >
            <NodeMark shape={NODE_SHAPE[node.kind]} at={at} selected={chosen} />
          </g>
        );
      })}
      {livePath !== '' && (
        <path d={livePath} fill="none" stroke="var(--text-primary)" strokeWidth={1.5}
          strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
      )}
    </svg>
    </div>
  );
}

/**
 * La forme d'un nœud. Sept formes, aucune couleur.
 *
 * `label` n'est pas une forme : c'est le canal que `DISTINCTION_CHANNEL`
 * réserve aux types qui en partagent une, et il vit dans le nom accessible du
 * nœud plutôt que dans son dessin, qui serait illisible à cette taille.
 */
function NodeMark({ shape, at, selected }: {
  readonly shape: NodeShape;
  readonly at: ViewPoint;
  readonly selected: boolean;
}): JSX.Element {
  const r = NODE_RADIUS_PX;
  const common = {
    fill: 'var(--surface-panel)',
    stroke: 'var(--text-primary)',
    strokeWidth: selected ? 3 : 1.5,
  };
  const { x_px: x, y_px: y } = at;

  if (shape === 'circle') return <circle cx={x} cy={y} r={r} {...common} />;
  if (shape === 'square') {
    return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} {...common} />;
  }
  if (shape === 'diamond') {
    return <polygon points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`} {...common} />;
  }
  if (shape === 'triangle') {
    return <polygon points={`${x},${y - r} ${x + r},${y + r} ${x - r},${y + r}`} {...common} />;
  }
  if (shape === 'chevron') {
    return (
      <polyline
        points={`${x - r},${y + r / 2} ${x},${y - r / 2} ${x + r},${y + r / 2}`}
        {...common}
        fill="none"
      />
    );
  }
  if (shape === 'cross') {
    return (
      <g {...common}>
        <line x1={x - r} y1={y - r} x2={x + r} y2={y + r} />
        <line x1={x - r} y1={y + r} x2={x + r} y2={y - r} />
      </g>
    );
  }
  // hexagone
  const points = [0, 1, 2, 3, 4, 5].map(i => {
    const angle = (Math.PI / 3) * i;
    return `${(x + r * Math.cos(angle)).toFixed(3)},${(y + r * Math.sin(angle)).toFixed(3)}`;
  });
  return <polygon points={points.join(' ')} {...common} />;
}
