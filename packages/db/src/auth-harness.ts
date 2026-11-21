/**
 * AUTH.2 — le banc du service d'authentification de Supabase.
 *
 * Décision QA2 d'Oss53pa (21 novembre 2026) : la connexion réelle s'éprouve
 * sur une installation autonome (A3.4), et non plus seulement par des jetons
 * que le banc signe lui-même. Le service délivre ses jetons avec le secret de
 * `postgrest-harness.ts`, que PostgREST vérifie : c'est la chaîne de
 * production, sans plateforme.
 *
 * La base est celle de `scripts/monter-base-authentification.sh`. Le service
 * n'y migre rien : le script l'a fait.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { testJwtSecret } from './postgrest-harness.js';

export type AuthService = {
  readonly url: string;
  readonly stop: () => Promise<void>;
};

/** Démarre le service et attend qu'il réponde. */
export async function startAuthService(options: {
  readonly binary: string;
  /** Connexion du rôle propriétaire du schéma `auth`. */
  readonly dbUri: string;
  readonly port: number;
}): Promise<AuthService> {
  const url = `http://127.0.0.1:${String(options.port)}`;
  const child: ChildProcess = spawn(options.binary, ['serve'], {
    env: {
      ...process.env,
      GOTRUE_DB_DRIVER: 'postgres',
      DATABASE_URL: `${options.dbUri}?search_path=auth`,
      GOTRUE_JWT_SECRET: testJwtSecret(),
      GOTRUE_JWT_AUD: 'authenticated',
      GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
      API_EXTERNAL_URL: url,
      GOTRUE_SITE_URL: url,
      GOTRUE_API_HOST: '127.0.0.1',
      PORT: String(options.port),
      // Le banc n'envoie aucun courriel : l'inscription est confirmée
      // d'office. L'invitation d'O3 relève d'AUTH.7.
      GOTRUE_MAILER_AUTOCONFIRM: 'true',
      GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
      GOTRUE_DISABLE_SIGNUP: 'false',
      GOTRUE_LOG_LEVEL: 'error',
    },
    stdio: 'ignore',
  });

  const deadline = Date.now() + 20_000;
  for (;;) {
    if (Date.now() > deadline) {
      child.kill('SIGTERM');
      throw new Error('le service d’authentification n’a pas répondu dans le délai imparti');
    }
    try {
      const probe = await fetch(`${url}/health`);
      if (probe.ok) break;
    } catch {
      // Pas encore en écoute.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return {
    url,
    stop: () => new Promise<void>(resolve => {
      child.once('exit', () => { resolve(); });
      child.kill('SIGTERM');
    }),
  };
}
