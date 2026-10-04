import { useEffect, useRef, useState } from 'react';
import type { Point } from '@azimut/core-model';
import { fitToContent, panBy, zoomAround } from './view-transform.js';
import type { ViewPoint, ViewState, Viewport } from './view-transform.js';
import { browserStore, forgetView, recallView, rememberView } from './view-memory.js';

/**
 * E3.3 — la navigation dans une zone de travail : zoom à la molette autour du
 * pointeur, déplacement au bouton du milieu ou espace enfoncée, boutons de
 * zoom et de recadrage pour le clavier (E6.2).
 *
 * Tant que l'utilisateur n'a pas bougé la vue et qu'aucune vue n'est
 * mémorisée pour ce niveau, elle suit son contenu : le fond de plan, qui se
 * charge après l'ouverture, est ainsi cadré dès qu'il arrive. Dès qu'il l'a
 * bougée, elle ne bouge plus d'elle-même, et sa position est mémorisée.
 */
export type ZoneView = {
  readonly view: ViewState;
  readonly zoomBy: (steps: number) => void;
  readonly refit: () => void;
  /**
   * Intercale le déplacement de vue devant les gestes de la zone : bouton du
   * milieu, ou espace enfoncée. Tout autre appui passe aux gestes.
   */
  readonly intercept: <E>(handlers: PointerHandlers<E>) => PointerHandlers<E & PointerEventLike>;
};

type PointerEventLike = {
  readonly button: number;
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly currentTarget: Element;
};

type PointerHandlers<E> = {
  readonly onPointerDown: (event: E) => void;
  readonly onPointerMove: (event: E) => void;
  readonly onPointerUp: (event: E) => void;
  readonly onPointerCancel: (event: E) => void;
};

/** Molette : un cran pour une impulsion, quelle que soit son amplitude. */
const WHEEL_STEP = 1;

export function useZoneView(options: {
  /** Clé de mémoire : zone et niveau. `null` : rien n'est mémorisé. */
  readonly memoryKey: string | null;
  readonly viewport: Viewport;
  /** Ce sur quoi la vue s'ajuste. */
  readonly fitTo: readonly Point[];
  /** L'élément qui reçoit la molette. */
  readonly surface: React.RefObject<Element | null>;
}): ZoneView {
  const { memoryKey, viewport, fitTo, surface } = options;
  const fitKey = JSON.stringify(fitTo);
  const recalled = useRef(memoryKey === null ? null : recallView(memoryKey, browserStore()));
  const [pinned, setPinned] = useState(recalled.current !== null);
  const [view, setView] = useState<ViewState>(() => recalled.current ?? fitToContent(fitTo, viewport));

  // La vue suit son contenu tant qu'elle n'est pas épinglée. Le contenu est
  // lu par référence ; l'effet ne se rejoue que si sa valeur change.
  const content = useRef(fitTo);
  content.current = fitTo;
  const { width_px, height_px } = viewport;
  useEffect(() => {
    if (!pinned) setView(fitToContent(content.current, { width_px, height_px }));
  }, [fitKey, pinned, width_px, height_px]);

  useEffect(() => {
    if (pinned && memoryKey !== null) rememberView(memoryKey, view, browserStore());
  }, [pinned, memoryKey, view]);

  function move(next: (current: ViewState) => ViewState): void {
    setPinned(true);
    setView(current => next(current));
  }

  // La molette, écoutée hors de React : un écouteur passif ne peut pas
  // empêcher le défilement de la page.
  const latest = useRef({ viewport, move });
  latest.current = { viewport, move };
  useEffect(() => {
    const element = surface.current;
    if (element === null) return undefined;
    const onWheel = (event: Event): void => {
      if (!(event instanceof WheelEvent)) return;
      event.preventDefault();
      const box = element.getBoundingClientRect();
      const k = box.width > 0 ? latest.current.viewport.width_px / box.width : 1;
      const pivot: ViewPoint = { x_px: (event.clientX - box.left) * k, y_px: (event.clientY - box.top) * k };
      const steps = event.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP;
      latest.current.move(current => zoomAround(current, latest.current.viewport, pivot, steps));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => { element.removeEventListener('wheel', onWheel); };
  }, [surface]);

  // Espace enfoncée : le geste suivant déplace la vue. Ignorée dans un champ
  // de saisie, où c'est un caractère.
  const space = useRef(false);
  useEffect(() => {
    const typing = (target: EventTarget | null): boolean =>
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement;
    const down = (event: KeyboardEvent): void => { if (event.key === ' ' && !typing(event.target)) space.current = true; };
    const up = (event: KeyboardEvent): void => { if (event.key === ' ') space.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const panning = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  return {
    view,
    zoomBy: steps => {
      const centre: ViewPoint = { x_px: viewport.width_px / 2, y_px: viewport.height_px / 2 };
      move(current => zoomAround(current, viewport, centre, steps));
    },
    refit: () => {
      setPinned(false);
      setView(fitToContent(fitTo, viewport));
      if (memoryKey !== null) forgetView(memoryKey, browserStore());
    },
    intercept: handlers => ({
      onPointerDown: event => {
        if (event.button !== 1 && !space.current) { handlers.onPointerDown(event); return; }
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture facultative */ }
        panning.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      },
      onPointerMove: event => {
        const pan = panning.current;
        if (pan === null || pan.pointerId !== event.pointerId) { handlers.onPointerMove(event); return; }
        const box = event.currentTarget.getBoundingClientRect();
        const k = box.width > 0 ? viewport.width_px / box.width : 1;
        const dx = (event.clientX - pan.x) * k;
        const dy = (event.clientY - pan.y) * k;
        panning.current = { ...pan, x: event.clientX, y: event.clientY };
        move(current => panBy(current, dx, dy));
      },
      onPointerUp: event => {
        if (panning.current?.pointerId === event.pointerId) { panning.current = null; return; }
        handlers.onPointerUp(event);
      },
      onPointerCancel: event => {
        if (panning.current?.pointerId === event.pointerId) { panning.current = null; return; }
        handlers.onPointerCancel(event);
      },
    }),
  };
}
