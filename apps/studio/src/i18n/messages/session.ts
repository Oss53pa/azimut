/**
 * D12.1 — reprise d'une session locale après incident (E5.4).
 *
 * Fragment à part : `data-source.ts` approche des 400 lignes que A2.4 fixe
 * pour un fichier, et la reprise n'est pas un sujet d'accès au dépôt.
 */
export const SESSION_FR = {
  'session.resume.title': 'Reprendre le travail en cours',
  'session.resume.body': 'Un travail non synchronisé est enregistré sur ce poste pour ce site. Il vient d’une session interrompue, ou d’un autre onglet.',
  'session.resume.count': '{rows} éléments enregistrés localement, dont {queued} en attente d’envoi.',
  'session.resume.warning': 'Les deux états ne sont pas fusionnés. Vous choisissez lequel garder.',
  'session.resume.accept': 'Reprendre le travail local',
  'session.resume.discard': 'Repartir sans lui',
} as const;

export const SESSION_EN: Readonly<Record<keyof typeof SESSION_FR, string>> = {
  'session.resume.title': 'Resume work in progress',
  'session.resume.body': 'Unsynchronised work for this site is saved on this workstation. It comes from an interrupted session, or from another tab.',
  'session.resume.count': '{rows} items saved locally, {queued} of them waiting to be sent.',
  'session.resume.warning': 'The two states are not merged. You choose which one to keep.',
  'session.resume.accept': 'Resume local work',
  'session.resume.discard': 'Start without it',
};
