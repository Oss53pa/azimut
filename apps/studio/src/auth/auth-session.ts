/**
 * A6.3 : la session d'authentification du studio.
 *
 * Le jeton d'accès ne vit qu'en mémoire. Le jeton de rafraîchissement est
 * gardé pour l'onglet seulement (`sessionStorage`), pour qu'un rechargement de
 * la page ne déconnecte pas : il disparaît à la fermeture de l'onglet, et
 * aucun autre onglet ni aucun autre site ne le lit.
 *
 * La durée d'une session n'est pas décidée ici : elle est celle que le service
 * d'authentification inscrit dans le jeton (`exp`), réglée côté serveur. Le
 * studio rafraîchit à mi-vie du jeton, sans durée écrite dans le code.
 */
import type { AuthApi, Tokens } from './auth-api.js';
import { readClaims } from './token-claims.js';
import type { TokenClaims } from './token-claims.js';

export type Session = TokenClaims & {
  readonly accessToken: string;
  readonly refreshToken: string;
};

export type SessionStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type Scheduler = {
  set(run: () => void, delayMs: number): unknown;
  clear(handle: unknown): void;
};

const REFRESH_KEY = 'azimut.auth.refresh';

export type AuthSession = {
  current(): Session | null;
  accessToken(): string | undefined;
  subscribe(listener: (session: Session | null) => void): () => void;
  /** Ouvre la session à partir d'une réponse du service. `false` si le jeton est illisible. */
  accept(tokens: Tokens): boolean;
  /** Reprend la session de l'onglet, s'il en garde une. */
  restore(): Promise<boolean>;
  /** Ferme la session ; `global` la ferme aussi sur tous les appareils. */
  signOut(scope: 'local' | 'global'): Promise<void>;
};

function safely<T>(run: () => T, fallback: T): T {
  try {
    return run();
  } catch {
    return fallback;
  }
}

export function createAuthSession(
  api: AuthApi,
  storage: SessionStorageLike | null,
  scheduler: Scheduler,
  nowMs: () => number,
): AuthSession {
  let session: Session | null = null;
  let timer: unknown = null;
  const listeners = new Set<(s: Session | null) => void>();

  function publish(next: Session | null): void {
    session = next;
    if (timer !== null) scheduler.clear(timer);
    timer = null;
    if (next === null) {
      safely(() => { storage?.removeItem(REFRESH_KEY); }, undefined);
    } else {
      safely(() => { storage?.setItem(REFRESH_KEY, next.refreshToken); }, undefined);
      const remaining = next.expiresAt * 1000 - nowMs();
      timer = scheduler.set(() => { void renew(next.refreshToken); }, Math.max(0, remaining / 2));
    }
    for (const listener of listeners) listener(next);
  }

  function accept(tokens: Tokens): boolean {
    const claims = readClaims(tokens.access_token);
    if (claims === null) {
      publish(null);
      return false;
    }
    publish({ ...claims, accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
    return true;
  }

  async function renew(refreshToken: string): Promise<boolean> {
    const out = await api.refresh(refreshToken);
    if (!out.ok) {
      publish(null);
      return false;
    }
    return accept(out.value);
  }

  return {
    current: () => session,
    accessToken: () => session?.accessToken,
    subscribe: listener => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    accept,
    restore: async () => {
      const stored = safely(() => storage?.getItem(REFRESH_KEY) ?? null, null);
      if (stored === null || stored === '') return false;
      return renew(stored);
    },
    signOut: async scope => {
      const token = session?.accessToken;
      publish(null);
      if (token !== undefined) await api.signOut(token, scope);
    },
  };
}
