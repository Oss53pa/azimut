import type { Finding, Outcome } from '@azimut/core-model';

/**
 * H4.6 — On reception, an advertiser's creative is checked automatically
 * against the technical sheet (H4.2, generated not hand-written): file format,
 * resolution, safe zone, colour profile, and weight. Any divergence raises a
 * blocking AD.CREATIVE_SPEC_MISMATCH. The declarative controls (site rules,
 * forbidden content, legal mentions) are a human step and are not enforced
 * here. Application-layer guard for module 5 (régie).
 */
export type CreativeSpec = {
  /** Required file format, e.g. 'pdf', 'svg'. */
  readonly format: string;
  readonly min_resolution_dpi: number;
  /** Minimum safe zone the creative must preserve, in millimetres. */
  readonly safe_zone_mm: number;
  readonly color_profile: string;
  readonly max_weight_bytes: number;
};

export type Creative = {
  readonly id: string;
  readonly format: string;
  readonly resolution_dpi: number;
  readonly safe_zone_mm: number;
  readonly color_profile: string;
  readonly weight_bytes: number;
};

// Fixed evaluation order so findings are deterministic.
const AXES: readonly {
  readonly axis: string;
  readonly fails: (c: Creative, s: CreativeSpec) => boolean;
}[] = [
  { axis: 'format', fails: (c, s) => c.format !== s.format },
  { axis: 'resolution', fails: (c, s) => c.resolution_dpi < s.min_resolution_dpi },
  { axis: 'safe_zone', fails: (c, s) => c.safe_zone_mm < s.safe_zone_mm },
  { axis: 'color_profile', fails: (c, s) => c.color_profile !== s.color_profile },
  { axis: 'weight', fails: (c, s) => c.weight_bytes > s.max_weight_bytes },
];

/**
 * Control a creative against its technical sheet. Returns one blocking
 * AD.CREATIVE_SPEC_MISMATCH per failing axis, in the fixed order format >
 * resolution > safe_zone > color_profile > weight; ok when the creative
 * conforms on every axis.
 */
export function guardCreativeAgainstSpec(
  creative: Creative,
  spec: CreativeSpec,
): Outcome<null> {
  const findings: Finding[] = [];

  for (const { axis, fails } of AXES) {
    if (fails(creative, spec)) {
      findings.push({
        code: 'AD.CREATIVE_SPEC_MISMATCH',
        severity: 'blocking',
        entity: { kind: 'creative', id: creative.id },
        params: { axis },
        ruleRef: 'H4.6',
      });
    }
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}
