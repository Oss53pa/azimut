import type { TextBounds } from './text-input.js';

/**
 * Les longueurs que le cahier des charges fixe lui-même, champ par champ.
 *
 * Ce ne sont pas des seuils de sécurité mais des règles du modèle : le cahier
 * les écrit dans la spécification des écrans, avec le code de l'anomalie qui
 * les tient. Elles restent donc ici, une seule fois, et la base les tient par
 * une contrainte (0082). Les plafonds génériques de taille, que le cahier ne
 * fixe pas, sont des seuils de configuration (`input.text.max_chars`,
 * `input.json.max_bytes`).
 */
export const FIELD_BOUNDS = {
  /** M1 (partie M) : « requis, 2 à 120 caractères, unique dans l'organisation ». */
  'site.name': { min: 2, max: 120 },
  /** M1bis (partie M) : « requis, 1 à 80 caractères, unique par site ». */
  'building.name': { min: 1, max: 80 },
  /** M3 (partie M) : « requis, unique par niveau, 1 à 20 caractères ». */
  'footprint.unit_code': { min: 1, max: 20 },
  /** N2.2 (module 02), `orientation_zone` : « Unique par site, 1 à 8 caractères ». */
  'orientation_zone.code': { min: 1, max: 8 },
} as const satisfies Readonly<Record<string, TextBounds>>;

export type BoundedField = keyof typeof FIELD_BOUNDS;
