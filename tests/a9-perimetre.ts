import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * A9 — ce que les deux contrôles des comparaisons localisées ont en commun :
 * le motif, et la frontière entre le code qui produit et l'interface.
 *
 * `a9-comparaison-localisee.test.ts` garde le code qui produit : aucune
 * comparaison localisée. `a9-studio-langue-declaree.test.ts` garde
 * l'interface : aucun appel qui ne déclare sa langue (version 30). La
 * frontière passe par les fichiers du studio qui alimentent une empreinte ;
 * elle n'est écrite qu'ici, pour que les deux contrôles ne la tracent jamais
 * à deux endroits différents.
 */

export const ROOT = resolve(import.meta.dirname, '..');

/**
 * Toute mention de `localeCompare`, d'`Intl.Collator`, de `toLocaleLowerCase`
 * ou de `toLocaleUpperCase`, code, essais et commentaires confondus : un
 * décompte sans analyse syntaxique ne laisse rien passer.
 */
export const LOCALIZED = /\blocaleCompare\b|\bIntl\s*\.\s*Collator\b|\btoLocale(?:Lower|Upper)Case\b/g;

/** Applications qui produisent une sortie : elles relèvent d'A9 en entier. */
export const PRODUCING_APPS = ['apps/compiler', 'apps/kiosk-runtime'] as const;

/**
 * Fonctions dont la valeur est une empreinte, ou qui en calculent une sur
 * leurs arguments. L'essai « chaque producteur direct est listé » garde cette
 * liste à jour.
 */
export const EMPREINTE_ENTRY_POINTS = new Set([
  'empreinte', 'empreinteOutcome', 'canonicalContentJson', 'computeFaceContentHash',
  'computeGraphHash', 'computeInputsHash', 'computeScheduleInputsHash', 'generateMessageSchedule',
  'resolvedFaceContentHash', 'computeStaleFaces', 'RouteCache',
  'guardFamilyConsistency', 'guardLibraryImport',
  'assembleKioskPackage', 'kioskManifestContentHash',
  'computeRulesPackChecksum', 'rulesPackEmpreinte',
  'siteChecksum', 'stableChecksum',
  'createBuildDeliveryArchiveHandler',
]);

export function countLocalized(source: string): number {
  return source.match(LOCALIZED)?.length ?? 0;
}

export function sources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...sources(path));
    else if (/\.(ts|tsx)$/.test(entry)) found.push(path);
  }
  return found;
}

/** Les noms importés comme valeurs (et non comme types) par un fichier. */
function valueImports(source: string): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s*from/g)) {
    if (match[1] !== undefined) continue;
    for (const part of (match[2] ?? '').split(',')) {
      const name = part.trim();
      if (name === '' || name.startsWith('type ')) continue;
      names.push(name.split(/\s+as\s+/)[0] ?? name);
    }
  }
  return names;
}

export function feedsEmpreinte(source: string): boolean {
  return valueImports(source).some(name => EMPREINTE_ENTRY_POINTS.has(name));
}

/** Les sources du studio, départagées par la frontière d'A9. */
export function studioFiles(): { readonly producing: string[]; readonly interface: string[] } {
  const all = sources(join(ROOT, 'apps', 'studio', 'src'));
  const producing = all.filter(file => feedsEmpreinte(readFileSync(file, 'utf8')));
  return { producing, interface: all.filter(file => !producing.includes(file)) };
}
