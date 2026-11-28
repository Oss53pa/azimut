/**
 * T-1.3 — le volume d'une empreinte : altitude de base, hauteur, matière.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const VOLUME_FR = {
  'volume.panel': 'Volumes',
  'volume.note': 'Altitude de base et hauteur, en mètres. Les valeurs proposées viennent du niveau ; la matière se choisit.',
  'volume.footprint': 'Empreinte',
  'volume.footprint.choose': 'Choisir une empreinte',
  'volume.base': 'Altitude de base',
  'volume.height': 'Hauteur',
  'volume.height.hint.next': 'Proposée : écart au niveau suivant du bâtiment.',
  'volume.height.hint.top': 'Dernier niveau du bâtiment : aucune hauteur n’est proposée, saisissez-la.',
  'volume.material': 'Matière',
  'volume.material.choose': 'Choisir une matière',
  'volume.save': 'Enregistrer le volume',
  'volume.saved': 'Volume enregistré. Ctrl+Z l’annule.',
  'volume.none': 'Aucun volume sur ce niveau. Choisissez une empreinte pour lui en donner un.',
  'volume.no_footprint': 'Ce niveau n’a pas encore d’empreinte : tracez-en une, puis donnez-lui un volume.',
  'volume.col.footprint': 'Empreinte',
  'volume.col.base': 'Base (m)',
  'volume.col.height': 'Hauteur (m)',
  'volume.col.material': 'Matière',
  'volume.unnamed': '{kind} sans code, nº {rank}',
} as const;

export const VOLUME_EN: Readonly<Record<keyof typeof VOLUME_FR, string>> = {
  'volume.panel': 'Volumes',
  'volume.note': 'Base elevation and height, in metres. Suggested values come from the level; the material is chosen.',
  'volume.footprint': 'Footprint',
  'volume.footprint.choose': 'Choose a footprint',
  'volume.base': 'Base elevation',
  'volume.height': 'Height',
  'volume.height.hint.next': 'Suggested: gap to the next level of the building.',
  'volume.height.hint.top': 'Top level of the building: no height is suggested, enter it.',
  'volume.material': 'Material',
  'volume.material.choose': 'Choose a material',
  'volume.save': 'Save volume',
  'volume.saved': 'Volume saved. Ctrl+Z undoes it.',
  'volume.none': 'No volume on this level. Choose a footprint to give it one.',
  'volume.no_footprint': 'This level has no footprint yet: draw one, then give it a volume.',
  'volume.col.footprint': 'Footprint',
  'volume.col.base': 'Base (m)',
  'volume.col.height': 'Height (m)',
  'volume.col.material': 'Material',
  'volume.unnamed': '{kind} without code, no. {rank}',
};
