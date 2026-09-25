import type { RulesPackRole, SiteRulesBinding } from './site.js';

/**
 * Le rattachement d'un site à ses paquets de règles — A5.8.
 *
 * « Cette table fait foi pour le rattachement d'un site à ses paquets. Un site
 * porte au plus un socle et au plus une surcouche pays, section D3.6.
 * Précédence, pour une même fonction de pictogramme comme pour une règle : la
 * surcouche l'emporte sur le socle. L'ambiguïté ne se juge qu'à l'intérieur
 * d'un même paquet. »
 *
 * Ce module dit une seule chose : dans quel ordre un site consulte ses
 * paquets. Tout ce qui lit un paquet pour un site passe par lui, pour que la
 * précédence ne soit écrite qu'une fois.
 */

/** Les deux rôles d'A5.8. */
export const RULES_PACK_ROLES: readonly RulesPackRole[] = ['base', 'overlay'];

/** Le paquet rattaché à un site dans un rôle, ou `null`. */
export function boundPackId(
  bindings: readonly SiteRulesBinding[],
  role: RulesPackRole,
): string | null {
  return bindings.find(binding => binding.role === role)?.rules_pack_id ?? null;
}

/**
 * Les paquets d'un site, du plus prioritaire au moins prioritaire.
 *
 * La surcouche d'abord, le socle ensuite, et seulement ceux qui existent. Une
 * demande — une fonction de pictogramme, une règle — se pose au premier ; elle
 * ne descend au suivant que si le premier ne répond pas.
 *
 * **Une surcouche sans socle.** A5.8 dit « au plus un socle », non « au moins
 * un » : le cas est admis par le modèle. La surcouche est alors seule en
 * lice, et c'est elle qui répond. D3.6 veut qu'elle durcisse le socle ; sans
 * socle, elle n'a rien à durcir, et chacune de ses règles est additive.
 */
export function packsByPrecedence(bindings: readonly SiteRulesBinding[]): readonly string[] {
  return (['overlay', 'base'] as const)
    .map(role => boundPackId(bindings, role))
    .filter((id): id is string => id !== null);
}

/** Un site est-il rattaché à au moins un paquet. */
export function isBound(bindings: readonly SiteRulesBinding[]): boolean {
  return bindings.length > 0;
}
