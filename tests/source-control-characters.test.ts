import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/**
 * Un caractère de contrôle brut dans une source la fait passer pour un binaire.
 *
 * `guard-naming.ts` portait un octet nul littéral dans un gabarit de chaîne,
 * comme séparateur de clé composite. Le procédé est bon — un nom ne peut pas
 * contenir d'octet nul, la clé est donc sans collision — mais écrit tel quel
 * dans le fichier, il avait une conséquence qu'on ne voit pas : `file` classait
 * la source comme « data », et `grep` la sautait en annonçant « binary file
 * matches », sans son contenu.
 *
 * Une source que les outils de recherche sautent est une source où une
 * infraction se cache indéfiniment. C'est le même défaut que ceux que cette
 * branche poursuit : rien ne casse, rien ne ralentit, et le silence se lit
 * comme une absence de problème.
 *
 * L'échappement `\u0000` produit exactement la même chaîne à l'exécution et
 * rend le fichier lisible par tout le monde.
 */

/**
 * Le premier caractère de contrôle d'une ligne, ou `null`.
 *
 * Écrit en parcours de points de code, et non en expression régulière : un
 * caractère de contrôle dans une classe de caractères déclenche `no-control-regex`,
 * et A2.4 interdit de désactiver une règle de lint pour faire passer une tâche.
 * La tabulation et le saut de ligne sont de la mise en forme et restent admis.
 */
function firstControlChar(line: string): number | null {
  for (const ch of line) {
    const c = ch.codePointAt(0) ?? 0;
    if (c === 0x09 || c === 0x0a) continue;
    if (c < 0x20 || c === 0x7f) return c;
  }
  return null;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|json|sql|css|md)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function sources(): string[] {
  const out: string[] = [];
  for (const group of ['packages', 'apps']) {
    for (const pkg of readdirSync(resolve(ROOT, group), { withFileTypes: true })) {
      if (!pkg.isDirectory()) continue;
      for (const sub of ['src', 'migrations']) {
        const dir = resolve(ROOT, group, pkg.name, sub);
        if (existsSync(dir)) out.push(...walk(dir));
      }
    }
  }
  out.push(...walk(resolve(ROOT, 'tests')));
  out.push(...walk(resolve(ROOT, 'docs')));
  return out;
}

describe('aucune source ne porte de caractère de contrôle brut', () => {
  it('les outils de recherche lisent tous les fichiers du dépôt', () => {
    const offenders: string[] = [];
    for (const file of sources()) {
      const body = readFileSync(file, 'utf-8');
      body.split('\n').forEach((line, i) => {
        const found = firstControlChar(line);
        if (found !== null) {
          const code = found.toString(16).padStart(4, '0').toUpperCase();
          offenders.push(`${relative(ROOT, file)}:${i + 1} U+${code}`);
        }
      });
    }
    expect(
      offenders,
      'Caractères de contrôle bruts :\n' + offenders.join('\n') +
      '\n\nÉcrivez l’échappement (\\u0000, \\t…) : la chaîne produite est la même, ' +
      'et le fichier cesse de passer pour un binaire aux yeux de grep.',
    ).toHaveLength(0);
  });

  it('le motif mord, et seulement sur ce qu’il vise', () => {
    expect(firstControlChar('clé\u0000valeur')).toBe(0x00);
    expect(firstControlChar('retour\u000Bvertical')).toBe(0x0b);
    expect(firstControlChar('suppression\u007Ffinale')).toBe(0x7f);
    expect(firstControlChar('tabulation\tet accents éàü — tiret cadratin')).toBeNull();
    expect(firstControlChar('un échappement écrit \\u0000 en toutes lettres')).toBeNull();
  });
});
