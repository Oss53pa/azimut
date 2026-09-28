/**
 * T-2.9 — la saisie des emplacements de plan mural : déclarer un bloc de
 * plan sur une face de support, et le retirer.
 *
 * Fragment du catalogue. La table française porte le jeu de clés ;
 * la table anglaise est typée contre elle, une traduction manquante
 * ne compile pas.
 */
export const WALL_PLAN_ENTRY_FR = {
  'wallplans.entry.panel': 'Déclarer un plan mural',
  'wallplans.entry.support': 'Support',
  'wallplans.entry.support.placeholder': 'Choisir un support',
  'wallplans.entry.face': 'Face',
  'wallplans.entry.face.option': 'Face {index}',
  'wallplans.entry.face.placeholder': 'Choisir d’abord un support',
  'wallplans.entry.face.hint': 'Le nombre de faces vient de la typologie du support ; sans typologie, seule la face 0.',
  'wallplans.entry.submit': 'Déclarer le plan mural',
  'wallplans.entry.readonly': 'Mode démonstration : la saisie n’écrit qu’en base, et aucune base n’est configurée. Le formulaire reste inactif ; rien n’est simulé en mémoire.',
  'wallplans.entry.done': 'Plan mural déclaré.',
  'wallplans.entry.withdrawn': 'Plan mural retiré.',
  'wallplans.entry.note': 'Le bloc ne porte aucun contenu saisi : le plan se calcule depuis le site et s’oriente sur l’azimut du support.',
  'wallplans.section.blocks': 'Blocs de plan mural',
  'wallplans.block.label': 'Face {face} · bloc {block}',
  'wallplans.withdraw': 'Retirer',
} as const;

export const WALL_PLAN_ENTRY_EN: Readonly<Record<keyof typeof WALL_PLAN_ENTRY_FR, string>> = {
  'wallplans.entry.panel': 'Declare a wall plan',
  'wallplans.entry.support': 'Support',
  'wallplans.entry.support.placeholder': 'Choose a support',
  'wallplans.entry.face': 'Face',
  'wallplans.entry.face.option': 'Face {index}',
  'wallplans.entry.face.placeholder': 'Choose a support first',
  'wallplans.entry.face.hint': 'The face count comes from the support’s typology; without one, face 0 only.',
  'wallplans.entry.submit': 'Declare the wall plan',
  'wallplans.entry.readonly': 'Demonstration mode: entry only writes to the database, and none is configured. The form stays inactive; nothing is simulated in memory.',
  'wallplans.entry.done': 'Wall plan declared.',
  'wallplans.entry.withdrawn': 'Wall plan withdrawn.',
  'wallplans.entry.note': 'The block carries no entered content: the plan is computed from the site and oriented on the support’s azimuth.',
  'wallplans.section.blocks': 'Wall-plan blocks',
  'wallplans.block.label': 'Face {face} · block {block}',
  'wallplans.withdraw': 'Withdraw',
};
