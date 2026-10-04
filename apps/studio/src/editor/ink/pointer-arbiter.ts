import type { PointerKind } from './pointer-kind.js';

/**
 * G3.4 et J1.5 — rejet de la paume.
 *
 * « Rejet de la paume obligatoire dès qu'un stylet est détecté : tout contact
 * tactile est ignoré tant que le stylet est actif. »
 *
 * Le stylet est tenu pour actif tant qu'il touche l'écran, et pendant
 * {@link PEN_IDLE_MS} après son dernier signal, survol compris : la paume se
 * pose souvent avant la pointe, et juste après qu'elle s'est levée. La durée
 * est un paramètre d'ergonomie, réglable.
 *
 * L'arbitre est une fonction pure : l'heure vient de l'événement
 * (`PointerEvent.timeStamp`), jamais d'une horloge. Deux suites d'événements
 * identiques donnent deux suites de décisions identiques.
 *
 * Ce qu'il ne tranche pas : la navigation à deux doigts pendant que le stylet
 * dessine. J1.5 l'admet et, dans la même phrase, dit tout contact tactile
 * ignoré. La contradiction est signalée à l'éditeur du cahier (A2.2) ; en
 * attendant, un contact tactile pendant que le stylet est actif est ignoré,
 * ce qui ne trace ni ne sélectionne rien.
 */
export const PEN_IDLE_MS = 1_500;

export type PointerPhase = 'hover' | 'down' | 'move' | 'up' | 'cancel';

export type ArbitratedEvent = {
  readonly kind: PointerKind;
  readonly phase: PointerPhase;
  readonly pointerId: number;
  /** Heure de l'événement, en millisecondes (`PointerEvent.timeStamp`). */
  readonly at_ms: number;
};

export type ArbiterState = {
  /** Les pointeurs stylet actuellement posés. */
  readonly pensDown: readonly number[];
  /** Heure du dernier signal d'un stylet, ou `null` si aucun n'a été vu. */
  readonly lastPenAt_ms: number | null;
};

export const INITIAL_ARBITER: ArbiterState = { pensDown: [], lastPenAt_ms: null };

export type Arbitration = {
  readonly state: ArbiterState;
  /** L'événement est-il transmis aux outils ? */
  readonly accept: boolean;
};

/** Le stylet est-il actif à cet instant ? */
export function penActive(state: ArbiterState, at_ms: number): boolean {
  if (state.pensDown.length > 0) return true;
  return state.lastPenAt_ms !== null && at_ms - state.lastPenAt_ms < PEN_IDLE_MS;
}

/** Décide du sort d'un événement de pointeur, et rend l'état suivant. */
export function arbitrate(state: ArbiterState, event: ArbitratedEvent): Arbitration {
  if (event.kind === 'pen') {
    const others = state.pensDown.filter(id => id !== event.pointerId);
    const pensDown = event.phase === 'down' ? [...others, event.pointerId]
      : event.phase === 'up' || event.phase === 'cancel' ? others
      : state.pensDown;
    return { state: { pensDown, lastPenAt_ms: event.at_ms }, accept: true };
  }
  if (event.kind === 'touch') {
    return { state, accept: !penActive(state, event.at_ms) };
  }
  return { state, accept: true };
}
