import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import type { SiteData, TravelProfile } from '@azimut/core-model';
import { profileRoutes } from '../profile-routes.js';

const base = refMultilevel.travel_profiles[0];

function withProfiles(extra: readonly TravelProfile[]): SiteData {
  if (base === undefined) throw new Error('profil manquant');
  return { ...refMultilevel, travel_profiles: [base, ...extra] };
}

describe('Module 03 — itinéraires par profil', () => {
  it('résout chaque couple entrée → destination pour le profil de référence', () => {
    const [row] = profileRoutes(refMultilevel);
    expect(row?.pairs).toBeGreaterThan(0);
    expect(row?.solved).toBe(row?.pairs);
    expect(row?.meanDetour).toBeNull();
  });

  it('compte sans solution ce qu’un profil ne peut plus atteindre', () => {
    if (base === undefined) throw new Error('profil manquant');
    // Les exclusions portent sur le type des nœuds que l'arête relie : sans
    // ascenseur ni escalier, le R+1 n'est plus atteignable.
    const blocked: TravelProfile = {
      ...base, id: 'p-blocked', key: 'blocked',
      excluded_edge_kinds: ['elevator', 'stair', 'escalator'],
    };
    const row = profileRoutes(withProfiles([blocked])).find(r => r.profileId === 'p-blocked');
    expect(row?.unsolved).toBeGreaterThan(0);
    expect(row?.solved).toBe((row?.pairs ?? 0) - (row?.unsolved ?? 0));
  });

  it('ne trouve aucun allongement à un profil identique à la référence', () => {
    if (base === undefined) throw new Error('profil manquant');
    const twin: TravelProfile = { ...base, id: 'p-twin', key: 'twin' };
    const row = profileRoutes(withProfiles([twin])).find(r => r.profileId === 'p-twin');
    expect(row?.meanDetour).toBeCloseTo(0, 12);
  });
});
