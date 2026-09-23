/**
 * Le banc d'essai du chemin réel : PostgREST devant la base.
 *
 * A10.4 nº 2 exige l'étanchéité entre deux organisations « y compris par canal
 * indirect ». Les essais l'éprouvaient par connexion SQL directe, en posant le
 * rôle et l'identité à la main. C'était éprouver la politique, pas le chemin :
 * l'application ne parle jamais à PostgreSQL, elle parle à PostgREST, qui pose
 * lui-même le rôle depuis un jeton. Entre les deux se trouvent l'exposition du
 * schéma, la conversion du jeton en rôle, les en-têtes de comptage et les
 * messages d'erreur — c'est-à-dire précisément les canaux indirects que la
 * règle nomme.
 *
 * Le banc reproduit ce que la plateforme fournit en production, et rien de
 * plus :
 *
 *  · `auth.uid()`, que Supabase installe et que `azimut.current_user_id()`
 *    appelle en repli. Sa définition ici est celle de Supabase : la
 *    revendication `sub` du jeton. L'écrire autrement ferait passer les essais
 *    sur une identité que la production ne produit pas.
 *  · `authenticator`, le rôle sans droits propres auquel PostgREST se connecte
 *    et depuis lequel il bascule vers `authenticated` ou `anon`.
 *
 * Rien de tout cela n'entre dans une migration : ces objets appartiennent à la
 * plateforme (partie Q), pas au produit.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createHmac } from 'node:crypto';
import type { Sql } from 'postgres';

/** Le secret de signature du banc. Sans valeur en production : il est jetable. */
export const TEST_JWT_SECRET = 'banc-d-essai-azimut-secret-de-trente-deux-octets';

export type Harness = {
  readonly url: string;
  readonly stop: () => Promise<void>;
};

/** Un jeton d'accès, tel que la plateforme en délivre un. */
export function signToken(userId: string, role = 'authenticated'): string {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const head = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode({
    sub: userId,
    role,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const signature = createHmac('sha256', TEST_JWT_SECRET)
    .update(`${head}.${body}`)
    .digest('base64url');
  return `${head}.${body}.${signature}`;
}

/**
 * Installe ce que la plateforme fournit, et que la base d'essai n'a pas.
 *
 * `auth.uid()` est défini en `SECURITY INVOKER` et lit la revendication que
 * PostgREST place dans la session. Le repli sur `NULL` quand rien n'est posé
 * est ce qui rend un appel anonyme sans organisation, donc sans ligne.
 */
export async function installPlatformStubs(sql: Sql): Promise<void> {
  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE SET search_path TO ''
      AS $fn$
        SELECT nullif(
          current_setting('request.jwt.claims', true)::json ->> 'sub', ''
        )::uuid;
      $fn$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
  `);

  // Les deux rôles demandent un compte d'administration, que le propriétaire
  // de la base n'a pas. Ils sont donc posés une fois à la mise en route, et
  // vérifiés ici : les créer à la volée demanderait un compte d'administration
  // dans la chaîne de connexion des essais, ce qui est précisément ce qu'on ne
  // veut pas y mettre.
  const roles = await sql.unsafe<{ rolname: string }[]>(
    "SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticator')",
  );
  if (roles.length < 2) {
    throw new Error(
      'Les rôles `anon` et `authenticator` manquent. Voir la mise en route de '
      + '`packages/db/migrations/ORDRE.md`, section « étanchéité par PostgREST ».',
    );
  }
  await sql.unsafe('GRANT USAGE ON SCHEMA auth TO anon');
}

/** Démarre PostgREST et attend qu'il réponde. */
export async function startPostgrest(options: {
  readonly binary: string;
  readonly dbUri: string;
  readonly port: number;
}): Promise<Harness> {
  const child: ChildProcess = spawn(options.binary, [], {
    env: {
      ...process.env,
      PGRST_DB_URI: options.dbUri,
      PGRST_DB_SCHEMAS: 'azimut',
      PGRST_DB_ANON_ROLE: 'anon',
      PGRST_JWT_SECRET: TEST_JWT_SECRET,
      PGRST_SERVER_PORT: String(options.port),
      PGRST_LOG_LEVEL: 'crit',
    },
    stdio: 'ignore',
  });

  const url = `http://127.0.0.1:${String(options.port)}`;
  const deadline = Date.now() + 20_000;
  for (;;) {
    if (Date.now() > deadline) {
      child.kill('SIGTERM');
      throw new Error('PostgREST n’a pas répondu dans le délai imparti');
    }
    try {
      const probe = await fetch(`${url}/`, { method: 'GET' });
      if (probe.status < 500) break;
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
