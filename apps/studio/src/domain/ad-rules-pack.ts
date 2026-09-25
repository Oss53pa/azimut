import type { AdRulesPack } from '@azimut/engine-graph';

/**
 * N5.2-R7 / I5.4 — paquet de règles publicitaires rattaché au site.
 *
 * Aucun ne l'est, et ce n'est pas un oubli : N5.7 pose que le corpus
 * réglementaire publicitaire par pays n'existe pas encore — « mécanisme prêt,
 * contenu absent ». M05.R7 (partie N) veut qu'en son absence le module lève
 * une anomalie et n'invente aucune règle. En attacher un ici inventerait
 * justement ce que M05.R7 interdit d'inventer.
 */
export const ATTACHED_AD_RULES_PACK: AdRulesPack | null = null;
