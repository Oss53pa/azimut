/**
 * D12.1 — la zone de tracé au stylet de l'atelier des empreintes (J1, G3).
 *
 * Fragment à part : `workshop-screens.ts` approche des 400 lignes que A2.4
 * fixe pour un fichier.
 */
export const INK_FR = {
  'ink.zone.label': 'Zone de travail : tracez au stylet ou à la souris sur le plan calé',
  'ink.recognized': 'Forme reconnue : {shape}',
  'ink.alternative': 'Autre lecture : {shape}',
  'ink.take_alternative': 'Prendre l’autre lecture',
  'ink.unrecognized': 'Ce trait ne ressemble à aucune forme d’empreinte. Retracez-le, ou saisissez les sommets dans le panneau.',
  'ink.not_tracing_tool': 'Choisissez un outil de tracé (cellule, polygone ou rectangle) pour tracer dans la zone.',
  'ink.touch_refused': 'Le tracé au doigt n’est pas proposé : il ne donne pas la précision d’une empreinte. Tracez au stylet ou à la souris.',
  'ink.shape.rectangle': 'rectangle',
  'ink.shape.polygon': 'polygone',
  'ink.background.none': 'Aucun plan calé pour ce niveau : la zone n’a pas de fond.',
  'ink.background.not_image': 'Le fond de ce plan n’est pas encore affiché : seuls les plans en image (PNG, JPEG) le sont aujourd’hui.',
  'ink.background.not_kept': 'Le fichier du plan n’est gardé que pendant la session où il a été calé : rechargez-le depuis l’écran de calage pour retrouver le fond.',
  'ink.graph.not_tool': 'Choisissez l’outil Nœud pour poser d’un point appuyé, ou l’outil Arête pour relier deux nœuds d’un trait.',
  'ink.graph.tap_expected': 'L’outil Nœud attend un point appuyé, à l’endroit du nœud.',
  'ink.graph.edge_expected': 'L’outil Arête attend un trait qui part d’un nœud et arrive sur un autre.',
};

export const INK_EN: Readonly<Record<keyof typeof INK_FR, string>> = {
  'ink.zone.label': 'Work area: draw with a stylus or a mouse on the calibrated plan',
  'ink.recognized': 'Recognised shape: {shape}',
  'ink.alternative': 'Other reading: {shape}',
  'ink.take_alternative': 'Use the other reading',
  'ink.unrecognized': 'This stroke does not look like any footprint shape. Draw it again, or enter the vertices in the panel.',
  'ink.not_tracing_tool': 'Choose a drawing tool (cell, polygon or rectangle) to draw in the area.',
  'ink.touch_refused': 'Drawing with a finger is not offered: it does not give the precision a footprint needs. Draw with a stylus or a mouse.',
  'ink.shape.rectangle': 'rectangle',
  'ink.shape.polygon': 'polygon',
  'ink.background.none': 'No calibrated plan for this level: the area has no background.',
  'ink.background.not_image': 'This plan is not shown as a background yet: only image plans (PNG, JPEG) are today.',
  'ink.background.not_kept': 'The plan file is only kept during the session in which it was calibrated: load it again from the calibration screen to see the background.',
  'ink.graph.not_tool': 'Choose the Node tool to place a node with a tap, or the Edge tool to join two nodes with a stroke.',
  'ink.graph.tap_expected': 'The Node tool expects a tap, where the node goes.',
  'ink.graph.edge_expected': 'The Edge tool expects a stroke that starts on one node and ends on another.',
};
