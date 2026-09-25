import type { SiteRulesBinding } from '@azimut/core-model';
import { boundPackId } from '@azimut/core-model';

/**
 * A5.8 — les paquets d'un site tels qu'un écran les cite, ou `null`.
 *
 * Le socle d'abord, la surcouche ensuite : l'ordre dans lequel on les lit,
 * qui n'est pas celui dans lequel on les consulte — la précédence reste à
 * `packsByPrecedence`, et l'écran ne décide de rien. `null` quand le site
 * n'est rattaché à aucun paquet, pour que chaque écran dise lui-même, dans sa
 * langue, qu'il n'y en a pas.
 */
export function rulesPackLabel(bindings: readonly SiteRulesBinding[]): string | null {
  const ids = (['base', 'overlay'] as const)
    .map(role => boundPackId(bindings, role))
    .filter((id): id is string => id !== null);
  return ids.length === 0 ? null : ids.join(' · ');
}
