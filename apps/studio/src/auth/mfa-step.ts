/**
 * AUTH.6 — ce que l'écran du second facteur doit montrer.
 *
 * A6.3 : « Double authentification obligatoire pour `admin` et `owner_rep`. »
 * La base l'exige déjà (0080) ; cet écran donne à l'utilisateur le moyen de
 * la satisfaire. Il ne protège rien par lui-même : sans lui, un `admin`
 * connecté verrait un atelier vide, la base lui refusant tout en `aal1`.
 *
 * Pur : la décision se lit de trois faits, sans réseau.
 */
import type { ScheduleActor } from '../state/message-schedule-permissions.js';

/** Les rôles que A6.3 tient au second facteur. */
export const MFA_REQUIRED_ROLES: readonly ScheduleActor[] = ['admin', 'owner_rep'];

export type MfaStep =
  /** Rien à faire : rôle non tenu, ou facteur déjà vérifié dans cette session. */
  | 'none'
  /** Un facteur existe : saisir son code. */
  | 'verify'
  /** Aucun facteur vérifié : en enrôler un. */
  | 'enroll';

export function mfaStep(input: {
  readonly actor: ScheduleActor;
  readonly currentLevel: string | null;
  readonly verifiedFactors: number;
}): MfaStep {
  if (!MFA_REQUIRED_ROLES.includes(input.actor)) return 'none';
  if (input.currentLevel === 'aal2') return 'none';
  return input.verifiedFactors > 0 ? 'verify' : 'enroll';
}

/** Un code TOTP : six chiffres, espaces de saisie retirés. */
export function totpCode(raw: string): string | null {
  const code = raw.replace(/\s+/g, '');
  return /^\d{6}$/.test(code) ? code : null;
}

/**
 * L'adresse d'image du code QR, ou `null`.
 *
 * Le service rend une image SVG, en adresse `data:` ou en balisage brut selon
 * les versions. Elle n'est jamais insérée comme balisage : rendue par une
 * balise d'image, un SVG n'exécute aucun script. Toute autre forme est
 * écartée, et le secret reste affiché pour une saisie à la main.
 */
export function qrImageSource(qrCode: string): string | null {
  if (qrCode.startsWith('data:image/svg+xml')) return qrCode;
  if (qrCode.trimStart().startsWith('<svg')) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`;
  }
  return null;
}
