import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO_SRC = resolve(HERE, '..', '..');
const STATE_DIR = resolve(STUDIO_SRC, 'state');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const FILES = walk(STUDIO_SRC);

function isUnderState(file: string): boolean {
  return !relative(STATE_DIR, file).startsWith('..');
}

/**
 * M12.A2 — « L'atelier n'écrit jamais directement en base. Il appelle
 * les commandes du module propriétaire. C'est ce qui empêche la règle de
 * propriété unique d'être contournée par l'interface. »
 *
 * La règle est une interdiction, et une interdiction ne se vérifie pas en
 * lisant le code qui la respecte : elle se vérifie en cherchant celui qui ne
 * la respecterait pas. Ce contrôle balaie donc tout `apps/studio/src` et
 * n'excepte que `state/`, qui est le chemin.
 *
 * F15 pose la même chose en structure : `state/` est le dossier décrit comme
 * « magasin et commandes, écrit dans le dépôt ». Aucun autre n'écrit.
 */
describe('M12.A2 — un seul chemin d’écriture', () => {
  it('seul `state/` connaît le paquet de base', () => {
    const fautifs = FILES
      .filter(f => !isUnderState(f))
      .filter(f => /from '@azimut\/db'/.test(readFileSync(f, 'utf8')))
      .map(f => relative(STUDIO_SRC, f));
    expect(fautifs).toEqual([]);
  });

  it('aucun écran n’écrit de SQL', () => {
    const fautifs = FILES
      .filter(f => !isUnderState(f))
      .filter(f => /\b(insert into|update\s+azimut\.|delete from|drizzle)\b/i
        .test(readFileSync(f, 'utf8')))
      .map(f => relative(STUDIO_SRC, f));
    expect(fautifs).toEqual([]);
  });

  /**
   * Le magasin lui-même ne doit pas savoir écrire : il reçoit un émetteur. Sans
   * cela, il deviendrait le second endroit où le schéma est connu, et la
   * frontière se déplacerait sans qu'on s'en aperçoive.
   */
  it('le magasin ne connaît ni SQL ni schéma', () => {
    const store = readFileSync(resolve(STATE_DIR, 'command-store.ts'), 'utf8');
    expect(store).not.toMatch(/\b(insert into|delete from|drizzle|azimut\.)/i);
    expect(store).not.toMatch(/from '@azimut\/db'/);
  });

  /**
   * `state/` existe, et il est le dossier que F15 nomme. Un renommage silencieux
   * ferait passer ce contrôle sur un dossier vide, donc pour rien.
   */
  it('le dossier `state/` de F15 existe et porte le magasin', () => {
    const names = readdirSync(STATE_DIR).filter(n => n.endsWith('.ts'));
    expect(names).toContain('command-store.ts');
  });
});
