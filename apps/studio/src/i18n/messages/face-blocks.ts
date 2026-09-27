/**
 * D8.3 — la saisie des blocs d'une face : blocs libres (texte par langue) et
 * légendes. Les autres types se lisent ici sans se saisir.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const FACE_BLOCKS_FR = {
  'faceblocks.title': 'Blocs de contenu',
  'faceblocks.none': 'Aucun bloc saisi sur la face : son contenu vient du gabarit.',
  'faceblocks.undeclared': 'Déclarer la face avant d’y saisir des blocs.',
  'faceblocks.item': 'Bloc {index} · {kind}',
  'faceblocks.kind.free': 'Texte libre',
  'faceblocks.kind.legend': 'Légende',
  'faceblocks.kind.map': 'Plan mural',
  'faceblocks.kind.resolved': 'Résolu',
  'faceblocks.kind.pictogram': 'Pictogramme',
  'faceblocks.fixed': 'Géré ailleurs : gabarit, tableau des messages ou plans muraux.',
  'faceblocks.edit': 'Modifier',
  'faceblocks.withdraw': 'Retirer',
  'faceblocks.save': 'Enregistrer le texte',
  'faceblocks.cancel': 'Annuler',
  'faceblocks.add.title': 'Ajouter un bloc',
  'faceblocks.add.kind': 'Type',
  'faceblocks.add.submit': 'Ajouter le bloc',
  'faceblocks.text.label': 'Texte ({lang})',
  'faceblocks.note': 'Seul le bloc libre porte un texte saisi (D8.3). Les autres blocs sont résolus depuis le graphe et l’annuaire.',
  'faceblocks.added': 'Bloc ajouté.',
  'faceblocks.saved': 'Texte enregistré.',
  'faceblocks.withdrawn': 'Bloc retiré.',
  'faceblocks.preview.title': 'Rendu de la face',
  'faceblocks.preview.none': 'Pas de rendu : le gabarit de la face n’est pas connu au poste (typologie absente, ou gabarits non chargés).',
  'faceblocks.preview.aria': 'Rendu de la face {face} du support {support}',
  'faceblocks.slot': 'Emplacement',
  'faceblocks.slot.option': 'Emplacement {index}',
  'faceblocks.slot.first': 'Premier emplacement libre',
} as const;

export const FACE_BLOCKS_EN: Readonly<Record<keyof typeof FACE_BLOCKS_FR, string>> = {
  'faceblocks.title': 'Content blocks',
  'faceblocks.none': 'No block entered on the face: its content comes from the template.',
  'faceblocks.undeclared': 'Declare the face before entering blocks on it.',
  'faceblocks.item': 'Block {index} · {kind}',
  'faceblocks.kind.free': 'Free text',
  'faceblocks.kind.legend': 'Legend',
  'faceblocks.kind.map': 'Wall plan',
  'faceblocks.kind.resolved': 'Resolved',
  'faceblocks.kind.pictogram': 'Pictogram',
  'faceblocks.fixed': 'Managed elsewhere: template, message table or wall plans.',
  'faceblocks.edit': 'Edit',
  'faceblocks.withdraw': 'Withdraw',
  'faceblocks.save': 'Save the text',
  'faceblocks.cancel': 'Cancel',
  'faceblocks.add.title': 'Add a block',
  'faceblocks.add.kind': 'Kind',
  'faceblocks.add.submit': 'Add the block',
  'faceblocks.text.label': 'Text ({lang})',
  'faceblocks.note': 'Only the free block carries entered text (D8.3). Other blocks are resolved from the graph and the directory.',
  'faceblocks.added': 'Block added.',
  'faceblocks.saved': 'Text saved.',
  'faceblocks.withdrawn': 'Block withdrawn.',
  'faceblocks.preview.title': 'Face render',
  'faceblocks.preview.none': 'No render: the face’s template is not known here (no typology, or templates not loaded).',
  'faceblocks.preview.aria': 'Render of face {face} of support {support}',
  'faceblocks.slot': 'Slot',
  'faceblocks.slot.option': 'Slot {index}',
  'faceblocks.slot.first': 'First free slot',
};
