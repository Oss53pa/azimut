/**
 * Le décor partagé des essais d'audit : le profil de déplacement du site
 * minimal, et de quoi en tirer un autre. Réparti entre plusieurs fichiers
 * d'essais pour tenir la limite de 400 lignes (A2.4).
 */
import { refMinimal } from '@azimut/testkit';
import type { TravelProfile } from '@azimut/core-model';

export function getProfile(
  profiles: readonly TravelProfile[],
  idx: number,
): TravelProfile {
  const p = profiles[idx];
  if (!p) throw new Error(`No profile at index ${idx}`);
  return p;
}

export const stdProfile = getProfile(refMinimal.travel_profiles, 0);
