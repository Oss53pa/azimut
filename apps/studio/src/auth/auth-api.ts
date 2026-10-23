/**
 * A6.3 et O3 : le client d'authentification du studio, par appels HTTP directs
 * au service d'authentification (décision D-2, 22/10/2026 : aucune
 * bibliothèque nouvelle).
 *
 * Six opérations, et pas davantage : ouvrir une session par mot de passe, la
 * rafraîchir, la fermer (ce poste ou tous les appareils), lire l'utilisateur
 * et ses facteurs, enrôler un facteur TOTP, et le vérifier. Chaque réponse est
 * validée par zod avant d'être lue (A6.3) : une réponse qui n'a pas la forme
 * attendue est un échec, jamais une valeur devinée.
 *
 * Le motif d'un échec ne dit que ce dont l'écran a besoin, et rien du compte :
 * « identifiants refusés » vaut pour une adresse inconnue comme pour un mot de
 * passe faux.
 */
import { z } from 'zod';

export type AuthConfig = {
  /** Racine du service d'authentification, sans barre oblique finale. */
  readonly url: string;
  /** Clé publiable, la même que pour l'API REST. */
  readonly apiKey: string;
};

export type AuthFailure = 'refused' | 'invalid_code' | 'unavailable' | 'malformed';
export type AuthResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: AuthFailure };

const TokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});
export type Tokens = z.infer<typeof TokenResponse>;

const Factor = z.object({
  id: z.string().min(1),
  factor_type: z.string(),
  status: z.string(),
});
export type AuthFactor = z.infer<typeof Factor>;

const UserResponse = z.object({
  id: z.uuid(),
  factors: z.array(Factor).nullish(),
});
export type AuthUser = { readonly id: string; readonly factors: readonly AuthFactor[] };

const EnrollResponse = z.object({
  id: z.string().min(1),
  totp: z.object({ qr_code: z.string().min(1), secret: z.string().min(1), uri: z.string().min(1) }),
});
export type TotpEnrollment = z.infer<typeof EnrollResponse>;

const ChallengeResponse = z.object({ id: z.string().min(1) });

export type AuthApi = {
  signIn(email: string, password: string): Promise<AuthResult<Tokens>>;
  refresh(refreshToken: string): Promise<AuthResult<Tokens>>;
  signOut(accessToken: string, scope: 'local' | 'global'): Promise<AuthResult<null>>;
  user(accessToken: string): Promise<AuthResult<AuthUser>>;
  enrollTotp(accessToken: string): Promise<AuthResult<TotpEnrollment>>;
  verifyTotp(accessToken: string, factorId: string, code: string): Promise<AuthResult<Tokens>>;
};

export function createAuthApi(config: AuthConfig, fetchImpl: typeof fetch = fetch): AuthApi {
  async function call<T>(
    path: string,
    init: { readonly method: 'GET' | 'POST'; readonly token?: string; readonly body?: unknown },
    schema: z.ZodType<T> | null,
    refusal: AuthFailure,
  ): Promise<AuthResult<T>> {
    const headers: Record<string, string> = { apikey: config.apiKey, 'Content-Type': 'application/json' };
    if (init.token !== undefined) headers['Authorization'] = `Bearer ${init.token}`;
    let response: Response;
    try {
      response = await fetchImpl(`${config.url}${path}`, {
        method: init.method,
        headers,
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      });
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
    if (response.status >= 500) return { ok: false, reason: 'unavailable' };
    if (!response.ok) return { ok: false, reason: refusal };
    if (schema === null) return { ok: true, value: null as T };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, reason: 'malformed' };
    }
    const parsed = schema.safeParse(body);
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: 'malformed' };
  }

  return {
    signIn: (email, password) =>
      call('/token?grant_type=password', { method: 'POST', body: { email, password } }, TokenResponse, 'refused'),
    refresh: refreshToken =>
      call('/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: refreshToken } },
        TokenResponse, 'refused'),
    signOut: (accessToken, scope) =>
      call(`/logout?scope=${scope}`, { method: 'POST', token: accessToken }, null, 'refused'),
    user: async accessToken => {
      const out = await call('/user', { method: 'GET', token: accessToken }, UserResponse, 'refused');
      return out.ok ? { ok: true, value: { id: out.value.id, factors: out.value.factors ?? [] } } : out;
    },
    enrollTotp: accessToken =>
      call('/factors', { method: 'POST', token: accessToken, body: { factor_type: 'totp' } }, EnrollResponse, 'refused'),
    verifyTotp: async (accessToken, factorId, code) => {
      const factor = encodeURIComponent(factorId);
      const challenge = await call(`/factors/${factor}/challenge`, { method: 'POST', token: accessToken },
        ChallengeResponse, 'refused');
      if (!challenge.ok) return challenge;
      return call(`/factors/${factor}/verify`,
        { method: 'POST', token: accessToken, body: { challenge_id: challenge.value.id, code } },
        TokenResponse, 'invalid_code');
    },
  };
}
