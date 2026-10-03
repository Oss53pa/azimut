/**
 * La largeur utile qu'une arête reçoit à sa création.
 *
 * M4 (partie M), propriétés d'une arête : « Largeur utile — défaut : hérité du
 * bâtiment, `building.default_edge_width_m`. » N1.2 la porte au modèle :
 * « Largeur héritée par les arêtes du bâtiment. »
 *
 * L'héritage passe par le niveau, qui n'en porte aucune : une arête appartient
 * à un niveau, le niveau à un bâtiment, et c'est le bâtiment qui déclare la
 * largeur de ses cheminements. Le chemin est donc arête → niveau → bâtiment,
 * et ce module est le seul endroit du dépôt qui le suit.
 *
 * Ce qu'il n'est pas : une largeur de calcul. `edge.width_m` reste la seule
 * largeur qu'un moteur lit. Changer la largeur d'un bâtiment ne retouche
 * aucune arête déjà tracée — l'héritage a lieu à la création, une fois.
 */
import type { SessionState } from './session-store.js';
import { rowsOf } from './session-store.js';
import { numeric, text } from './row-values.js';

/**
 * La largeur proposée quand le bâtiment n'en déclare aucune.
 *
 * `building.default_edge_width_m` est facultative — la colonne est nullable
 * (migration 0020) et le champ du modèle optionnel — parce qu'un bâtiment
 * relevé avant qu'on ait mesuré ses circulations existe. Il faut pourtant une
 * largeur pour tracer, l'arête n'en admettant pas d'absente.
 *
 * Ce n'est pas une valeur d'origine normative, et INV-5 ne la vise pas :
 * aucune norme ne fixe la largeur d'un cheminement dans le modèle. Les seuils
 * qui jugent une largeur — passage minimal, giration — vivent dans le paquet
 * de règles et sont lus par les contrôles, jamais ici. C'est une valeur
 * d'ouverture d'écran, que l'opérateur modifie au panneau et que la fiche de
 * site (M1bis) lui permet de fixer une fois pour tout le bâtiment.
 */
export const FALLBACK_EDGE_WIDTH_M = 1.4;

/**
 * La largeur qu'héritent les arêtes tracées sur ce niveau.
 *
 * Un niveau introuvable, un bâtiment introuvable, une largeur illisible ou
 * non positive rendent la valeur d'ouverture. Aucun de ces cas n'est
 * silencieusement complété ailleurs : la largeur n'est pas une donnée de
 * relevé qu'on inventerait, c'est la proposition faite au tracé suivant.
 */
export function inheritedEdgeWidthM(session: SessionState, levelId: string): number {
  const level = rowsOf(session, 'level').find(row => row.id === levelId);
  if (level === undefined) return FALLBACK_EDGE_WIDTH_M;

  const buildingId = text(level.values, 'building_id');
  if (buildingId === null) return FALLBACK_EDGE_WIDTH_M;

  const building = rowsOf(session, 'building').find(row => row.id === buildingId);
  if (building === undefined) return FALLBACK_EDGE_WIDTH_M;

  const declared = numeric(building.values, 'default_edge_width_m');
  // La contrainte de la colonne est `IS NULL OR > 0`. Une valeur nulle ou
  // négative ne vient donc pas de la base ; elle vient d'une ligne de session
  // abîmée, et la retenir ferait refuser toute arête pour largeur nulle sans
  // que l'écran dise pourquoi.
  if (declared === null || declared <= 0) return FALLBACK_EDGE_WIDTH_M;
  return declared;
}
