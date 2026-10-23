/**
 * A6.3 et O3 : l'étape que la session doit franchir avant l'atelier.
 *
 * « Double authentification obligatoire pour `admin` et `owner_rep`. »
 * « Un compte de ces rôles sans double authentification enrôlée ne peut rien
 * faire d'autre que l'enrôler. » La base l'applique (0080) ; le studio en tire
 * seulement l'écran à montrer, sans rien décider à sa place.
 *
 * Un compte qui a enrôlé un facteur le vérifie à chaque session, quel que soit
 * son rôle : un second facteur enrôlé qu'on pourrait sauter ne protégerait
 * rien.
 */
import type { AuthFactor } from './auth-api.js';

/** Les rôles qui exigent le second facteur, comme `membership_is_effective` (0080). */
export const MFA_ROLES: readonly string[] = ['admin', 'owner_rep'];

export type AuthStep = 'ready' | 'enroll' | 'verify';

export function hasVerifiedTotp(factors: readonly AuthFactor[]): boolean {
  return factors.some(f => f.factor_type === 'totp' && f.status === 'verified');
}

export function nextAuthStep(
  aal: 'aal1' | 'aal2',
  factors: readonly AuthFactor[],
  roles: readonly string[],
): AuthStep {
  if (aal === 'aal2') return 'ready';
  if (hasVerifiedTotp(factors)) return 'verify';
  if (roles.some(role => MFA_ROLES.includes(role))) return 'enroll';
  return 'ready';
}
