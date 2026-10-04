/**
 * G3.1 et G3.2 (partie G) — trois types de pointeur, des capacités assumées.
 *
 * « Prétendre que tout est possible partout produit une interface mauvaise
 * partout. » Le stylet et la souris tracent ; le doigt navigue, sélectionne et
 * édite des propriétés, mais ne trace jamais librement : la précision d'une
 * empreinte ne s'obtient pas au doigt.
 *
 * Les tolérances sont en pixels écran, comme toute tolérance de la partie E.
 * Ce sont des paramètres d'ergonomie, nommés et réglables, jamais des valeurs
 * normatives : à état de vue et geste identiques, le résultat est identique
 * pour un type de pointeur donné.
 */
export type PointerKind = 'mouse' | 'pen' | 'touch';

/**
 * Le type d'un pointeur, depuis `PointerEvent.pointerType`.
 *
 * Une valeur inconnue ou vide est traitée en souris : c'est le pointeur précis
 * le plus répandu, et un navigateur qui ne dit rien ne signale ni stylet ni
 * doigt.
 */
export function pointerKindOf(pointerType: string): PointerKind {
  if (pointerType === 'pen') return 'pen';
  if (pointerType === 'touch') return 'touch';
  return 'mouse';
}

export type PointerTolerance = {
  /** Distance, en pixels écran, sous laquelle un objet est atteint. */
  readonly select_px: number;
  /** Distance, en pixels écran, sous laquelle le magnétisme agit. */
  readonly snap_px: number;
};

/** G3.2 — tolérances de sélection et de magnétisme par type de pointeur. */
export const POINTER_TOLERANCES: Readonly<Record<PointerKind, PointerTolerance>> = {
  mouse: { select_px: 4, snap_px: 8 },
  pen: { select_px: 3, snap_px: 6 },
  touch: { select_px: 12, snap_px: 16 },
};

/** Les tolérances d'un type de pointeur. */
export function toleranceFor(kind: PointerKind): PointerTolerance {
  return POINTER_TOLERANCES[kind];
}

/**
 * G3.1 — un pointeur peut-il tracer librement ?
 *
 * Le doigt ne le peut pas : l'outil de tracé reste inactif sous le doigt, avec
 * l'indication du motif (G3.5).
 */
export function canTraceFreely(kind: PointerKind): boolean {
  return kind !== 'touch';
}
