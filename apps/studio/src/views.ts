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
  | 'staggering'
  | 'placement'
  | 'coverage-audit'
  // 03 — Parcours
  | 'customer-flows'
  // 04 — Signalétique
  | 'signage'
  | 'templates'
  | 'faces'
  | 'proofs'
  // 05 — Régie publicitaire
  | 'advertising'
  // 06 — Enseignes
  | 'tenant-signs'
  // 07 — Chantier
  | 'worksite'
  // 08 — Maintenance
  | 'operations'
  // 09 — Budget
  | 'budget'
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
