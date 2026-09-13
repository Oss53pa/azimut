import type { Finding, Outcome } from './outcome.js';

/**
 * G5.2 — Font registry and embedding rules.
 *
 * A font may always be used for on-screen preview, but embedding it in a
 * distributed deliverable is gated: the licence must be known, the asset must
 * be marked embeddable, and a kiosk package additionally requires a licence
 * reference. A deliverable produced with a non-embeddable font raises a
 * blocking anomaly (FONT.NOT_EMBEDDABLE, G8).
 */
export type FontLicenceKind =
  | 'open'
  | 'purchased'
  | 'client_supplied'
  | 'unknown';

export type FontAsset = {
  readonly id: string;
  readonly family: string;
  readonly style: string;
  readonly weight: number;
  readonly embeddable: boolean;
  readonly licence_kind: FontLicenceKind;
  readonly licence_ref: string | null;
};

/**
 * Where the fonts are headed. `screen_preview` never distributes, so any font
 * is allowed; the other two are distributed deliverables and are gated.
 */
export type EmbeddingTarget = 'screen_preview' | 'distributed' | 'kiosk_package';

function reasonFor(font: FontAsset, target: EmbeddingTarget): string | null {
  if (!font.embeddable) return 'not_embeddable';
  if (font.licence_kind === 'unknown') return 'licence_unknown';
  // A kiosk package must carry an explicit licence reference (G5.2).
  if (target === 'kiosk_package' && (font.licence_ref ?? '').trim() === '') {
    return 'licence_ref_missing';
  }
  return null;
}

/**
 * Guard the embedding of fonts into a deliverable. Returns a blocking finding
 * per font that may not be embedded for the given target; ok when all pass.
 * `screen_preview` is always ok.
 */
export function guardFontEmbedding(
  fonts: readonly FontAsset[],
  target: EmbeddingTarget,
): Outcome<null> {
  if (target === 'screen_preview') {
    return { ok: true, value: null, warnings: [] };
  }

  const findings: Finding[] = [];
  const sorted = [...fonts].sort((a, b) => a.id.localeCompare(b.id));
  for (const font of sorted) {
    const reason = reasonFor(font, target);
    if (reason !== null) {
      findings.push({
        code: 'FONT.NOT_EMBEDDABLE',
        severity: 'blocking',
        entity: { kind: 'font', id: font.id },
        params: { family: font.family, target, reason },
        ruleRef: 'G5.2',
      });
    }
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}
