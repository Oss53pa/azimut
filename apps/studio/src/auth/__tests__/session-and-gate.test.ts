import { describe, it, expect } from 'vitest';
import { readClaims } from '../token-claims.js';
import { nextAuthStep } from '../mfa-requirement.js';
import { createAuthSession } from '../auth-session.js';
import type { SessionStorageLike } from '../auth-session.js';
import type { AuthApi, AuthResult, Tokens } from '../auth-api.js';
import { gateView } from '../gate-view.js';

const USER = '0a000000-0000-4000-8000-0000000000a1';
const ORG = '0a000000-0000-4000-8000-000000000001';

function token(claims: Record<string, unknown>): string {
  const encode = (v: unknown): string => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode(claims)}.signature`;
}

const TOTP = { id: 'f1', factor_type: 'totp', status: 'verified' };

describe('les revendications du jeton', () => {
  it('lit sub, exp et aal ; aal absent vaut aal1', () => {
    expect(readClaims(token({ sub: USER, exp: 2000, aal: 'aal2' }))).toEqual({ userId: USER, expiresAt: 2000, aal: 'aal2' });
    expect(readClaims(token({ sub: USER, exp: 2000 }))?.aal).toBe('aal1');
  });

  it('un jeton mal formé ou dont sub n’est pas un identifiant est écarté', () => {
    expect(readClaims('pas-un-jeton')).toBeNull();
    expect(readClaims(token({ sub: 'alice', exp: 2000 }))).toBeNull();
    expect(readClaims(token({ sub: USER, exp: 2000, aal: 'aal9' }))).toBeNull();
  });
});

describe('A6.3 et O3 : l’étape avant l’atelier', () => {
  it('admin et owner_rep sans facteur enrôlent ; avec un facteur vérifié, ils vérifient', () => {
    expect(nextAuthStep('aal1', [], ['admin'])).toBe('enroll');
    expect(nextAuthStep('aal1', [], ['designer', 'owner_rep'])).toBe('enroll');
    expect(nextAuthStep('aal1', [TOTP], ['admin'])).toBe('verify');
  });

  it('un designer passe ; mais un facteur enrôlé se vérifie, quel que soit le rôle', () => {
    expect(nextAuthStep('aal1', [], ['designer'])).toBe('ready');
    expect(nextAuthStep('aal1', [TOTP], ['designer'])).toBe('verify');
  });

  it('une session aal2 passe toujours', () => {
    expect(nextAuthStep('aal2', [TOTP], ['admin'])).toBe('ready');
  });
});

function memoryStorage(): SessionStorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: k => { data.delete(k); },
  };
}

function fakeApi(refresh: (r: string) => AuthResult<Tokens>): AuthApi & { signedOut: string[] } {
  const signedOut: string[] = [];
  const unused = async (): Promise<never> => { throw new Error('non prévu'); };
  return {
    signedOut,
    signIn: unused,
    user: unused,
    enrollTotp: unused,
    verifyTotp: unused,
    refresh: async r => refresh(r),
    signOut: async (_t, scope) => { signedOut.push(scope); return { ok: true, value: null }; },
  };
}

describe('A6.3 : la session du studio', () => {
  it('garde le jeton d’accès en mémoire, le rafraîchissement pour l’onglet, et renouvelle à mi-vie', async () => {
    const storage = memoryStorage();
    const timers: { run: () => void; delay: number }[] = [];
    const next: Tokens = { access_token: token({ sub: USER, exp: 3000, aal: 'aal2' }), refresh_token: 'r2', expires_in: 1000 };
    const session = createAuthSession(fakeApi(() => ({ ok: true, value: next })), storage,
      { set: (run, delay) => { timers.push({ run, delay }); return timers.length; }, clear: () => undefined },
      () => 1_000_000);
    expect(session.accept({ access_token: token({ sub: USER, exp: 2000 }), refresh_token: 'r1', expires_in: 1000 })).toBe(true);
    expect(storage.data.get('azimut.auth.refresh')).toBe('r1');
    expect(timers[0]?.delay).toBe(500_000);
    timers[0]?.run();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(session.current()?.aal).toBe('aal2');
    expect(storage.data.get('azimut.auth.refresh')).toBe('r2');
  });

  it('un rafraîchissement refusé ferme la session et efface le jeton de l’onglet', async () => {
    const storage = memoryStorage();
    storage.setItem('azimut.auth.refresh', 'vieux');
    const session = createAuthSession(fakeApi(() => ({ ok: false, reason: 'refused' })), storage,
      { set: () => 0, clear: () => undefined }, () => 0);
    expect(await session.restore()).toBe(false);
    expect(session.current()).toBeNull();
    expect(storage.data.has('azimut.auth.refresh')).toBe(false);
  });

  it('la déconnexion porte la portée demandée, et ferme la session d’abord', async () => {
    const api = fakeApi(() => ({ ok: false, reason: 'refused' }));
    const session = createAuthSession(api, memoryStorage(), { set: () => 0, clear: () => undefined }, () => 0);
    session.accept({ access_token: token({ sub: USER, exp: 2000 }), refresh_token: 'r', expires_in: 1 });
    await session.signOut('global');
    expect(session.current()).toBeNull();
    expect(api.signedOut).toEqual(['global']);
  });
});

describe('A6.3 et O3 : ce que la garde montre', () => {
  const aal1 = { userId: USER, expiresAt: 2000, aal: 'aal1' as const, accessToken: 'a', refreshToken: 'r' };
  const done = (factors: typeof TOTP[], roles: string[]) => ({
    kind: 'done' as const, factors,
    memberships: roles.map(role => ({ orgId: ORG, role: role as 'admin' })),
  });

  it('sans session : chargement pendant la reprise, puis connexion', () => {
    expect(gateView(true, null, { kind: 'pending' })).toEqual({ kind: 'loading' });
    expect(gateView(false, null, { kind: 'pending' })).toEqual({ kind: 'signed_out' });
  });

  it('un admin en aal1 ne voit que le second facteur', () => {
    expect(gateView(false, aal1, done([], ['admin']))).toEqual({ kind: 'second_factor', mode: 'enroll', factorId: null });
    expect(gateView(false, aal1, done([TOTP], ['admin']))).toEqual({ kind: 'second_factor', mode: 'verify', factorId: 'f1' });
  });

  it('sans inscription, un message ; avec, l’atelier sous la première', () => {
    expect(gateView(false, aal1, done([], []))).toEqual({ kind: 'no_org' });
    expect(gateView(false, aal1, done([], ['designer']))).toEqual({ kind: 'ready', membership: { orgId: ORG, role: 'designer' } });
    expect(gateView(false, aal1, { kind: 'failed' })).toEqual({ kind: 'read_failed' });
  });
});
