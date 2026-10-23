/**
 * D-5 : les seuils servis avec les sites de référence, quand aucune base n'est
 * configurée.
 *
 * Ce sont des données, comme les sites de référence eux-mêmes, et non des
 * constantes de comportement : elles reproduisent les valeurs communes que la
 * migration 0081 inscrit dans `azimut.security_setting`, et l'essai
 * `security-settings.test.ts` échoue si elles en divergent.
 */
import type { SecuritySettings } from './security-settings.js';

export const REFERENCE_SECURITY_SETTINGS: SecuritySettings = {
  'asset.svg.max_bytes': 5242880,
  'asset.svg.max_depth': 64,
  'asset.svg.max_elements': 10000,
  'pdf.max_inflated_bytes': 268435456,
  'pdf.max_pages': 500,
  'plan.max_bytes': 62914560,
  'storage.signed_url_ttl': 300,
};
