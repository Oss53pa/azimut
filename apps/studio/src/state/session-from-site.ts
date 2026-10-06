/**
 * L'état de session que porte un site déjà enregistré.
 *
 * E5.4 veut, à la réouverture, « un choix explicite de l'utilisateur entre
 * l'état local et l'état serveur ». Le second manquait : l'atelier repartait
 * d'un état vide dès que le stockage local ne portait rien, et un site
 * modélisé la veille s'ouvrait comme un site neuf.
 *
 * N1.7 critère 1 — « Un site modélisé se recharge à l'identique. » Le chemin
 * d'écriture le tenait déjà côté base ; il manquait le retour.
 *
 * Aucun nom de colonne n'est réécrit ici. Les objets du modèle portent déjà
 * ceux de la base — `level_id`, `from_node_id`, `width_m` — et le magasin
 * garde les lignes telles quelles. Une seconde nomenclature serait exactement
 * ce qui a fait écrire `category_id` dans une table qui n'en a pas.
 */
import type { SiteData } from '@azimut/core-model';
import type { SessionState, StoredRow } from './session-store.js';
import { EMPTY_SESSION } from './session-store.js';

/** J3 — les lignes d'esquisse relues à part du site. */
export type SketchRows = {
  readonly layers: readonly (Readonly<Record<string, unknown>> & Identified)[];
  readonly strokes: readonly (Readonly<Record<string, unknown>> & Identified)[];
};

const NO_SKETCH: SketchRows = { layers: [], strokes: [] };

/** Une entité du modèle, telle que le magasin la garde. */
type Identified = { readonly id: string };

function rowsFor(
  table: string, entities: readonly Identified[],
): readonly StoredRow[] {
  return entities.map(entity => ({
    table,
    id: entity.id,
    values: entity as unknown as Readonly<Record<string, unknown>>,
  }));
}

/**
 * Les tables que l'atelier de la tranche tient, dans l'ordre de dépendance.
 *
 * L'ordre ne change rien au magasin, qui est plat. Il rend la reprise lisible
 * quand on l'inspecte, et il suit celui des commandes.
 */
export function sessionRowsFromSite(site: SiteData): readonly StoredRow[] {
  return [
    ...rowsFor('site', [site.site]),
    // A5.8 — le rattachement aux paquets fait foi en table ; le modèle n'en
    // garde que le paquet et le rôle, la ligne reprend son site et son
    // organisation pour rester celle de la base.
    ...rowsFor('site_rules_binding', site.rules_bindings.map(binding => ({
      ...binding, org_id: site.organization.id, site_id: site.site.id,
    }))),
    ...rowsFor('building', site.buildings),
    ...rowsFor('level', site.levels),
    ...rowsFor('plan_source', site.plan_sources),
    ...rowsFor('plan_calibration', site.plan_calibrations),
    ...rowsFor('footprint', site.footprints),
    ...rowsFor('node', site.graph.nodes),
    ...rowsFor('edge', site.graph.edges),
    ...rowsFor('vertical_link', site.graph.vertical_links),
    // L3.1 — les profils de parcours, que l'atelier du graphe lit pour
    // montrer le parcours d'un visiteur. En lecture : aucune commande ne les
    // écrit depuis l'atelier.
    ...rowsFor('travel_profile', site.travel_profiles),
    // R12 — l'annuaire, que les conditions de l'émission pour revue lisent :
    // la continuité du jalonnement (H2.4) et les collisions de nommage (H2.2)
    // portent sur les destinations et leurs noms. En lecture, comme les profils.
    ...rowsFor('destination', site.destinations),
    ...rowsFor('destination_name', site.destination_names),
  ];
}

/**
 * L'état de session d'un site chargé depuis le dépôt.
 *
 * La file est vide et l'état est en ligne : ce qui vient du dépôt y est déjà,
 * et le remettre en file le réécrirait.
 */
export function sessionFromSite(site: SiteData, sketch: SketchRows = NO_SKETCH): SessionState {
  return {
    ...EMPTY_SESSION,
    rows: [
      ...sessionRowsFromSite(site),
      // J3 — l'esquisse vient à part : elle n'est pas du site que le
      // compilateur lit (J3.3), mais l'atelier la montre.
      ...rowsFor('sketch_layer', sketch.layers),
      ...rowsFor('sketch_stroke', sketch.strokes),
    ],
  };
}
