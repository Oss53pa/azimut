import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { upMigrations } from '../migration-corpus.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORDER = readFileSync(resolve(HERE, '..', '..', 'migrations', 'ORDRE.md'), 'utf8');

/** Les noms listés dans le bloc de code du manifeste, dans l'ordre. */
function manifestOrder(): readonly string[] {
  const block = ORDER.match(/```\n([\s\S]*?)```/);
  return (block?.[1] ?? '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

/**
 * L'ordre d'application des migrations, fixé par un manifeste.
 *
 * Quatre numéros sont portés par deux migrations chacun, deux travaux ayant
 * avancé en parallèle. Le tri des noms les départage de fait, mais rien ne le
 * disait. Renumérotation exclue : le registre d'application est tenu par nom,
 * et renommer une migration appliquée la ferait réapparaître comme absente.
 */
describe('ordre des migrations', () => {
  const files = upMigrations().map(m => m.name.replace(/\.up\.sql$/, ''));
  const manifest = manifestOrder();

  it('le manifeste couvre exactement les migrations du répertoire', () => {
    expect(manifest).toEqual(files);
  });

  /**
   * Les quatre collisions sont héritées et figées. Une cinquième serait un
   * défaut nouveau : elle fait échouer ce contrôle.
   */
  it('n’introduit aucune collision de numéro au-delà des quatre héritées', () => {
    const counts = new Map<string, number>();
    for (const name of files) {
      const number = name.slice(0, 4);
      counts.set(number, (counts.get(number) ?? 0) + 1);
    }
    const collisions = [...counts].filter(([, n]) => n > 1).map(([k]) => k).sort();
    expect(collisions).toEqual(['0018', '0019', '0020', '0021']);
  });

  it('chaque migration montante a sa descendante sur le disque', () => {
    const dir = resolve(HERE, '..', '..', 'migrations');
    const manquantes = files.filter(name => !existsSync(resolve(dir, `${name}.down.sql`)));
    expect(manquantes).toEqual([]);
  });
});
