import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A5.8 — la borne ne résout aucune fonction de pictogramme.
 *
 * Le paquet de borne ne transporte pas les rattachements du site à ses
 * paquets de règles, et `loadKioskSite` rend un site où ce champ est absent,
 * et non vide : `KioskSite`. Une résolution faite ici ne trouverait donc jamais
 * le registre de sécurité, et omettrait la marque là où elle compte le plus :
 * l'écran d'évacuation. Tout ce qui porte un pictogramme est composé à la
 * construction du paquet. Le tracé d'un itinéraire, lui, se compose à
 * l'exécution, puisque le visiteur choisit sa destination : il vient du moteur
 * de graphe, ne porte aucun pictogramme, et les moteurs de rendu restent hors
 * de la borne.
 *
 * L'essai lit les imports du code d'exécution et refuse ceux qui résolvent une
 * fonction ou dessinent un plan. Un import par espace de noms est refusé aussi :
 * il masquerait ce qu'il emploie.
 */

const SRC = join(__dirname, '..');
const FORBIDDEN = new Set([
  'resolvePictogramFunction', 'siteScope', 'pictogramFunctionFinding',
  'accessibleSpaceMark', 'packsByPrecedence', 'resolveSiteRulesPack',
]);

function runtimeSources(): readonly { readonly file: string; readonly text: string }[] {
  return readdirSync(SRC)
    .filter(name => name.endsWith('.ts'))
    .map(name => ({ file: name, text: readFileSync(join(SRC, name), 'utf8') }));
}

function importedNames(text: string): readonly string[] {
  const names: string[] = [];
  for (const match of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from/g)) {
    for (const part of (match[1] ?? '').split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim();
      if (name !== undefined && name !== '') names.push(name);
    }
  }
  return names;
}

describe('A5.8 — aucune résolution de fonction à l’exécution sur la borne', () => {
  it('le code d’exécution n’importe rien qui résolve une fonction de pictogramme', () => {
    const offending = runtimeSources().flatMap(({ file, text }) =>
      importedNames(text).filter(name => FORBIDDEN.has(name)).map(name => `${file}: ${name}`));
    expect(offending).toEqual([]);
  });

  it('le code d’exécution n’importe aucun module par espace de noms', () => {
    const namespaced = runtimeSources()
      .filter(({ text }) => /import\s+\*\s+as\s/.test(text))
      .map(({ file }) => file);
    expect(namespaced).toEqual([]);
  });

  it('le code d’exécution ne lit aucun rattachement aux paquets de règles', () => {
    // Le typage l'interdit déjà sur `KioskSite` ; l'essai ferme la porte d'un
    // `SiteData` réintroduit à la main.
    const reading = runtimeSources()
      .filter(({ file, text }) => file !== 'load-kiosk-site.ts' && text.includes('rules_bindings'))
      .map(({ file }) => file);
    expect(reading).toEqual([]);
  });

  it('la borne ne dépend d’aucun moteur de rendu ni du chargeur de règles', () => {
    const manifest = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8')) as {
      readonly dependencies?: Readonly<Record<string, string>>;
    };
    const deps = Object.keys(manifest.dependencies ?? {});
    expect(deps.filter(d => ['@azimut/engine-layout', '@azimut/engine-iso', '@azimut/rules'].includes(d)))
      .toEqual([]);
  });

  it('l’essai voit bien les imports qu’il juge', () => {
    expect(importedNames("import { computeRoute } from '@azimut/engine-graph';"))
      .toEqual(['computeRoute']);
    expect(importedNames("import type { Route, Site as S } from 'x';")).toEqual(['Route', 'Site']);
  });
});
