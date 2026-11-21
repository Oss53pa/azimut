/**
 * AUTH.3 — la session d'authentification du poste.
 *
 * Elle lit la session gardée par le client, suit ses changements — connexion,
 * rafraîchissement du jeton, déconnexion — et pose le jeton d'accès comme
 * source de toutes les requêtes (`access-token.ts`). Les écrans n'ont pas à
 * le connaître.
 *
 * Un refus du service se dit d'un seul message, quel qu'en soit le motif :
 * distinguer une adresse inconnue d'une phrase de passe fausse permettrait
 * d'éprouver quelles adresses ont un compte.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GoTrueClient, Session } from '@supabase/auth-js';
import { setAccessTokenSource } from './access-token.js';
import type { SignInInput } from './sign-in-input.js';

export type AuthState =
  | { readonly status: 'loading' }
  | { readonly status: 'signed-out' }
  | { readonly status: 'signed-in'; readonly email: string };

export type SignInFailure = 'failed' | 'unavailable';

export type AuthSession = {
  readonly state: AuthState;
  readonly signIn: (input: SignInInput) => Promise<SignInFailure | null>;
  readonly signOut: () => Promise<void>;
};

/**
 * Le refus à dire, selon le statut que le service a rendu. Aucun statut, le
 * statut 0 que le client donne à une requête qui n'a pas abouti (réseau
 * coupé, refus CORS), ou un statut de serveur : le service n'a pas répondu, et
 * accuser la saisie serait faux. Tout autre refus se dit du même message.
 */
export function signInFailureOf(status: number | undefined): SignInFailure {
  return status === undefined || status === 0 || status >= 500 ? 'unavailable' : 'failed';
}

function stateOf(session: Session | null): AuthState {
  return session === null
    ? { status: 'signed-out' }
    : { status: 'signed-in', email: session.user.email ?? '' };
}

export function useAuthSession(client: GoTrueClient): AuthSession {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const token = useRef<string | null>(null);

  useEffect(() => {
    const release = setAccessTokenSource(() => token.current);
    const adopt = (session: Session | null): void => {
      token.current = session?.access_token ?? null;
      setState(stateOf(session));
    };
    let live = true;
    void client.getSession().then(({ data }) => { if (live) adopt(data.session); });
    const { data } = client.onAuthStateChange((_event, session) => { adopt(session); });
    return () => {
      live = false;
      data.subscription.unsubscribe();
      release();
    };
  }, [client]);

  const signIn = useCallback(async (input: SignInInput): Promise<SignInFailure | null> => {
    try {
      const { error } = await client.signInWithPassword(input);
      return error === null ? null : signInFailureOf(error.status);
    } catch {
      return 'unavailable';
    }
  }, [client]);

  const signOut = useCallback(async (): Promise<void> => {
    await client.signOut();
  }, [client]);

  return { state, signIn, signOut };
}
