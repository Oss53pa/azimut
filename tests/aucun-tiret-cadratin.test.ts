import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trackedTextFiles } from '../scripts/secret-scan.mjs';

/**
 * Règle de rédaction du dépôt : aucun tiret cadratin, ni dans le texte, ni
 * dans le code, ni dans l'interface. Une valeur vide s'écrit avec le tiret
 * demi-cadratin. Un essai qui doit fournir ce caractère en entrée (la charte
 * de signalétique l'interdit, A5.8) l'écrit en échappement, `\u2014`.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CADRATIN = '\u2014';

describe('aucun tiret cadratin dans le dépôt', () => {
  it('aucun fichier suivi n’en porte', () => {
    const offenders = trackedTextFiles(ROOT).flatMap(({ path, text }) =>
      text.split('\n').flatMap((line, i) => (line.includes(CADRATIN) ? [`${path}:${String(i + 1)}`] : [])));
    expect(offenders).toEqual([]);
  });
});
