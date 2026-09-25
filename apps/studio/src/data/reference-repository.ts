/**
 * Adaptateur sur les sites de référence du dépôt.
 *
 * Ils servent à exercer les moteurs sur des cas connus : un site minimal, un
 * site multi-niveaux, un site volontairement cassé, un site adverse. Aucun
 * n'est une donnée client.
 */
import { allReferenceSites } from '@azimut/testkit/sites';
import { COUNTRIES } from '@azimut/db/reference';
import {
  EMPTY_CHARTER_REGISTRY, EMPTY_MAINTENANCE_REGISTRY, EMPTY_WAYFINDING_REGISTRY,
  type BudgetRegistry, type CharterRegistry, type InspectionRegistry, type MaintenanceRegistry, type SiteData, type WorksiteRegistry, type SiteVocabulary, type WayfindingRegistry,
} from '@azimut/core-model';
import { referenceVocabulary } from './reference-vocabulary.js';
import { REFERENCE_WORKSITE } from './reference-worksite.js';
import { REFERENCE_BUDGET } from './reference-budget.js';
import { REFERENCE_INSPECTION } from './reference-inspection.js';
import {
  RepositoryError,
  type SiteRepository,
  type SiteSummary,
  type CountrySummary,
  type LegalEntitySummary,
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
        return Promise.reject(new RepositoryError('not_found', siteId));
      }
      return Promise.resolve(site);
    },

    loadVocabulary(siteId: string): Promise<SiteVocabulary> {
      if (!allReferenceSites.has(siteId)) {
        return Promise.reject(new RepositoryError('not_found', siteId));
      }
      return Promise.resolve(referenceVocabulary(siteId));
    },

    /**
     * Aucun site de référence ne déclare de zone, de règle de nommage ni de
     * niveau d'information : le registre est vide, et les écrans le disent.
     * En inventer ici ferait passer pour déclaré ce qui ne l'est pas.
     */
    loadWayfindingRegistry(siteId: string): Promise<WayfindingRegistry> {
      if (!allReferenceSites.has(siteId)) {
        return Promise.reject(new RepositoryError('not_found', siteId));
      }
      return Promise.resolve(EMPTY_WAYFINDING_REGISTRY);
    },

    /**
     * Aucun site de référence ne porte de charte : une charte est une donnée
     * client, et le dépôt n'en contient aucune. Le registre est vide.
     */
    loadCharterRegistry(siteId: string): Promise<CharterRegistry> {
      if (!allReferenceSites.has(siteId)) {
        return Promise.reject(new RepositoryError('not_found', siteId));
      }
      return Promise.resolve(EMPTY_CHARTER_REGISTRY);
    },

    /**
     * Aucun site de référence n'a de parc posé : ni pose, ni divergence
     * enregistrée, ni ordre de travaux. En inventer ferait passer une
     * exploitation pour réelle.
     */
    loadMaintenanceRegistry(siteId: string): Promise<MaintenanceRegistry> {
      if (!allReferenceSites.has(siteId)) {
        return Promise.reject(new RepositoryError('not_found', siteId));
      }
      return Promise.resolve(EMPTY_MAINTENANCE_REGISTRY);
    },

    /** Le jeu de démonstration du module 07 ; les écrans le signalent. */
    loadWorksiteRegistry(siteId: string): Promise<WorksiteRegistry> {
      if (!allReferenceSites.has(siteId)) {
        return Promise.reject(new RepositoryError('not_found', siteId));
      }
      return Promise.resolve(REFERENCE_WORKSITE);
    },

    /** Le jeu de démonstration du module 09 ; les écrans le signalent. */
    loadBudgetRegistry(siteId: string): Promise<BudgetRegistry> {
      if (!allReferenceSites.has(siteId)) {
        return Promise.reject(new RepositoryError('not_found', siteId));
      }
      return Promise.resolve(REFERENCE_BUDGET);
    },

    /** Le jeu de démonstration des tournées du module 08 ; les écrans le signalent. */
    loadInspectionRegistry(siteId: string): Promise<InspectionRegistry> {
      if (!allReferenceSites.has(siteId)) {
        return Promise.reject(new RepositoryError('not_found', siteId));
      }
      return Promise.resolve(REFERENCE_INSPECTION);
    },

    /**
     * Q9 — le même fichier que celui versé dans `azimut.country` par
     * `pnpm seed:reference`. Sur un poste sans base, l'écran de création doit
     * rester praticable, et une seconde liste divergerait de la table (INV-1).
     */
    listCountries(): Promise<readonly CountrySummary[]> {
      return Promise.resolve(COUNTRIES.map((country): CountrySummary => ({
        code: country.code,
        name_fr: country.name_fr,
        name_en: country.name_en,
        timezones: country.timezones,
      })));
    },

    /**
     * Aucune. Les sites de référence ne portent pas d'entité juridique, et en
     * inventer une ferait apparaître dans M1 (partie M) un sélecteur que la
     * version 7 veut absent tant que l'organisation n'en porte aucune.
     */
    listLegalEntities(): Promise<readonly LegalEntitySummary[]> {
      return Promise.resolve([]);
    },
  };
}
