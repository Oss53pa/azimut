import type { SiteData, Finding } from '@azimut/core-model';

/**
 * N4.3 — règle G7. « Une version approuvée est immuable. Une correction crée
 * une nouvelle version. »
 *
 * La machine à états refuse toute modification d'une version approuvée, et la
 * base fige son empreinte (migration 0017). Restent les états que ni l'une ni
 * l'autre ne peut empêcher, parce qu'ils portent sur plusieurs lignes ou sur
 * l'absence d'une valeur. Trois, séparés par `status` :
 *
 *  - `two_approved` : deux versions approuvées sur le même support. La seconde
 *    approbation aurait dû remplacer la première ; sans cela, deux vérités
 *    coexistent et rien ne dit laquelle part en fabrication.
 *  - `duplicate_number` : deux versions du même numéro sur un support. Une
 *    correction a réécrit un numéro au lieu d'en créer un nouveau — c'est
 *    exactement ce que la seconde phrase de G7 interdit.
 *  - `hash_absent` : une version approuvée sans empreinte de contenu. Le
 *    déclencheur de la base fige ce qui existe ; il ne fige pas une absence,
 *    et une version sans empreinte ne peut pas être prouvée intacte.
 */
export function checkApprovedVersionImmutable(site: SiteData): Finding[] {
  const findings: Finding[] = [];

  const bySupport = new Map<string, SiteData['support_versions'][number][]>();
  for (const version of site.support_versions) {
    bySupport.set(version.support_id, [
      ...(bySupport.get(version.support_id) ?? []),
      version,
    ]);
  }

  const violate = (
    version: SiteData['support_versions'][number],
    status: string,
    params: Record<string, string | number> = {},
  ): void => {
    findings.push({
      code: 'DATA.APPROVED_VERSION_NOT_IMMUTABLE',
      severity: 'blocking',
      entity: { kind: 'support_version', id: version.id },
      params: { status, support_id: version.support_id, version: version.version, ...params },
      ruleRef: 'N4.3',
    });
  };

  const supportIds = [...bySupport.keys()].sort((a, b) => a.localeCompare(b));
  for (const supportId of supportIds) {
    const versions = [...(bySupport.get(supportId) ?? [])]
      .sort((a, b) => a.id.localeCompare(b.id));

    const approved = versions.filter(v => v.state === 'approved');
    if (approved.length > 1) {
      for (const version of approved) violate(version, 'two_approved', { count: approved.length });
    }

    const seen = new Map<number, number>();
    for (const version of versions) {
      seen.set(version.version, (seen.get(version.version) ?? 0) + 1);
    }
    for (const version of versions) {
      if ((seen.get(version.version) ?? 0) > 1) violate(version, 'duplicate_number');
    }

    for (const version of approved) {
      if ((version.content_hash ?? '').trim().length === 0) violate(version, 'hash_absent');
    }
  }

  return findings;
}
