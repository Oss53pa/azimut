import { codePointCompare, empreinteOutcome, sha256Binary } from '@azimut/core-model';
import type { Outcome, Finding } from '@azimut/core-model';
import { scanForNetworkDependency } from './scan-network.js';

/**
 * D10.1 / D10.2 — Kiosk package assembler.
 *
 * Lays a validated kiosk deployment tree and produces a conformant manifest:
 *
 *   package/
 *     manifest.json
 *     index.html
 *     assets/app.js, assets/app.css
 *     data/graph.json, data/directory.json, data/scene.json, data/site.json
 *     maps/level-<ordinal>.svg
 *
 * The runtime app assets (index.html, app.js, app.css, embedded fonts) and the
 * generated data/map files are provided as input bytes; this module validates
 * the tree, hashes every file, and builds the manifest. It never fabricates the
 * app itself.
 *
 * `builtAt` is the only non-deterministic field (D10.2): it is excluded from
 * `contentHash`, so two builds of the same content produce the same hash. That
 * is the single documented exception to the determinism invariant (INV-4).
 */

export type KioskManifestFile = {
  readonly path: string;
  readonly sha256: string;
};

export type KioskManifest = {
  readonly siteId: string;
  readonly version: number;
  readonly builtAt: string;
  readonly contentHash: string;
  readonly files: readonly KioskManifestFile[];
  readonly langs: readonly string[];
  readonly minRuntime: string;
};

export type KioskPackageInput = {
  readonly siteId: string;
  readonly version: number;
  readonly builtAt: string;
  readonly langs: readonly string[];
  readonly minRuntime: string;
  /** Tree files keyed by relative path (manifest.json is generated, not here). */
  readonly files: ReadonlyMap<string, Uint8Array>;
};

export type KioskPackage = {
  readonly manifest: KioskManifest;
  /** The full tree, including the generated manifest.json. */
  readonly files: ReadonlyMap<string, Uint8Array>;
};

const REQUIRED_PATHS: readonly string[] = [
  'index.html',
  'assets/app.js',
  'assets/app.css',
  'data/graph.json',
  'data/directory.json',
  'data/scene.json',
  'data/site.json',
];

const LEVEL_MAP_PATTERN = /^maps\/level-\d+\.svg$/;

/** A path is relative and safe: no leading slash, scheme, backslash or "..". */
function isRelativeSafe(path: string): boolean {
  if (path.length === 0) return false;
  if (path.startsWith('/')) return false;
  if (path.includes('\\')) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return false; // scheme:
  return !path.split('/').some((seg) => seg === '..');
}

function missingFileFindings(
  files: ReadonlyMap<string, Uint8Array>,
): Finding[] {
  const findings: Finding[] = [];
  for (const path of REQUIRED_PATHS) {
    if (!files.has(path)) {
      findings.push({
        code: 'PACKAGE.FILE_MISSING',
        severity: 'blocking',
        entity: null,
        params: { path },
        ruleRef: null,
      });
    }
  }
  const hasLevelMap = [...files.keys()].some((p) => LEVEL_MAP_PATTERN.test(p));
  if (!hasLevelMap) {
    findings.push({
      code: 'PACKAGE.FILE_MISSING',
      severity: 'blocking',
      entity: null,
      params: { path: 'maps/level-<ordinal>.svg' },
      ruleRef: null,
    });
  }
  return findings;
}

export function assembleKioskPackage(
  input: KioskPackageInput,
): Outcome<KioskPackage> {
  const blocking: Finding[] = [];

  // 1. Absolute / unsafe path keys (D10.1).
  for (const path of input.files.keys()) {
    if (!isRelativeSafe(path)) {
      blocking.push({
        code: 'PACKAGE.ABSOLUTE_PATH',
        severity: 'blocking',
        entity: null,
        params: { path },
        ruleRef: null,
      });
    }
  }

  // 2. Required tree structure (D10.1).
  blocking.push(...missingFileFindings(input.files));

  // 3. No outbound references / external domains (D10.1, reuse scanner).
  const scan = scanForNetworkDependency(input.files);
  if (!scan.ok) blocking.push(...scan.findings);

  if (blocking.length > 0) return { ok: false, findings: blocking };

  // 4. Hash every file, sorted by path for determinism.
  const sortedPaths = [...input.files.keys()].sort(codePointCompare);
  const manifestFiles: KioskManifestFile[] = sortedPaths.map((path) => ({
    path,
    sha256: sha256Binary(input.files.get(path) as Uint8Array),
  }));

  // 5. contentHash over everything EXCEPT builtAt (D10.2).
  const langs = [...input.langs].sort(codePointCompare);
  const hash = kioskManifestContentHash({
    siteId: input.siteId,
    version: input.version,
    langs,
    minRuntime: input.minRuntime,
    files: manifestFiles,
  });
  if (!hash.ok) return hash;

  const manifest: KioskManifest = {
    siteId: input.siteId,
    version: input.version,
    builtAt: input.builtAt,
    contentHash: hash.value,
    files: manifestFiles,
    langs,
    minRuntime: input.minRuntime,
  };

  const tree = new Map(input.files);
  tree.set('manifest.json', utf8(kioskManifestToJson(manifest)));

  return {
    ok: true,
    value: { manifest, files: tree },
    warnings: scan.ok ? scan.warnings : [],
  };
}

/**
 * D10.2 et D7.2 — l'empreinte d'un manifeste, calculée en un seul endroit :
 * l'assemblage l'écrit, le protocole de mise à jour la recalcule, et les deux
 * passent par ici. Elle porte tout le manifeste sauf `builtAt`, dans la forme
 * canonique commune ; une valeur non hachable est refusée par
 * `DATA.HASH_INPUT_INVALID`.
 *
 * Un paquet construit sous l'ancienne forme ne se convertit pas : son
 * empreinte ne se retrouve plus, et la mise à jour le refuse jusqu'à ce qu'il
 * soit reconstruit (D7.2, « valeurs dérivées »).
 */
export function kioskManifestContentHash(
  manifest: Pick<KioskManifest, 'siteId' | 'version' | 'langs' | 'minRuntime' | 'files'>,
): Outcome<string> {
  return empreinteOutcome({
    siteId: manifest.siteId,
    version: manifest.version,
    langs: [...manifest.langs].sort(codePointCompare),
    minRuntime: manifest.minRuntime,
    files: [...manifest.files]
      .sort((a, b) => codePointCompare(a.path, b.path))
      .map(f => ({ path: f.path, sha256: f.sha256 })),
  }, { kind: 'kiosk_package', id: manifest.siteId });
}

const encoder = new TextEncoder();
function utf8(s: string): Uint8Array {
  return encoder.encode(s);
}

export function kioskManifestToJson(manifest: KioskManifest): string {
  return JSON.stringify(
    {
      siteId: manifest.siteId,
      version: manifest.version,
      builtAt: manifest.builtAt,
      contentHash: manifest.contentHash,
      langs: manifest.langs,
      minRuntime: manifest.minRuntime,
      files: manifest.files.map((f) => ({ path: f.path, sha256: f.sha256 })),
    },
    null,
    2,
  );
}
