/**
 * Partie H — the product is fourteen modules; a view is one screen inside one
 * of them. The identifier is the routing key and nothing else: what a module
 * is, which family it belongs to and what state it is in lives in
 * `product-map.ts`, so the two never drift apart.
 */
export type ViewId =
  // Cross-module
  | 'dashboard'
  | 'product-map'
  // 01 — Socle du site
  | 'sites'
  | 'foundation'
  | 'plan-calibration'
  | 'footprints'
  | 'graph'
  | 'destinations'
  | 'supports'
  | 'floor-plans'
  | 'checks'
  | 'site-sheet'
  // 02 — Wayfinding
  | 'message-schedule'
  | 'orientation-zones'
  | 'information-levels'
  | 'staggering'
  | 'placement'
  | 'coverage-audit'
  // 03 — Parcours
  | 'customer-flows'
  | 'travel-profiles'
  // 04 — Signalétique
  | 'signage'
  | 'templates'
  | 'faces'
  | 'wall-plans'
  | 'evacuation'
  | 'proofs'
  // 05 — Régie publicitaire
  | 'advertising'
  | 'ad-inventory'
  | 'ad-creatives'
  // 06 — Enseignes
  | 'tenant-signs'
  | 'tenant-rules'
  | 'tenant-instruction'
  // 07 — Chantier
  | 'worksite'
  | 'worksite-lots'
  | 'worksite-slots'
  | 'worksite-reserves'
  // 08 — Maintenance
  | 'operations'
  | 'ops-rounds'
  | 'ops-incidents'
  | 'ops-divergences'
  // 09 — Budget
  | 'budget'
  | 'budget-references'
  | 'budget-tracking'
  // 10 — Portefeuille
  | 'portfolio'
  // 11 — Fonctions transverses
  | 'cross-cutting'
  // 12 — Atelier de dessin
  | 'editor'
  // 13 — Bornes et appli
  | 'kiosk-app'
  // 14 — Restitutions
  | 'deliverables';
