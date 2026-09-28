/**
 * D12.1 — Écrans de consultation du socle et de la signalétique.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const VIEWS_FR = {
  // Supports
  'supports.title': 'Carnet de supports',
  'supports.col.key': 'Clé',
  'supports.col.name': 'Nom',
  'supports.col.faces': 'Faces',
  'supports.col.defaultdims': 'Dimensions par défaut',

  // Templates
  'templates.title': 'Gabarits de face',

  // Destinations
  'destinations.title': 'Occupants',
  'destinations.subtitle': "Points d'intérêt et occupants du site",
  'destinations.col.level': 'Niveau',
  'destinations.col.node': 'Nœud',
  'destinations.col.status': 'Statut',
  'destinations.col.priority': 'Priorité',
  'status.occupied': 'Occupé',
  'status.vacant': 'Vacant',
  'status.reserved': 'Réservé',
  'status.underfitout': 'En aménagement',

  // Faces
  'faces.title': 'Rendus de faces',
  'faces.subtitle': 'Aperçu SVG des faces résolues pour chaque gabarit.',
  'faces.empty.notemplate': 'Aucun gabarit de face configuré.',
  'faces.meta': 'Type : {type} · Face : {side} · blocs : {blocks}',
  'faces.previewnode': 'Nœud : {label} ({kind})',
  'faces.noprofile': 'Aucun profil de parcours disponible.',
  'faces.nopreview': 'Aperçu indisponible pour ce gabarit.',

  // Proofs
  'proofs.title': 'Bons à tirer',
  'proofs.col.template': 'Gabarit',
  'proofs.col.warnings': 'Avertissements',

  // Floor plans
  'floorplans.title': 'Plans de niveaux',
  'floorplans.viewport.aria': 'Plan du niveau {level}',
  'floorplans.empty': 'Sélectionnez un niveau.',
  'floorplans.selection': 'Sélection : {ids}',
} as const;

export const VIEWS_EN: Readonly<Record<keyof typeof VIEWS_FR, string>> = {

  'supports.title': 'Support inventory',
  'supports.col.key': 'Key',
  'supports.col.name': 'Name',
  'supports.col.faces': 'Faces',
  'supports.col.defaultdims': 'Default dimensions',

  'templates.title': 'Face templates',

  'destinations.title': 'Occupants',
  'destinations.subtitle': 'Points of interest and site occupants',
  'destinations.col.level': 'Level',
  'destinations.col.node': 'Node',
  'destinations.col.status': 'Status',
  'destinations.col.priority': 'Priority',
  'status.occupied': 'Occupied',
  'status.vacant': 'Vacant',
  'status.reserved': 'Reserved',
  'status.underfitout': 'Under fit-out',

  'faces.title': 'Face renders',
  'faces.subtitle': 'SVG preview of resolved faces for each template.',
  'faces.empty.notemplate': 'No face template configured.',
  'faces.meta': 'Type: {type} · Face: {side} · blocks: {blocks}',
  'faces.previewnode': 'Node: {label} ({kind})',
  'faces.noprofile': 'No travel profile available.',
  'faces.nopreview': 'Preview unavailable for this template.',

  'proofs.title': 'Proofs',
  'proofs.col.template': 'Template',
  'proofs.col.warnings': 'Warnings',

  'floorplans.title': 'Floor plans',
  'floorplans.viewport.aria': 'Plan of level {level}',
  'floorplans.empty': 'Select a level.',
  'floorplans.selection': 'Selection: {ids}',
};
