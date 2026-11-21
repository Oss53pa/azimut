/**
 * AUTH.3 — ce que le formulaire de connexion envoie, borné avant l'envoi.
 *
 * La vérification réelle est celle du service : une adresse inconnue et une
 * phrase de passe fausse y reçoivent le même refus. Ce contrôle-ci n'en est
 * pas un de sécurité ; il évite d'envoyer ce qui ne peut pas réussir, et
 * borne la taille de ce qui part.
 */

/** Longueur maximale d'une adresse (RFC 5321). */
export const MAX_EMAIL_LENGTH = 254;

/** Borne technique d'une phrase de passe, sans origine normative. */
export const MAX_PASSWORD_LENGTH = 1024;

export type SignInInput = { readonly email: string; readonly password: string };

export type SignInRefusal = 'email_required' | 'email_invalid' | 'password_required' | 'too_long';

export function signInInput(
  email: string,
  password: string,
): { ok: true; value: SignInInput } | { ok: false; refusal: SignInRefusal } {
  const address = email.trim();
  if (address === '') return { ok: false, refusal: 'email_required' };
  if (password === '') return { ok: false, refusal: 'password_required' };
  if (address.length > MAX_EMAIL_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, refusal: 'too_long' };
  }
  // Une arobase, entourée de caractères, sans espace : la forme, pas la validité.
  if (!/^[^\s@]+@[^\s@]+$/.test(address)) return { ok: false, refusal: 'email_invalid' };
  return { ok: true, value: { email: address, password } };
}
