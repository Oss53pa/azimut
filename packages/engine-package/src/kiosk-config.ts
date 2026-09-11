import type { Outcome, Finding } from '@azimut/core-model';

/**
 * D10.3 — Kiosk local configuration.
 *
 * A file separate from the package, never recompiled with it. A single package
 * serves every kiosk of a site; each kiosk carries its own position node,
 * facing azimuth, default language and building. The kiosk computes its own
 * position marker and orients the wall plan per D6 from this config.
 */
export type KioskLocalConfig = {
  readonly kioskId: string;
  readonly nodeId: string;
  readonly azimuthDeg: number;
  readonly defaultLang: string;
  readonly buildingId: string;
};

function invalid(field: string, reason: string): Finding {
  return {
    code: 'DATA.KIOSK_CONFIG_INVALID',
    severity: 'blocking',
    entity: null,
    params: { field, reason },
    ruleRef: null,
  };
}

function requireString(
  obj: Record<string, unknown>,
  field: string,
  findings: Finding[],
): string {
  const v = obj[field];
  if (typeof v !== 'string' || v.length === 0) {
    findings.push(invalid(field, 'must be a non-empty string'));
    return '';
  }
  return v;
}

/**
 * Parse and validate a kiosk local configuration. Never falls back to defaults
 * for missing identifiers; azimuth is validated against the compass domain
 * [0, 360) (D1.3).
 */
export function parseKioskConfig(raw: unknown): Outcome<KioskLocalConfig> {
  const findings: Finding[] = [];

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, findings: [invalid('<root>', 'must be an object')] };
  }
  const obj = raw as Record<string, unknown>;

  const kioskId = requireString(obj, 'kioskId', findings);
  const nodeId = requireString(obj, 'nodeId', findings);
  const defaultLang = requireString(obj, 'defaultLang', findings);
  const buildingId = requireString(obj, 'buildingId', findings);

  const azimuthRaw = obj['azimuthDeg'];
  let azimuthDeg = 0;
  if (typeof azimuthRaw !== 'number' || !Number.isFinite(azimuthRaw)) {
    findings.push(invalid('azimuthDeg', 'must be a finite number'));
  } else if (azimuthRaw < 0 || azimuthRaw >= 360) {
    findings.push(invalid('azimuthDeg', 'must be in [0, 360) (D1.3)'));
  } else {
    azimuthDeg = azimuthRaw;
  }

  if (findings.length > 0) return { ok: false, findings };

  return {
    ok: true,
    value: { kioskId, nodeId, azimuthDeg, defaultLang, buildingId },
    warnings: [],
  };
}
