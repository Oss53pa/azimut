import { type JSX, useMemo, useState } from 'react';
import type { Point } from '@azimut/core-model';
import { useI18n } from '../i18n/useI18n.js';
import type { UiMessageKey } from '../i18n/messages.js';
import { InkWorkZone } from '../screens/InkWorkZone.js';
import {
  alternativeReading, currentReading, nextReading, strokeToFootprint,
} from '../state/footprint-ink.js';
import type { FootprintArbitration, FootprintShape } from '../state/footprint-ink.js';
import type { FootprintTool } from '../state/footprint-shortcuts.js';
import { footprintsOfLevel } from '../state/session-scope.js';
import { usePlanBackground } from './usePlanBackground.js';
import type { TrancheSession } from './useTrancheSession.js';

/**
 * J1 (partie J) — le tracé au stylet dans l'atelier des empreintes (M3, partie M).
 *
 * Un trait achevé est lu ; la lecture retenue remplace le contour en cours,
 * que le panneau montre sommet par sommet et que `Entrée` ferme comme une
 * saisie au clavier. L'arbitrage se clôt à la fermeture ou à l'abandon du
 * contour : le trait d'origine disparaît alors, et seule la forme quantifiée
 * reste (J0).
 *
 * L'intensité du redressement est au niveau intermédiaire. J1.3 la veut
 * mémorisée par utilisateur, ce que le studio ne sait pas encore faire.
 */
export type FootprintInk = {
  readonly zone: JSX.Element;
  /** Clôt l'arbitrage : le trait d'origine disparaît. */
  readonly settle: () => void;
};

const SHAPE_LABEL: Readonly<Record<FootprintShape['kind'], UiMessageKey>> = {
  rectangle: 'ink.shape.rectangle',
  polygon: 'ink.shape.polygon',
};

export function useFootprintInk(
  session: TrancheSession,
  levelId: string,
  tool: FootprintTool,
  vertices: readonly Point[],
  onVertices: (vertices: readonly Point[]) => void,
): FootprintInk {
  const { t } = useI18n();
  const [arbitration, setArbitration] = useState<FootprintArbitration | null>(null);
  const [ghost, setGhost] = useState<readonly Point[] | null>(null);
  const [notice, setNotice] = useState<UiMessageKey | null>(null);
  const { background, notice: backgroundNotice } = usePlanBackground(session, levelId);

  const footprints = useMemo(
    () => footprintsOfLevel(session.state, levelId).map(f => ({ id: f.id, outline: f.geometry.vertices })),
    [session.state, levelId],
  );

  const reading = arbitration === null ? null : currentReading(arbitration);
  const alternative = arbitration === null ? null : alternativeReading(arbitration);
  const label = (shape: FootprintShape): string => t(SHAPE_LABEL[shape.kind]);

  const zone = (
    <InkWorkZone
      footprints={footprints}
      draft={vertices}
      ghost={ghost}
      background={background}
      notices={[
        ...(notice === null ? [] : [t(notice)]),
        ...(backgroundNotice === null ? [] : [t(backgroundNotice)]),
      ]}
      recognized={reading === null ? null : t('ink.recognized', { shape: label(reading) })}
      alternative={alternative === null ? null : t('ink.alternative', { shape: label(alternative) })}
      onAlternative={() => {
        if (arbitration === null) return;
        const next = nextReading(arbitration);
        setArbitration(next);
        const shape = currentReading(next);
        if (shape !== null) onVertices(shape.vertices);
      }}
      onTouchRefused={() => { setNotice('ink.touch_refused'); }}
      onStroke={(points, pointer, pxPerMeter) => {
        const out = strokeToFootprint(points, {
          tool, pointer, pxPerMeter, strictness: 'normal', footprints,
        });
        if (out.kind === 'not_tracing_tool') {
          setArbitration(null); setGhost(null); setNotice('ink.not_tracing_tool');
          return;
        }
        if (out.kind === 'unrecognized') {
          setArbitration(null); setGhost(out.ghost); setNotice('ink.unrecognized');
          return;
        }
        setArbitration(out.arbitration);
        setGhost(out.arbitration.ghost);
        setNotice(null);
        const shape = currentReading(out.arbitration);
        if (shape !== null) onVertices(shape.vertices);
      }}
    />
  );

  return {
    zone,
    settle: () => { setArbitration(null); setGhost(null); setNotice(null); },
  };
}
