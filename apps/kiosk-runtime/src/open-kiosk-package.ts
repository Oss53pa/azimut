import { z } from 'zod';
import type { Finding, Outcome } from '@azimut/core-model';
import { verifyAgainstManifest } from '@azimut/engine-package';
import type { KioskManifest } from '@azimut/engine-package';
import { loadKioskSite, KIOSK_DATA_FILES } from './load-kiosk-site.js';
import type { KioskSite } from './load-kiosk-site.js';

/**
 * Lot 10 de l'audit (A7.5, D10.2, D-11) : la borne n'ouvre un paquet qu'après
 * en avoir vérifié l'empreinte.
 *
 * Le manifeste est lu par un schéma strict, puis chaque fichier qu'il nomme
 * est confronté à son empreinte, et l'empreinte du manifeste lui-même est
 * recalculée (`verifyAgainstManifest`, D10.4). Les fichiers de données que la
 * borne lit doivent figurer au manifeste : un fichier qu'il ne nomme pas n'est
 * couvert par aucune empreinte. Rien n'est lu du site avant que tout cela
 * tienne ; un seul écart, et le paquet est refusé.
 *
 * L'empreinte prouve que le paquet est celui que son manifeste décrit, et rien
 * de plus : D-11 retient l'empreinte seule, sans signature, conformément au
 * cahier.
 */
const MANIFEST_PATH = 'manifest.json';

const manifestSchema = z.object({
  siteId: z.string().min(1),
  version: z.number().int().nonnegative(),
  builtAt: z.string().min(1),
  contentHash: z.string().min(1),
  files: z.array(z.object({ path: z.string().min(1), sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict()),
  langs: z.array(z.string().min(1)),
  minRuntime: z.string().regex(/^\d+\.\d+\.\d+$/),
}).strict();

function refused(code: string, params: Record<string, string>): Outcome<never> {
  const finding: Finding = { code, severity: 'blocking', entity: null, params, ruleRef: 'D10.4' };
  return { ok: false, findings: [finding] };
}

export function openKioskPackage(files: ReadonlyMap<string, Uint8Array>): Outcome<KioskSite> {
  const bytes = files.get(MANIFEST_PATH);
  if (bytes === undefined) return refused('PACKAGE.FILE_MISSING', { path: MANIFEST_PATH });

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return refused('PACKAGE.CHECKSUM_MISMATCH', { reason: 'manifest unreadable' });
  }
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) return refused('PACKAGE.CHECKSUM_MISMATCH', { reason: 'manifest malformed' });
  const manifest: KioskManifest = parsed.data;

  const listed = new Set(manifest.files.map(f => f.path));
  const unlisted = KIOSK_DATA_FILES.find(path => !listed.has(path));
  if (unlisted !== undefined) return refused('PACKAGE.INTEGRITY_MISMATCH', { path: unlisted, reason: 'unlisted' });

  const verified = verifyAgainstManifest(manifest, files);
  if (!verified.ok) return verified;

  return { ok: true, value: loadKioskSite(files), warnings: [] };
}
