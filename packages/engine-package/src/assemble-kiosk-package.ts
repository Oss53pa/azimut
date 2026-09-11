import { sha256Binary, contentHash } from '@azimut/core-model';
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
 *     data/graph.json, data/directory.json, data/scene.json
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
  const sortedPaths = [...input.files.keys()].sort();
  const manifestFiles: KioskManifestFile[] = sortedPaths.map((path) => ({
    path,
    sha256: sha256Binary(input.files.get(path) as Uint8Array),
  }));

  // 5. contentHash over everything EXCEPT builtAt (D10.2).
  const hash = contentHash({
    siteId: input.siteId,
    version: input.version,
    langs: [...input.langs].sort(),
    minRuntime: input.minRuntime,
    files: manifestFiles,
  });

  const manifest: KioskManifest = {
    siteId: input.siteId,
    version: input.version,
    builtAt: input.builtAt,
    contentHash: `sha256:${hash}`,
    files: manifestFiles,
    langs: [...input.langs].sort(),
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
