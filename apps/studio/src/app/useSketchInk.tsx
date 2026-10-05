import { type JSX, useMemo, useState } from 'react';
import type { Point } from '@azimut/core-model';
import type { StrokeDetail } from '../editor/ink/use-stroke-capture.js';
import type { PointerKind } from '../editor/ink/pointer-kind.js';
import { chainStrokes, strokesInside } from '../state/sketch-promotion.js';
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
 *
 * Le lasso choisit les traits qu'il entoure ; « Convertir en forme » les remet
 * alors, bout à bout, à l'atelier qui les lit comme une saisie (J3.3). Sans
 * appelant qui sache convertir, le lasso n'est pas proposé.
 */
export type SketchInk = {
  readonly active: boolean;
  readonly toolbar: JSX.Element;
  /** Les traits à montrer : aucun quand la couche est masquée. */
  readonly strokes: readonly SketchStroke[];
  readonly onStroke: (
    points: readonly Point[], detail: StrokeDetail, pxPerMeter: number, pointer: PointerKind,
  ) => void;
  /** Les traits choisis au lasso. */
  readonly selected: readonly string[];
};

/** Ce que l'atelier reçoit d'une promotion : un tracé, lu comme un trait. */
export type SketchPromotion = (points: readonly Point[], pointer: PointerKind, pxPerMeter: number) => void;

type Selection = {
  readonly ids: readonly string[];
  readonly pointer: PointerKind;
  readonly pxPerMeter: number;
};

/** Le nom donné à la couche créée au premier trait. */
const DEFAULT_LAYER_NAME = 'Esquisse';

/** La portée de la gomme, en pixels d'écran autour de la pointe. */
const ERASER_REACH_PX = 8;

export function useSketchInk(
  session: TrancheSession, levelId: string, onNotice: (notice: UiMessageKey | null) => void,
  onPromote?: SketchPromotion,
): SketchInk {
  const [active, setActiveState] = useState(false);
  const setActive = (next: boolean): void => {
    setActiveState(next);
    if (!next) setSelection(null);
  };
  const [pen, setPen] = useState<SketchPen>('felt');
  const [color, setColor] = useState<SketchColor>('graphite');
  const sketch = useMemo(() => readSketch(session.state.rows, levelId), [session.state.rows, levelId]);
  const visible = sketch.layer?.visible ?? true;
  const [selection, setSelection] = useState<Selection | null>(null);
  // Un trait gommé ou annulé sort de la sélection.
  const selected = (selection?.ids ?? []).filter(id => sketch.strokes.some(s => s.id === id));

  function promote(): void {
    if (selection === null || onPromote === undefined || selected.length === 0) return;
    const points = chainStrokes(sketch.strokes, selected);
    setSelection(null);
    setActive(false);
    onPromote(points, selection.pointer, selection.pxPerMeter);
  }

  function write(commands: Parameters<TrancheSession['write']>[0]): void {
    void session.write(commands);
  }

  function setVisible(next: boolean): void {
    if (sketch.layer === null) return;
    const built = layerVisibilityCommand(sketch.layer, next, { orgId: ORG_OF_SESSION, timestamp: session.now() });
    if (built.ok) write([built.value]);
  }

  function onStroke(points: readonly Point[], detail: StrokeDetail, pxPerMeter: number, pointer: PointerKind): void {
    if (!visible) { onNotice('ink.sketch.hidden'); return; }
    // J1.5 — le bout gomme ou le bouton latéral du stylet gomment, quel que
    // soit l'outil choisi.
    if (pen === 'eraser' || detail.eraser) {
      if (sketch.layer?.locked === true) { onNotice('ink.sketch.locked'); return; }
      const touched = strokesTouched(points, sketch.strokes, ERASER_REACH_PX / pxPerMeter);
      if (touched.length === 0) { onNotice('ink.sketch.nothing_erased'); return; }
      const out = eraseCommands(touched, { orgId: ORG_OF_SESSION, timestamp: session.now() });
      if (out.ok) { onNotice(null); write(out.value); }
      return;
    }
    // Le lasso ne fait que choisir : il est permis sur une couche verrouillée.
    if (pen === 'lasso') {
      const ids = strokesInside(points, sketch.strokes);
      setSelection(ids.length === 0 ? null : { ids, pointer, pxPerMeter });
      onNotice(ids.length === 0 ? 'ink.sketch.nothing_selected' : null);
      return;
    }
    if (sketch.layer?.locked === true) { onNotice('ink.sketch.locked'); return; }
    const timestamp = session.now();
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
    selected,
    toolbar: (
      <SketchToolbar
        active={active} onActive={setActive}
        pen={pen} onPen={setPen}
        color={color} onColor={setColor}
        visible={visible} onVisible={setVisible}
        strokeCount={sketch.strokes.length}
        canLasso={onPromote !== undefined}
        selectedCount={selected.length}
        onPromote={promote}
      />
    ),
  };
}
