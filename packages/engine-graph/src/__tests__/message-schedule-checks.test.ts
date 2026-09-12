import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import type { SiteData, TravelProfile } from '@azimut/core-model';
import type { PlacedSupport } from '../compute-quantities.js';
import { NO_WAYFINDING_RULES } from '../message-schedule.js';
import type { MessageSchedule, TypologyInformationLevels } from '../message-schedule.js';
import { generateMessageSchedule } from '../message-schedule-generate.js';
import { checkMessageSchedule, refreshStaleFlags } from '../message-schedule-checks.js';

const SITE = refMultilevel;
const GENERATED_AT = '2026-04-01T00:00:00.000Z';

function profile(): TravelProfile {
  const found = SITE.travel_profiles.find(p => p.key === 'standard');
  if (found === undefined) throw new Error('profil standard absent');
  return found;
}

const SUPPORTS: readonly PlacedSupport[] = [
  { id: 'sup-1', node_id: 'n-ml-hall', support_type_key: 'directional' },
];

const LEVELS: readonly TypologyInformationLevels[] = [
  { support_type_key: 'directional', levels: [2] },
];

function build(site: SiteData = SITE, levels = LEVELS): MessageSchedule {
  const outcome = generateMessageSchedule({
    site,
    supports: SUPPORTS,
    profile: profile(),
    informationLevels: levels,
    rules: NO_WAYFINDING_RULES,
    version: 1,
    generated_at: GENERATED_AT,
  });
  if (!outcome.ok) throw new Error('génération échouée');
  return outcome.value;
}

// ---------------------------------------------------------------------------
// Péremption
// ---------------------------------------------------------------------------

describe('H2.5 — péremption des lignes', () => {
  it('ne périme rien quand les données n’ont pas changé', () => {
    const stored = build();
    const diff = refreshStaleFlags(stored, build());
    expect(diff.changedIds).toEqual([]);
    expect(diff.removedIds).toEqual([]);
    expect(diff.addedIds).toEqual([]);
    expect(diff.schedule.lines.every(l => !l.stale)).toBe(true);
  });

  it('périme la seule ligne concernée par un changement d’annuaire', () => {
    const stored = build();
    const renamed: SiteData = {
      ...SITE,
      destination_names: SITE.destination_names.map((n, i) =>
        i === 0 ? { ...n, value: `${n.value} modifié` } : n,
      ),
    };
    const diff = refreshStaleFlags(stored, build(renamed));

    expect(diff.changedIds).toHaveLength(1);
    const stale = diff.schedule.lines.filter(l => l.stale);
    expect(stale).toHaveLength(1);
    expect(stale[0]?.block_kind).toBe('destination_list');
    // Le bloc d'en-tête, lui, n'est pas concerné.
    const header = diff.schedule.lines.find(l => l.block_kind === 'header');
    expect(header?.stale).toBe(false);
  });

  it('périme une ligne que les données ne produisent plus', () => {
    const stored = build();
    const empty: MessageSchedule = { ...stored, lines: [] };
    const diff = refreshStaleFlags(stored, empty);
    expect(diff.removedIds).toHaveLength(stored.lines.length);
    expect(diff.schedule.lines.every(l => l.stale)).toBe(true);
  });

  it('signale les lignes nouvelles sans les ajouter au tableau enregistré', () => {
    const stored: MessageSchedule = { ...build(), lines: [] };
    const diff = refreshStaleFlags(stored, build());
    expect(diff.addedIds).toHaveLength(2);
    expect(diff.schedule.lines).toHaveLength(0);
  });

  it('relève un drapeau de péremption devenu injustifié', () => {
    const fresh = build();
    const storedStale: MessageSchedule = {
      ...fresh,
      lines: fresh.lines.map(l => ({ ...l, stale: true })),
    };
    const diff = refreshStaleFlags(storedStale, fresh);
    expect(diff.schedule.lines.every(l => !l.stale)).toBe(true);
  });

  it('ne modifie pas le tableau reçu', () => {
    const stored = build();
    const before = JSON.stringify(stored);
    refreshStaleFlags(stored, { ...stored, lines: [] });
    expect(JSON.stringify(stored)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Contrôles
// ---------------------------------------------------------------------------

describe('H2.6 — contrôles du tableau', () => {
  it('ne contrôle pas le nombre de destinations quand le principe est absent', () => {
    const codes = checkMessageSchedule(build(), NO_WAYFINDING_RULES).map(f => f.code);
    expect(codes).not.toContain('WAYFIND.TOO_MANY_DESTINATIONS');
  });

  it('refuse une face dépassant le nombre déclaré de destinations', () => {
    const findings = checkMessageSchedule(build(), { max_destinations_per_face: 1 });
    const tooMany = findings.filter(f => f.code === 'WAYFIND.TOO_MANY_DESTINATIONS');
    expect(tooMany).toHaveLength(1);
    expect(tooMany[0]?.severity).toBe('blocking');
    expect(tooMany[0]?.params['max']).toBe(1);
    expect(Number(tooMany[0]?.params['count'])).toBeGreaterThan(1);
  });

  it('accepte une face au nombre exact déclaré', () => {
    const schedule = build();
    const count = schedule.lines
      .filter(l => l.block_kind === 'destination_list')
      .reduce((sum, l) => sum + l.entries.length, 0);
    const findings = checkMessageSchedule(schedule, { max_destinations_per_face: count });
    expect(findings.map(f => f.code)).not.toContain('WAYFIND.TOO_MANY_DESTINATIONS');
  });

  it('refuse un support rattaché à aucun niveau d’information', () => {
    const findings = checkMessageSchedule(build(SITE, []), NO_WAYFINDING_RULES);
    const noLevel = findings.filter(f => f.code === 'WAYFIND.NO_INFORMATION_LEVEL');
    expect(noLevel).toHaveLength(1);
    expect(noLevel[0]?.severity).toBe('blocking');
    expect(noLevel[0]?.entity).toEqual({ kind: 'support', id: 'sup-1' });
  });

  it('ne signale le niveau manquant qu’une fois par support, pas par ligne', () => {
    const schedule = build(SITE, []);
    expect(schedule.lines.length).toBeGreaterThan(1);
    const findings = checkMessageSchedule(schedule, NO_WAYFINDING_RULES);
    expect(findings.filter(f => f.code === 'WAYFIND.NO_INFORMATION_LEVEL')).toHaveLength(1);
  });

  it('signale chaque ligne périmée', () => {
    const fresh = build();
    const stale: MessageSchedule = {
      ...fresh,
      lines: fresh.lines.map(l => ({ ...l, stale: true })),
    };
    const findings = checkMessageSchedule(stale, NO_WAYFINDING_RULES)
      .filter(f => f.code === 'WAYFIND.SCHEDULE_STALE');
    expect(findings).toHaveLength(fresh.lines.length);
    expect(findings[0]?.severity).toBe('warning');
  });

  it('ne signale aucune péremption sur un tableau à jour', () => {
    const codes = checkMessageSchedule(build(), NO_WAYFINDING_RULES).map(f => f.code);
    expect(codes).not.toContain('WAYFIND.SCHEDULE_STALE');
  });

  it('rend des anomalies dans un ordre déterministe', () => {
    const schedule = build(SITE, []);
    const a = checkMessageSchedule(schedule, { max_destinations_per_face: 1 });
    const b = checkMessageSchedule(schedule, { max_destinations_per_face: 1 });
    expect(a).toEqual(b);
  });
});
