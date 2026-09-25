/**
 * Les lecteurs de registre passés à `useRegistry`. Des constantes de module,
 * pour que le hook ne relise pas à chaque rendu.
 */
import type { WorksiteRegistry } from '@azimut/core-model';
import type { RegistryLoader } from './use-registry.js';

export const loadWorksite: RegistryLoader<WorksiteRegistry> = (repository, siteId) =>
  repository.loadWorksiteRegistry(siteId);
