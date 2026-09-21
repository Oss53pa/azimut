/**
 * Adaptateur sur les sites de référence du dépôt.
 *
 * Ils servent à exercer les moteurs sur des cas connus : un site minimal, un
 * site multi-niveaux, un site volontairement cassé, un site adverse. Aucun
 * n'est une donnée client.
 */
import { allReferenceSites } from '@azimut/testkit/sites';
import type { SiteData, SiteVocabulary } from '@azimut/core-model';
import { referenceVocabulary } from './reference-vocabulary.js';
import {
  RepositoryError,
  type SiteRepository,
  type SiteSummary,
} from './site-repository.js';

/**
 * Identifiant exposé : la clé du site de référence, pas son `site.id`. C'est
 * elle qui nomme le cas — « ref-broken » dit ce qu'il contient.
 */
export function createReferenceRepository(): SiteRepository {
  return {
    kind: 'reference',
    origin: 'testkit/sites',

    listSites(): Promise<readonly SiteSummary[]> {
      const summaries: SiteSummary[] = [];
      for (const [key, site] of allReferenceSites) {
        summaries.push({
          id: key,
          org_id: site.organization.id,
          name: site.site.name,
          country_code: site.site.country_code,
          rules_pack_id: site.site.rules_pack_id,
        });
      }
      summaries.sort((a, b) => a.name.localeCompare(b.name));
      return Promise.resolve(summaries);
    },

    loadSite(siteId: string): Promise<SiteData> {
      const site = allReferenceSites.get(siteId);
      if (site === undefined) {
        return Promise.reject(new RepositoryError('NET.NOT_FOUND', siteId));
      }
      return Promise.resolve(site);
    },

    loadVocabulary(siteId: string): Promise<SiteVocabulary> {
      if (!allReferenceSites.has(siteId)) {
        return Promise.reject(new RepositoryError('NET.NOT_FOUND', siteId));
      }
      return Promise.resolve(referenceVocabulary(siteId));
    },
  };
}
