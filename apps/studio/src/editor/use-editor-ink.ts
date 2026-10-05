import { useRef, useState } from 'react';
import type { Point, ViewState, ViewportSize } from '@azimut/core-model';
import { pixelToMeter } from '@azimut/core-model';
import type { ShapeCommandData } from './command-integration.js';
import type { ToolId } from './tool-state.js';
import { strokeToEditorEllipse } from './ink/editor-ellipse.js';
import { recallStrictness } from './ink/strictness-memory.js';
import { browserStore } from '../viewport/view-memory.js';

/**
 * J1 et J1.2 (partie J) — le stylet dans l'éditeur d'habillage.
 *
 * Avec l'outil Ellipse, le stylet trace à main levée : le trait apparaît tel
 * quel, puis il est lu à la levée (J1.1) et devient une ellipse, cercle si
 * proche. La souris garde le geste de l'éditeur, le cadre tiré d'un coin à
 * l'autre (E7.1) : les deux saisies coexistent, aucune ne remplace l'autre.
 *
 * Le niveau de redressement est celui que l'utilisateur a retenu (J1.3).
 */
export type EditorInkNotice = 'ellipse_done' | 'ellipse_circle' | 'ellipse_oblique' | 'ellipse_unrecognized';

type InkEvent = {
  readonly pointerType: string;
  readonly pointerId: number;
  readonly button: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly currentTarget: Element;
};

export function useEditorInk(options: {
  readonly tool: ToolId;
  readonly view: ViewState;
  readonly viewport: ViewportSize;
  readonly onCommit: (data: ShapeCommandData) => void;
  readonly onNotice: (notice: EditorInkNotice) => void;
}): {
  readonly down: (event: InkEvent) => boolean;
  readonly move: (event: InkEvent) => boolean;
  readonly up: (event: InkEvent) => boolean;
  readonly live: readonly Point[] | null;
} {
  const stroke = useRef<{ pointerId: number; points: Point[] } | null>(null);
  const [live, setLive] = useState<readonly Point[] | null>(null);

  function at(event: InkEvent): Point {
    const box = event.currentTarget.getBoundingClientRect();
    return pixelToMeter({ x: event.clientX - box.left, y: event.clientY - box.top }, options.view, options.viewport);
  }

  return {
    live,
    down: event => {
      if (event.pointerType !== 'pen' || event.button !== 0 || options.tool !== 'ellipse') return false;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch {
        // Un pointeur inconnu du navigateur ne se capture pas : le trait se suit sans.
      }
      stroke.current = { pointerId: event.pointerId, points: [at(event)] };
      setLive(stroke.current.points);
      return true;
    },
    move: event => {
      const current = stroke.current;
      if (current === null || current.pointerId !== event.pointerId) return false;
      current.points.push(at(event));
      setLive([...current.points]);
      return true;
    },
    up: event => {
      const done = stroke.current;
      if (done === null || done.pointerId !== event.pointerId) return false;
      stroke.current = null;
      setLive(null);
      const reading = strokeToEditorEllipse(done.points, {
        pxPerMeter: options.view.scale_px_per_m, strictness: recallStrictness(browserStore()),
      });
      if (reading.kind === 'ellipse') {
        options.onCommit(reading.data);
        options.onNotice(reading.circle ? 'ellipse_circle' : 'ellipse_done');
        return true;
      }
      options.onNotice(reading.kind === 'oblique' ? 'ellipse_oblique' : 'ellipse_unrecognized');
      return true;
    },
  };
}
