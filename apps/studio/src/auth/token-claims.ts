/**
 * Les revendications d'un jeton d'accès, lues sans être vérifiées.
 *
 * Le studio ne fait pas confiance à ce qu'il lit ici : la base vérifie la
 * signature et applique elle-même le niveau d'assurance (0080). Le studio
 * lit `sub`, `exp` et `aal` pour une seule raison, choisir l'écran à montrer :
 * connexion, second facteur, ou atelier.
 */
import { z } from 'zod';

const Claims = z.object({
  sub: z.uuid(),
  exp: z.number().int().positive(),
  aal: z.enum(['aal1', 'aal2']).optional(),
});

export type TokenClaims = {
  readonly userId: string;
  /** Expiration, en secondes depuis l'époque. */
  readonly expiresAt: number;
  readonly aal: 'aal1' | 'aal2';
};

function decodeSegment(segment: string): unknown {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

/** Les revendications d'un jeton, ou `null` s'il n'a pas la forme attendue. */
export function readClaims(token: string): TokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[1] === undefined) return null;
  let payload: unknown;
  try {
    payload = decodeSegment(parts[1]);
  } catch {
    return null;
  }
  const parsed = Claims.safeParse(payload);
  if (!parsed.success) return null;
  return { userId: parsed.data.sub, expiresAt: parsed.data.exp, aal: parsed.data.aal ?? 'aal1' };
}
