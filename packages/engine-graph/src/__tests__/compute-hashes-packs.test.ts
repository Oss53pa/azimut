import { describe, it, expect } from 'vitest';
import { refMinimal } from '@azimut/testkit';
import type { BoundRulesPacks } from '@azimut/core-model';
import { computeContentHash } from '../compute-hashes.js';
import { resolveFaceContent } from '../resolve-face.js';

/**
 * D7.1 — l'empreinte de contenu porte le socle et la surcouche.
 *
 * « Les deux rattachements entrent dans l'empreinte, et non le seul résultat
 * de leur fusion. Sans cela, deux sites partageant un même socle avec des
 * surcouches différentes produiraient la même empreinte, et un changement de
 * surcouche ne marquerait rien comme périmé. »
 */

const profile = refMinimal.travel_profiles[0];
const template = refMinimal.face_templates[0];

function hashWith(rules_packs: BoundRulesPacks): string {
  if (profile === undefined || template === undefined) throw new Error('fixture');
  const resolved = resolveFaceContent(refMinimal, template, 'n-junction', profile);
  if (!resolved.ok) throw new Error('resolve failed');
  return computeContentHash({
    resolved: resolved.value,
    template,
    charter_id: null,
    charter_version: null,
    rules_packs,
    active_langs: ['fr', 'en'],
    dimensions: { width_mm: 600, height_mm: 400 },
  });
}

const SOCLE = { key: 'international', version: '2026.1' };
const PAYS_CI = { key: 'ci', version: '2026.1' };
const PAYS_SN = { key: 'sn', version: '2026.1' };

describe('D7.1 — le socle et la surcouche entrent dans l’empreinte', () => {
  it('distingue deux sites de même socle et de surcouches différentes', () => {
    expect(hashWith({ base: SOCLE, overlay: PAYS_CI }))
      .not.toBe(hashWith({ base: SOCLE, overlay: PAYS_SN }));
  });

  it('marque un changement de version de la surcouche', () => {
    expect(hashWith({ base: SOCLE, overlay: PAYS_CI }))
      .not.toBe(hashWith({ base: SOCLE, overlay: { key: 'ci', version: '2026.2' } }));
  });

  it('distingue le socle seul du socle surmonté d’une surcouche', () => {
    expect(hashWith({ base: SOCLE })).not.toBe(hashWith({ base: SOCLE, overlay: PAYS_CI }));
  });

  it('distingue un même paquet selon son rôle', () => {
    expect(hashWith({ base: PAYS_CI })).not.toBe(hashWith({ overlay: PAYS_CI }));
  });

  it('ne dépend pas de l’ordre dans lequel les rôles sont donnés', () => {
    expect(hashWith({ overlay: PAYS_CI, base: SOCLE }))
      .toBe(hashWith({ base: SOCLE, overlay: PAYS_CI }));
  });
});
