import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REFERENCE_SECURITY_SETTINGS } from '../reference-security-settings.js';
import { SETTING_KEYS, settingsFromRows } from '../security-settings.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(HERE, '..', '..', '..', '..', '..', 'packages', 'db', 'migrations',
  '0081_d5_d6_seuils_et_stockage.up.sql');

/** Les valeurs que la migration inscrit, clé par clé. */
function seeded(): ReadonlyMap<string, number> {
  const sql = readFileSync(MIGRATION, 'utf8');
  const out = new Map<string, number>();
  for (const m of sql.matchAll(/\('([a-z0-9_.]+)', (\d+), '(?:bytes|count|seconds)'/g)) {
    out.set(m[1] ?? '', Number(m[2]));
  }
  return out;
}

describe('D-5 : les seuils de référence sont ceux de la migration', () => {
  it('chaque clé lue par le studio a la valeur que 0081 inscrit', () => {
    const values = seeded();
    for (const key of SETTING_KEYS) {
      expect(values.get(key), key).toBe(REFERENCE_SECURITY_SETTINGS[key]);
    }
  });
});

describe('D-5 : la lecture des seuils', () => {
  const rows = SETTING_KEYS.map(key => ({ key, value: String(REFERENCE_SECURITY_SETTINGS[key]), unit: 'bytes' }));

  it('rend chaque seuil, en nombre', () => {
    expect(settingsFromRows(rows)).toEqual(REFERENCE_SECURITY_SETTINGS);
  });

  it('échoue si un seuil manque, au lieu de supposer une valeur', () => {
    expect(() => settingsFromRows(rows.slice(1))).toThrow(/seuil absent/);
  });

  it('échoue sur une ligne qui n’a pas la forme attendue', () => {
    expect(() => settingsFromRows([...rows, { key: 'x.y', value: '-1', unit: 'bytes' }])).toThrow();
    expect(() => settingsFromRows([...rows, { key: 'x.y', value: '1', unit: 'bytes', extra: 1 }])).toThrow();
  });
});
