/**
 * Ce que la validation du graphe lit d'un site, et rien de plus.
 *
 * `validateGraph` recevait `SiteData` entier. Il n'en lit que sept champs :
 * les bâtiments, les niveaux, le graphe, les destinations, leurs noms, les
 * empreintes et les profils de parcours. Demander le reste n'ajoutait aucun contrôle et coûtait cher là
 * où le site n'est pas encore complet : l'atelier tient une session de travail
 * — un plan calé, des empreintes, des nœuds — et aucune organisation, aucune
 * fiche de site. Pour appeler le moteur, il aurait fallu en inventer, c'est-à-
 * dire produire de la donnée qu'aucun contrôle ne regarde. C'est ce qui a tenu
 * l'écran de validation de M5 (partie M) sur un contrôle écrit à la main.
 *
 * Le type est un sous-ensemble structurel de `SiteData` : tout appelant qui
 * passait un site entier continue de convenir sans changement.
 */
import type { SiteData } from '@azimut/core-model';

export type GraphScope = Pick<
  SiteData,
  | 'buildings'
  | 'levels'
  | 'graph'
  | 'destinations'
  | 'destination_names'
  | 'footprints'
  /**
   * Les profils de parcours du site.
   *
   * Entrés avec la portée de `GRAPH.DESTINATION_ENTRANCE_COVERAGE`, que
   * l'éditeur limite aux entrées empruntées par au moins un profil de
   * visiteur : sans les profils, « empruntée » n'est pas décidable. Aucun
   * autre contrôle ne les lit.
   */
  | 'travel_profiles'
>;
