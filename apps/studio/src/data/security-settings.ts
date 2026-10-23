/**
 * D-5 : les seuils de taille, de nombre et de durée, lus en configuration.
 *
 * « Les seuils (débit, tailles, durées) sont des données de configuration,
 * jamais des constantes dans le code. » Connecté, le studio les lit par
 * `azimut.security_settings(org)` (0081), surcharge de l'organisation
 * comprise. Sur les sites de référence, il lit les valeurs de référence, que
 * l'essai `security-settings.test.ts` tient égales à celles de la migration.
 *
 * Une clé absente ou illisible fait échouer la lecture entière : un seuil
 * manquant ne retombe jamais sur une valeur supposée.
 */
import { z } from 'zod';
import { query } from './postgrest-http.js';
import type { PostgrestConfig } from './postgrest-http.js';

export const SETTING_KEYS = [
  'asset.svg.max_bytes', 'asset.svg.max_depth', 'asset.svg.max_elements',
  'pdf.max_inflated_bytes', 'pdf.max_pages', 'plan.max_bytes', 'storage.signed_url_ttl',
] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];
export type SecuritySettings = Readonly<Record<SettingKey, number>>;

const Row = z.object({
  key: z.string(),
  value: z.union([z.number(), z.string()]).transform(v => Number(v)).pipe(z.number().nonnegative()),
  unit: z.enum(['bytes', 'count', 'seconds']),
}).strict();

/** Les seuils des lignes lues, ou une erreur si l'un manque. */
export function settingsFromRows(rows: readonly unknown[]): SecuritySettings {
  const values = new Map<string, number>();
  for (const row of rows) {
    const parsed = Row.parse(row);
    values.set(parsed.key, parsed.value);
  }
  const out: Partial<Record<SettingKey, number>> = {};
  for (const key of SETTING_KEYS) {
    const v = values.get(key);
    if (v === undefined) throw new Error(`seuil absent : ${key}`);
    out[key] = v;
  }
  return out as SecuritySettings;
}

export async function loadSecuritySettings(config: PostgrestConfig, orgId: string): Promise<SecuritySettings> {
  const org = z.uuid().parse(orgId);
  return settingsFromRows(await query<unknown>(config, 'rpc/security_settings', `p_org=${org}`));
}
