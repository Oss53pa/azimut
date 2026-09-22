import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', '..', 'scripts', 'reset.js');

/**
 * `pnpm db:reset` — les deux refus, et ce que le script touche.
 *
 * Deux défauts réparés, tous deux constatés en exécutant le script :
 *
 *  · il supprimait le schéma `public` et laissait `azimut`, où vit
 *    l'application. Il ne remettait donc pas la base à zéro, il la cassait en
 *    emportant ce que la base pouvait porter par ailleurs ;
 *  · il s'exécutait partout, y compris sur une base de production, où il
 *    aurait supprimé toutes les données du client.
 *
 * L'essai lance le script pour de vrai. Un essai qui lirait seulement son
 * texte dirait que les gardes sont écrites, pas qu'elles tiennent.
 */
function run(env: Readonly<Record<string, string>>): { code: number; stderr: string } {
  try {
    execFileSync('node', [SCRIPT], {
      env: { PATH: process.env['PATH'] ?? '', ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stderr: '' };
  } catch (error: unknown) {
    const failure = error as { status?: number; stderr?: string };
    return { code: failure.status ?? -1, stderr: failure.stderr ?? '' };
  }
}

describe('db:reset — refuse hors de l’environnement local', () => {
  it('refuse sans déclaration d’environnement', () => {
    const { code, stderr } = run({
      DATABASE_URL: 'postgres://u@127.0.0.1:5432/p',
    });
    expect(code).toBe(1);
    expect(stderr).toContain('AZIMUT_ENV');
  });

  it('refuse en recette', () => {
    const { code, stderr } = run({
      AZIMUT_ENV: 'recette',
      DATABASE_URL: 'postgres://u@127.0.0.1:5432/p',
    });
    expect(code).toBe(1);
    expect(stderr).toContain('recette');
  });

  it('refuse en production', () => {
    const { code } = run({
      AZIMUT_ENV: 'production',
      DATABASE_URL: 'postgres://u@127.0.0.1:5432/p',
    });
    expect(code).toBe(1);
  });

  /**
   * Une déclaration traîne dans un terminal. L'adresse, non : c'est elle qui
   * dit sur quelle base le script est sur le point d'agir. Les deux gardes
   * sont voulues, l'une ne remplace pas l'autre.
   */
  it('refuse une base distante, même déclarée locale', () => {
    const { code, stderr } = run({
      AZIMUT_ENV: 'local',
      DATABASE_URL: 'postgres://u@db.exemple.net:5432/p',
    });
    expect(code).toBe(1);
    expect(stderr).toContain('bouclage');
  });

  it('refuse toujours sans URL de base', () => {
    const { code } = run({ AZIMUT_ENV: 'local' });
    expect(code).toBe(1);
  });
});

describe('db:reset — ne touche que les schémas de l’application', () => {
  const source = readFileSync(SCRIPT, 'utf8');

  it('supprime le schéma de l’application', () => {
    expect(source).toContain('DROP SCHEMA IF EXISTS azimut CASCADE');
  });

  /**
   * Le schéma `public` porte deux objets du produit, posés par la migration
   * 0001. Ils partent. Le schéma lui-même reste : il peut porter des
   * extensions et des objets qui n'appartiennent pas à Azimut.
   */
  it('ne supprime pas le schéma public', () => {
    expect(source).not.toContain('DROP SCHEMA public');
    expect(source).toContain('DROP TABLE IF EXISTS public._migrations');
    expect(source).toContain('DROP FUNCTION IF EXISTS public.set_updated_at()');
  });
});
