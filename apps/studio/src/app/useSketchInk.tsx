import { type JSX, useMemo, useState } from 'react';
import type { Point } from '@azimut/core-model';
import type { StrokeDetail } from '../editor/ink/use-stroke-capture.js';
import type { UiMessageKey } from '../i18n/messages.js';
import { SketchToolbar } from '../screens/SketchToolbar.js';
import type { SketchPen } from '../screens/SketchToolbar.js';
import {
  eraseCommands, layerVisibilityCommand, readSketch, sketchStrokeCommands, strokesTouched,
} from '../state/sketch.js';
import type { SketchColor, SketchStroke } from '../state/sketch.js';
import { ORG_OF_SESSION } from './session-identity.js';
import type { TrancheSession } from './useTrancheSession.js';

/**
 * J3 (partie J) — la couche d'esquisse dans la zone de travail.
 *
 * En mode esquisse, le trait n'est pas lu : il est gardé tel quel, avec sa
 * pression, et écrit dans la couche du niveau, créée au premier trait. La
 * gomme retire d'un geste les traits qu'elle touche. Chaque geste est une
 * commande, annulable d'une frappe.
 *
 * Hors mode esquisse, la couche reste affichée sous le travail, ou masquée.
 */
export type SketchInk = {
  readonly active: boolean;
  readonly toolbar: JSX.Element;
  /** Les traits à montrer : aucun quand la couche est masquée. */
  readonly strokes: readonly SketchStroke[];
  readonly onStroke: (points: readonly Point[], detail: StrokeDetail, pxPerMeter: number) => void;
};

/** Le nom donné à la couche créée au premier trait. */
const DEFAULT_LAYER_NAME = 'Esquisse';

/** La portée de la gomme, en pixels d'écran autour de la pointe. */
const ERASER_REACH_PX = 8;

export function useSketchInk(
  session: TrancheSession, levelId: string, onNotice: (notice: UiMessageKey | null) => void,
): SketchInk {
  const [active, setActive] = useState(false);
  const [pen, setPen] = useState<SketchPen>('felt');
  const [color, setColor] = useState<SketchColor>('graphite');
  const sketch = useMemo(() => readSketch(session.state.rows, levelId), [session.state.rows, levelId]);
  const visible = sketch.layer?.visible ?? true;

  function write(commands: Parameters<TrancheSession['write']>[0]): void {
    void session.write(commands);
  }

  function setVisible(next: boolean): void {
    if (sketch.layer === null) return;
    const built = layerVisibilityCommand(sketch.layer, next, { orgId: ORG_OF_SESSION, timestamp: session.now() });
    if (built.ok) write([built.value]);
  }

  function onStroke(points: readonly Point[], detail: StrokeDetail, pxPerMeter: number): void {
    if (!visible) { onNotice('ink.sketch.hidden'); return; }
    if (sketch.layer?.locked === true) { onNotice('ink.sketch.locked'); return; }
    const timestamp = session.now();
    // J1.5 — le bout gomme ou le bouton latéral du stylet gomment, quel que
    // soit l'outil choisi.
    if (pen === 'eraser' || detail.eraser) {
      const touched = strokesTouched(points, sketch.strokes, ERASER_REACH_PX / pxPerMeter);
      if (touched.length === 0) { onNotice('ink.sketch.nothing_erased'); return; }
      const out = eraseCommands(touched, { orgId: ORG_OF_SESSION, timestamp });
      if (out.ok) { onNotice(null); write(out.value); }
      return;
    }
    const out = sketchStrokeCommands(
      sketch.layer ?? { newId: session.newId(), name: DEFAULT_LAYER_NAME },
      {
        id: session.newId(), tool: pen, color,
        points: points.map((p, i) => ({ x_m: p.x_m, y_m: p.y_m, p: detail.pressures[i] ?? 0 })),
      },
      { orgId: ORG_OF_SESSION, siteId: session.siteId, levelId, timestamp },
    );
    if (out.ok) { onNotice(null); write(out.value); }
  }

  return {
    active,
    strokes: visible ? sketch.strokes : [],
    onStroke,
    toolbar: (
      <SketchToolbar
        active={active} onActive={setActive}
        pen={pen} onPen={setPen}
        color={color} onColor={setColor}
        visible={visible} onVisible={setVisible}
        strokeCount={sketch.strokes.length}
      />
    ),
  };
}
