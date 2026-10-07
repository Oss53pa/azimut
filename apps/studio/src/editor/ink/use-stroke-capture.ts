import { useRef, useState } from 'react';
import type { Point } from '@azimut/core-model';
import { INITIAL_ARBITER, arbitrate } from './pointer-arbiter.js';
import type { ArbiterState, PointerPhase } from './pointer-arbiter.js';
import { canTraceFreely, isPenEraser, pointerKindOf } from './pointer-kind.js';
import type { PointerKind } from './pointer-kind.js';

/**
 * J1.1 et G3 (parties J et G) — la capture d'un trait dans une zone de travail.
 *
 * Un trait commence quand un pointeur qui trace se pose, suit ses
 * déplacements, et s'achève à sa levée : il est alors remis à l'appelant, en
 * mètres, avec le type du pointeur et l'échelle à laquelle il a été vu.
 *
 * La pression lue à chaque point est remise avec le trait : seule l'esquisse
 * la garde (J3.2), la reconnaissance de forme l'ignore.
 *
 * L'arbitre écarte la paume pendant que le stylet est actif (G3.4) ; le doigt,
 * qui ne trace pas (G3.1), est refusé, et l'appelant en dit le motif (G3.5).
 *
 * La zone peut être mise à l'échelle par la feuille de style (`viewBox`) :
 * les coordonnées de l'événement sont ramenées au repère de la vue, et
 * l'échelle remise est celle de l'écran, à laquelle le geste a été tracé.
 */
export type StrokeCaptureOptions = {
  /** Largeur de la vue, dans son propre repère. */
  readonly viewWidth_px: number;
  /** Échelle de la vue, en pixels de son repère par mètre. */
  readonly scale_px_per_m: number;
  /** Du repère de la vue vers le repère du site. */
  readonly toMetres: (at: { readonly x_px: number; readonly y_px: number }) => Point;
  /**
   * `origin` est l'élément sous le pointeur au moment où il s'est posé : la
   * vue y reconnaît un point appuyé sur un objet, qui est une sélection et non
   * un tracé.
   */
  readonly onStroke: (
    points: readonly Point[], pointer: PointerKind, pxPerMeter: number, origin: Element | null,
    detail: StrokeDetail,
  ) => void;
  readonly onTouchRefused: () => void;
};

/** Ce que le trait porte en plus de son tracé. */
export type StrokeDetail = {
  /** La pression lue à chaque point, de 0 à 1. */
  readonly pressures: readonly number[];
  /** Le geste a été fait du bout gomme ou bouton latéral enfoncé (J1.5). */
  readonly eraser: boolean;
};

type PointerEventLike = {
  readonly target: EventTarget | null;
  readonly pointerType: string;
  readonly pointerId: number;
  readonly timeStamp: number;
  readonly clientX: number;
  readonly clientY: number;
  /** La pression sous la pointe, de 0 à 1 ; 0 quand le pointeur ne la signale pas. */
  readonly pressure?: number;
  /** Les boutons enfoncés, au sens de `PointerEvent.buttons`. */
  readonly buttons?: number;
  readonly currentTarget: Element;
};

export type StrokeCapture = {
  readonly handlers: {
    readonly onPointerDown: (event: PointerEventLike) => void;
    readonly onPointerMove: (event: PointerEventLike) => void;
    readonly onPointerUp: (event: PointerEventLike) => void;
    readonly onPointerCancel: (event: PointerEventLike) => void;
  };
  /** Le trait en cours, en mètres, ou `null` hors tracé. */
  readonly live: readonly Point[] | null;
};

export function useStrokeCapture(options: StrokeCaptureOptions): StrokeCapture {
  const arbiter = useRef<ArbiterState>(INITIAL_ARBITER);
  const stroke = useRef<{
    pointerId: number; kind: PointerKind; points: Point[]; pressures: number[]; origin: Element | null;
    eraser: boolean;
  } | null>(null);
  const [live, setLive] = useState<readonly Point[] | null>(null);

  function admit(event: PointerEventLike, phase: PointerPhase): PointerKind | null {
    const kind = pointerKindOf(event.pointerType);
    const out = arbitrate(arbiter.current, { kind, phase, pointerId: event.pointerId, at_ms: event.timeStamp });
    arbiter.current = out.state;
    return out.accept ? kind : null;
  }

  /**
   * La matrice de l'écran vers le repère de la vue, quand la zone est un SVG.
   *
   * Elle tient compte du `viewBox` et du centrage (`preserveAspectRatio`) :
   * une vue limitée par sa hauteur est centrée avec un décalage horizontal, que
   * le seul rapport des largeurs ne voit pas — un trait tombait alors à côté
   * des nœuds visés.
   */
  function screenMatrix(event: PointerEventLike): DOMMatrix | null {
    const target = event.currentTarget;
    if (typeof SVGSVGElement === 'undefined' || !(target instanceof SVGSVGElement)) return null;
    return target.getScreenCTM()?.inverse() ?? null;
  }

  /** Le rapport entre l'écran et le repère de la vue. */
  function ratio(event: PointerEventLike): number {
    const matrix = screenMatrix(event);
    if (matrix !== null && matrix.a > 0) return 1 / matrix.a;
    const width = event.currentTarget.getBoundingClientRect().width;
    return width > 0 ? width / options.viewWidth_px : 1;
  }

  function at(event: PointerEventLike): Point {
    const matrix = screenMatrix(event);
    if (matrix !== null) {
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
      return options.toMetres({ x_px: p.x, y_px: p.y });
    }
    const box = event.currentTarget.getBoundingClientRect();
    const k = ratio(event);
    return options.toMetres({ x_px: (event.clientX - box.left) / k, y_px: (event.clientY - box.top) / k });
  }

  return {
    live,
    handlers: {
      onPointerDown: event => {
        const kind = admit(event, 'down');
        if (kind === null) return;
        if (!canTraceFreely(kind)) { options.onTouchRefused(); return; }
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Un pointeur que le navigateur ne connaît pas comme actif ne se
          // capture pas : le trait se suit alors sans capture.
        }
        const origin = event.target instanceof Element ? event.target : null;
        stroke.current = {
          pointerId: event.pointerId, kind, points: [at(event)], pressures: [event.pressure ?? 0], origin,
          eraser: isPenEraser(kind, event.buttons ?? 0),
        };
        setLive(stroke.current.points);
      },
      onPointerMove: event => {
        const current = stroke.current;
        const drawing = current !== null && current.pointerId === event.pointerId;
        if (admit(event, drawing ? 'move' : 'hover') === null || !drawing) return;
        current.points.push(at(event));
        current.pressures.push(event.pressure ?? 0);
        setLive([...current.points]);
      },
      onPointerUp: event => {
        admit(event, 'up');
        const done = stroke.current;
        if (done === null || done.pointerId !== event.pointerId) return;
        stroke.current = null;
        setLive(null);
        options.onStroke(
          done.points, done.kind, options.scale_px_per_m * ratio(event), done.origin,
          { pressures: done.pressures, eraser: done.eraser },
        );
      },
      onPointerCancel: event => {
        admit(event, 'cancel');
        stroke.current = null;
        setLive(null);
      },
    },
  };
}
