/**
 * R2 (partie R) — qui peut faire quoi sur le tableau des messages.
 *
 * La table est recopiée telle quelle, sans être déduite d'une hiérarchie de
 * rôles : R2 sépare volontairement celui qui génère de celui qui approuve, et
 * une hiérarchie rendrait cette séparation dépendante de l'ordre des rôles au
 * lieu de la déclarer.
 *
 * « Séparation voulue : celui qui génère ne peut pas approuver. Un `admin` ou
 * un `designer` qui approuverait son propre tableau ferait disparaître le
 * contrôle que la maîtrise d'ouvrage est censée exercer. »
 *
 * R4 : « Une action non permise est absente, jamais grisée. » Cette table dit
 * donc ce qui se dessine, pas ce qui se désactive.
 */

/**
 * Les acteurs de la table R2 (partie R). Les six premiers sont des rôles de `membership`
 * au sens de A5.1 ; le septième est le relecteur externe en accès invité,
 * défini en O7, dont l'accès est limité au site, à la période et au périmètre
 * accordés.
 */
export const SCHEDULE_ACTORS = [
  'admin',
  'designer',
  'owner_rep',
  'external_reviewer',
  'auditor',
  'operator',
  'vendor',
  'marketing',
] as const;

export type ScheduleActor = (typeof SCHEDULE_ACTORS)[number];

export function isScheduleActor(value: string): value is ScheduleActor {
  return SCHEDULE_ACTORS.some(actor => actor === value);
}

/** Les six colonnes de la table R2 (partie R). */
export const SCHEDULE_PERMISSIONS = [
  'consult',
  'generate',
  'submit_for_review',
  'annotate',
  'decide',
  'export',
] as const;

export type SchedulePermission = (typeof SCHEDULE_PERMISSIONS)[number];

/** La table R2 (partie R), ligne pour ligne. `decide` couvre approuver et rejeter. */
const MATRIX: Readonly<Record<ScheduleActor, readonly SchedulePermission[]>> = {
  admin: ['consult', 'generate', 'submit_for_review', 'annotate', 'export'],
  designer: ['consult', 'generate', 'submit_for_review', 'annotate', 'export'],
  owner_rep: ['consult', 'annotate', 'decide', 'export'],
  external_reviewer: ['consult', 'annotate', 'decide', 'export'],
  auditor: ['consult', 'export'],
  operator: [],
  vendor: [],
  marketing: [],
};

export function can(actor: ScheduleActor, permission: SchedulePermission): boolean {
  return MATRIX[actor].includes(permission);
}

/**
 * R16 : « Écran absent pour les rôles sans consultation. »
 *
 * Le refus porte sur l'écran entier, pas sur ses actions : un rôle qui ne
 * consulte pas ne voit pas un tableau amputé, il ne voit pas de tableau.
 */
export function canOpenScreen(actor: ScheduleActor): boolean {
  return can(actor, 'consult');
}

/**
 * Le déclencheur de R12 qu'un acteur a le droit de provoquer.
 *
 * La permission de rôle se combine avec la légalité de l'état, jamais ne s'y
 * substitue : `triggersFrom` dit ce que la machine permet depuis l'état
 * courant, cette fonction dit ce que l'acteur a le droit de demander.
 */
export function permissionOfTrigger(
  trigger: 'generate' | 'regenerate' | 'submit_for_review' | 'reject' | 'approve' | 'supersede',
): SchedulePermission | null {
  switch (trigger) {
    case 'generate':
    case 'regenerate':
      return 'generate';
    case 'submit_for_review':
      return 'submit_for_review';
    case 'reject':
    case 'approve':
      return 'decide';
    // R12 : le remplacement est automatique, il suit l'approbation d'une
    // version ultérieure. Aucun acteur ne le déclenche à la main.
    case 'supersede':
      return null;
  }
}
