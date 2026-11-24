import { type JSX, useContext } from 'react';
import type { Point } from '@azimut/core-model';
import { PresenceContext } from '../context/presence.js';
import type { Presence } from '../state/presence.js';
import { useI18n } from '../i18n/useI18n.js';
import { TEXT } from '../components/ui/index.js';
import type { ViewPoint } from './view-transform.js';

/**
 * S-22 — « La présence des utilisateurs, leur sélection et leur zone de
 * travail sont visibles. Un concepteur doit voir où travaille un autre avant
 * de s'y heurter. »
 *
 * Dessinée par-dessus la vue, sans prendre le pointeur : elle montre, elle ne
 * se sélectionne pas. La couleur est l'accent secondaire du thème : les
 * couleurs d'état sont réservées à leur sens (F2.2). Le nom vient de la base
 * et passe en texte, jamais en balisage. La barre d'état nomme les mêmes
 * présents aux lecteurs d'écran : ce calque leur est caché.
 */
const COLOUR = 'var(--accent-secondary)';

export function PresenceOverlay({ project, nodeAt, edgeEnds }: {
  readonly project: (point: Point) => ViewPoint;
  /** Où un nœud du niveau est dessiné ; absent, la vue n'a pas de nœuds. */
  readonly nodeAt?: (id: string) => ViewPoint | undefined;
  /** Les deux bouts d'une arête du niveau. */
  readonly edgeEnds?: (id: string) => readonly [ViewPoint, ViewPoint] | undefined;
}): JSX.Element | null {
  const present = useContext(PresenceContext);
  const { t } = useI18n();
  if (present === null || present.length === 0) return null;
  const nameOf = (p: Presence): string => p.displayName ?? t(`auth.role.${p.role}`);

  return (
    <g aria-hidden="true" pointerEvents="none">
      {present.map(p => {
        const name = nameOf(p);
        const zone = p.zone === null ? null : (() => {
          const a = project({ x_m: p.zone.x, y_m: p.zone.y + p.zone.h });
          const b = project({ x_m: p.zone.x + p.zone.w, y_m: p.zone.y });
          return { x: a.x_px, y: a.y_px, w: b.x_px - a.x_px, h: b.y_px - a.y_px };
        })();
        return (
          <g key={p.userId} data-presence={p.userId}>
            {zone !== null && (
              <>
                <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h}
                  fill="none" stroke={COLOUR} strokeWidth={1.5} strokeDasharray="8 4" />
                <text x={zone.x + 4} y={zone.y + 14} fill={COLOUR} fontSize={TEXT.micro}>{name}</text>
              </>
            )}
            {p.selection.map(ref => {
              if (ref.table === 'node' && nodeAt !== undefined) {
                const at = nodeAt(ref.id);
                if (at === undefined) return null;
                return (
                  <g key={`${ref.table}:${ref.id}`}>
                    <circle cx={at.x_px} cy={at.y_px} r={12} fill="none" stroke={COLOUR} strokeWidth={2} />
                    <text x={at.x_px + 14} y={at.y_px - 10} fill={COLOUR} fontSize={TEXT.micro}>{name}</text>
                  </g>
                );
              }
              if (ref.table === 'edge' && edgeEnds !== undefined) {
                const ends = edgeEnds(ref.id);
                if (ends === undefined) return null;
                const [from, to] = ends;
                return (
                  <g key={`${ref.table}:${ref.id}`}>
                    <line x1={from.x_px} y1={from.y_px} x2={to.x_px} y2={to.y_px}
                      stroke={COLOUR} strokeWidth={6} strokeOpacity={0.45} strokeLinecap="round" />
                    <text x={(from.x_px + to.x_px) / 2 + 6} y={(from.y_px + to.y_px) / 2 - 8}
                      fill={COLOUR} fontSize={TEXT.micro}>{name}</text>
                  </g>
                );
              }
              return null;
            })}
          </g>
        );
      })}
    </g>
  );
}
