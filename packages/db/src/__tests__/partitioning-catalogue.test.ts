import { describe, it, expect } from 'vitest';
import { partitioningGaps } from '../partitioning-catalogue.js';

/**
 * Le contrôle de catalogue sans base : ce qu'il demande et comment il rend.
 * L'essai sur la base migrée est `a6-1-catalogue.db.test.ts`.
 */
describe('partitioningGaps : forme du contrôle', () => {
  it('interroge les quatre familles d’écarts, dans le seul schéma azimut', async () => {
    const queries: string[] = [];
    await partitioningGaps(async text => { queries.push(text); return []; });
    expect(queries).toHaveLength(4);
    for (const q of queries) expect(q).toContain("'azimut'");
    expect(queries.join('\n')).toMatch(/relforcerowsecurity/);
    expect(queries.join('\n')).toMatch(/prosecdef/);
    expect(queries.join('\n')).toMatch(/_migrations/);
  });

  it('rend les écarts réunis et triés, quel que soit l’ordre des réponses', async () => {
    const answers = [
      [{ gap: 'zone policy' }, { gap: 'site force' }],
      [{ gap: 'building fk building_site_id_fkey' }],
      [{ gap: 'function f search_path' }],
      [],
    ];
    let i = 0;
    const gaps = await partitioningGaps(async () => answers[i++] ?? []);
    expect(gaps).toEqual([
      'building fk building_site_id_fkey', 'function f search_path', 'site force', 'zone policy',
    ]);
  });
});
