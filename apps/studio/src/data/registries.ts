/**
 * Les lecteurs de registre passés à `useRegistry`. Des constantes de module,
 * pour que le hook ne relise pas à chaque rendu.
 */
import {
  EMPTY_AD_REGISTRY, type BudgetRegistry, type InspectionRegistry, type TenantRegistry, type WorksiteRegistry,
} from '@azimut/core-model';
import type { RegistryLoader } from './use-registry.js';
import type { AdvertisingData } from './advertising-data.js';

export const loadWorksite: RegistryLoader<WorksiteRegistry> = (repository, siteId) =>
  repository.loadWorksiteRegistry(siteId);

export const loadBudget: RegistryLoader<BudgetRegistry> = (repository, siteId) =>
  repository.loadBudgetRegistry(siteId);

export const loadInspection: RegistryLoader<InspectionRegistry> = (repository, siteId) =>
  repository.loadInspectionRegistry(siteId);

export const loadAdvertising: RegistryLoader<AdvertisingData> = (repository, siteId) =>
  repository.loadAdvertisingData(siteId);

/** Rien de lu : ni registre, ni file de réception, ni fiche technique. */
export const EMPTY_ADVERTISING_DATA: AdvertisingData = {
  registry: EMPTY_AD_REGISTRY,
  reception: [],
  creative_spec: null,
};

export const loadTenant: RegistryLoader<TenantRegistry> = (repository, siteId) =>
  repository.loadTenantRegistry(siteId);
