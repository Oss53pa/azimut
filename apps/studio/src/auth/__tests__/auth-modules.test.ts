import { describe, it, expect } from 'vitest';
import { bearerToken, setAccessTokenSource } from '../access-token.js';
import { authConfigFrom } from '../auth-config.js';
import { MAX_EMAIL_LENGTH, signInInput } from '../sign-in-input.js';
import { signInFailureOf } from '../use-auth-session.js';

describe('AUTH.3 — le jeton des requêtes', () => {
  it('présente la clé publiable sans session, le jeton de la session sinon', () => {
    expect(bearerToken('clé')).toBe('clé');
    let token: string | null = 'jeton-1';
    const release = setAccessTokenSource(() => token);
    expect(bearerToken('clé')).toBe('jeton-1');
    token = 'jeton-2';
    expect(bearerToken('clé')).toBe('jeton-2');
    token = null;
    expect(bearerToken('clé')).toBe('clé');
    release();
  });

  it('une source retirée ne survit pas, une source remplacée n’est pas retirée par l’ancienne', () => {
    const first = setAccessTokenSource(() => 'a');
    const second = setAccessTokenSource(() => 'b');
    first();
    expect(bearerToken('clé')).toBe('b');
    second();
    expect(bearerToken('clé')).toBe('clé');
  });
});

/** Une valeur d'essai, jamais une clé : la clé publiable n'est pas un secret, mais aucune ne s'écrit ici. */
const KEY = ['valeur', 'essai'].join('-');

describe('AUTH.3 — la configuration', () => {
  it('rend null sans URL ou sans clé : le studio reste en mode local', () => {
    expect(authConfigFrom({})).toBeNull();
    expect(authConfigFrom({ VITE_AZIMUT_AUTH_URL: 'https://a.invalid/auth/v1' })).toBeNull();
    expect(authConfigFrom({ VITE_AZIMUT_API_KEY: KEY })).toBeNull();
  });

  it('retire la barre oblique finale', () => {
    expect(authConfigFrom({ VITE_AZIMUT_AUTH_URL: ' https://a.invalid/auth/v1/ ', VITE_AZIMUT_API_KEY: KEY }))
      .toEqual({ url: 'https://a.invalid/auth/v1', apiKey: KEY });
  });
});

describe('AUTH.3 — la saisie de connexion', () => {
  it('accepte une adresse et une phrase de passe, l’adresse sans espaces de bord', () => {
    expect(signInInput(' nom@exemple.fr ', 'phrase')).toEqual({
      ok: true, value: { email: 'nom@exemple.fr', password: 'phrase' },
    });
  });

  it('refuse ce qui ne peut pas réussir, sans l’envoyer', () => {
    expect(signInInput('', 'p')).toEqual({ ok: false, refusal: 'email_required' });
    expect(signInInput('a@b', '')).toEqual({ ok: false, refusal: 'password_required' });
    expect(signInInput('sans-arobase', 'p')).toEqual({ ok: false, refusal: 'email_invalid' });
    expect(signInInput(`${'a'.repeat(MAX_EMAIL_LENGTH)}@b`, 'p')).toEqual({ ok: false, refusal: 'too_long' });
  });
});

describe('AUTH.3 — le refus du service', () => {
  it('une requête qui n’a pas abouti ou un serveur en panne ne s’imputent pas à la saisie', () => {
    expect(signInFailureOf(undefined)).toBe('unavailable');
    expect(signInFailureOf(0)).toBe('unavailable');
    expect(signInFailureOf(503)).toBe('unavailable');
  });

  it('tout autre refus se dit d’un seul message, sans dire lequel des deux est faux', () => {
    expect(signInFailureOf(400)).toBe('failed');
    expect(signInFailureOf(422)).toBe('failed');
    expect(signInFailureOf(429)).toBe('failed');
  });
});
