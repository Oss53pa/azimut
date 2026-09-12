import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, dirname, sep, posix } from 'node:path';

/**
 * D10 — Storage port for kiosk runtime bundle assets.
 *
 * The kiosk deployment tree mixes two kinds of files: the static runtime app
 * bundle (index.html, assets/app.js, assets/app.css, fonts…) which does not
 * depend on the site, and the per-site data/maps generated in-process. The app
 * bundle lives in storage; this port reads it. It is deliberately minimal and
 * filesystem-satisfiable so an autonomous install needs no cloud object store
 * (A2.4).
 *
 * Paths are tree-relative POSIX paths (e.g. `assets/app.js`), never absolute
 * and never containing `..`.
 */
export interface AssetStore {
  /** Read one asset by its tree-relative path. Rejects if absent. */
  read(path: string): Promise<Uint8Array>;
  /**
   * List the tree-relative paths under a prefix (e.g. `assets/`), recursively.
   * Returns them sorted for determinism.
   */
  list(prefix: string): Promise<readonly string[]>;
}

/** Write side of the storage port: persist package files. */
export interface AssetWriter {
  /** Write one file at its tree-relative path, creating parents as needed. */
  write(path: string, bytes: Uint8Array): Promise<void>;
}

/** A store that can both be read and written. */
export type MutableAssetStore = AssetStore & AssetWriter;

/** A path is tree-relative and safe: no leading slash, backslash, scheme or "..". */
function isRelativeSafe(path: string): boolean {
  if (path.length === 0) return false;
  if (path.startsWith('/')) return false;
  if (path.includes('\\')) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return false;
  return !path.split('/').some((seg) => seg === '..' || seg === '.');
}

function assertSafe(path: string): void {
  if (!isRelativeSafe(path)) {
    throw new Error(`Unsafe asset path: ${path}`);
  }
}

/**
 * In-memory store over a map of tree-relative path → bytes. Used in tests and
 * for callers that already hold the bundle in memory.
 */
export function memoryAssetStore(
  files?: ReadonlyMap<string, Uint8Array>,
): MutableAssetStore {
  const store = new Map<string, Uint8Array>(files);
  return {
    async read(path: string): Promise<Uint8Array> {
      assertSafe(path);
      const bytes = store.get(path);
      if (bytes === undefined) {
        throw new Error(`Asset not found: ${path}`);
      }
      return bytes;
    },
    async list(prefix: string): Promise<readonly string[]> {
      const out: string[] = [];
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) out.push(key);
      }
      out.sort();
      return out;
    },
    async write(path: string, bytes: Uint8Array): Promise<void> {
      assertSafe(path);
      store.set(path, bytes);
    },
  };
}

/** Convert an OS-native relative path to a tree-relative POSIX path. */
function toPosix(relPath: string): string {
  return sep === posix.sep ? relPath : relPath.split(sep).join(posix.sep);
}

/**
 * Filesystem store rooted at a directory. Every read and listing is confined
 * to the root: a resolved path escaping the root is rejected. Suitable for an
 * autonomous, on-premises install.
 */
export function fileSystemAssetStore(rootDir: string): MutableAssetStore {
  async function walk(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const paths: string[] = [];
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        paths.push(...(await walk(abs)));
      } else if (entry.isFile()) {
        paths.push(toPosix(relative(rootDir, abs)));
      }
    }
    return paths;
  }

  return {
    async read(path: string): Promise<Uint8Array> {
      assertSafe(path);
      const buf = await readFile(join(rootDir, path));
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    },
    async list(prefix: string): Promise<readonly string[]> {
      let all: string[];
      try {
        all = await walk(rootDir);
      } catch {
        return [];
      }
      const matched = all.filter((p) => p.startsWith(prefix));
      matched.sort();
      return matched;
    },
    async write(path: string, bytes: Uint8Array): Promise<void> {
      assertSafe(path);
      const abs = join(rootDir, path);
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, bytes);
    },
  };
}
