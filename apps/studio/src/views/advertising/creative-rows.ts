/**
 * H4.6 — les lignes des visuels : ceux que la base a enregistrés, et ceux qui
 * attendent en réception.
 *
 * Un visuel enregistré a été assaini à sa réception (M05.R5, partie N) : son état se
 * lit, il ne se recalcule pas, et son fichier n'est pas chargé ici. Un visuel
 * en réception passe par `receiveCreatives`, que l'écran appelle lui-même, et
 * son constat est rangé ici à côté. La conformité à la fiche technique ne se
 * contrôle que si une fiche existe.
 */
import type { AdCreative, AdCreativeVerdict, AdSanitationState, Finding } from '@azimut/core-model';
import { guardCreativeAgainstSpec, type Creative, type CreativeSpec } from '../../domain/ad-creative-control.js';
import type { CreativeIntake } from '../../domain/ad-creative-intake.js';
import type { ReceivedCreative } from '../../data/index.js';

export type CreativeRow = {
  readonly creative: Creative;
  readonly placement_id: string;
  readonly verdict: AdCreativeVerdict;
  readonly origin: 'stored' | 'received';
  readonly sanitation: AdSanitationState;
  readonly renderable: boolean;
  readonly clean_svg?: string | undefined;
  readonly findings: readonly Finding[];
  /** Écarts à la fiche technique, ou `null` quand aucune fiche n'existe. */
  readonly mismatches: number | null;
};

const MISMATCH = 'AD.CREATIVE_SPEC_MISMATCH';

function stored(c: AdCreative, spec: CreativeSpec | null): CreativeRow {
  const creative: Creative = {
    id: c.id, format: c.format, resolution_dpi: c.resolution_dpi, safe_zone_mm: c.safe_zone_mm,
    color_profile: c.color_profile, weight_bytes: c.weight_bytes,
  };
  const checked = spec === null ? null : guardCreativeAgainstSpec(creative, spec);
  const findings = checked === null ? [] : checked.ok ? checked.warnings : checked.findings;
  return {
    creative, placement_id: c.placement_id, verdict: c.verdict, origin: 'stored', sanitation: c.sanitation,
    // Le fichier enregistré n'est pas chargé : rien ne se rend depuis ici.
    renderable: false,
    findings,
    mismatches: spec === null ? null : findings.filter(f => f.code === MISMATCH).length,
  };
}

function received(r: ReceivedCreative, intake: CreativeIntake | undefined, spec: CreativeSpec | null): CreativeRow {
  // Sans constat de réception, le visuel n'est pas assaini : il ne se rend pas.
  const findings = intake?.findings ?? [];
  return {
    creative: r.creative, placement_id: r.placement_id, verdict: r.verdict, origin: 'received',
    sanitation: intake?.sanitation ?? 'deferred',
    renderable: intake?.renderable ?? false,
    clean_svg: intake?.clean_svg,
    findings,
    mismatches: spec === null ? null : findings.filter(f => f.code === MISMATCH).length,
  };
}

/** Enregistrés puis reçus, chacun par identifiant. */
export function creativeRows(
  storedCreatives: readonly AdCreative[],
  reception: readonly ReceivedCreative[],
  intakes: readonly CreativeIntake[],
  spec: CreativeSpec | null,
): readonly CreativeRow[] {
  const byId = new Map(intakes.map(i => [i.creative_id, i]));
  return [
    ...storedCreatives.map(c => stored(c, spec)),
    ...reception.map(r => received(r, byId.get(r.creative.id), spec)),
  ].sort((a, b) => a.creative.id.localeCompare(b.creative.id));
}
