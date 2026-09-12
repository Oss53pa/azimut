import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import type { TravelProfile } from '@azimut/core-model';
import type { PlacedSupport } from '../compute-quantities.js';
import { NO_WAYFINDING_RULES } from '../message-schedule.js';
import type { MessageSchedule } from '../message-schedule.js';
import { generateMessageSchedule } from '../message-schedule-generate.js';
import {
  messageScheduleToCsv,
  messageScheduleToMarkdown,
} from '../message-schedule-export.js';

const SITE = refMultilevel;

function profile(): TravelProfile {
  const found = SITE.travel_profiles.find(p => p.key === 'standard');
  if (found === undefined) throw new Error('profil standard absent');
  return found;
}

const SUPPORTS: readonly PlacedSupport[] = [
  { id: 'sup-1', node_id: 'n-ml-hall', support_type_key: 'directional' },
];

function build(): MessageSchedule {
  const outcome = generateMessageSchedule({
    site: SITE,
    supports: SUPPORTS,
    profile: profile(),
    informationLevels: [{ support_type_key: 'directional', levels: [2] }],
    rules: NO_WAYFINDING_RULES,
    version: 3,
    generated_at: '2026-04-01T00:00:00.000Z',
  });
  if (!outcome.ok) throw new Error('génération échouée');
  return outcome.value;
}

describe('H2.5 — export en tableur', () => {
  it('porte un en-tête nommé', () => {
    const header = messageScheduleToCsv(build()).split('\n')[0] ?? '';
    expect(header).toContain('Identifiant');
    expect(header).toContain('Niveau d’information');
    expect(header).toContain('Point de décision');
    expect(header.split(';')).toHaveLength(13);
  });

  it('développe une ligne par mention, pas par bloc', () => {
    const schedule = build();
    const entryCount = schedule.lines.reduce(
      (sum, l) => sum + Math.max(1, l.entries.length), 0,
    );
    const rows = messageScheduleToCsv(schedule).split('\n').slice(1);
    expect(rows).toHaveLength(entryCount);
  });

  it('reporte l’identifiant stable sur chaque mention du même bloc', () => {
    const schedule = build();
    const rows = messageScheduleToCsv(schedule).split('\n').slice(1);
    const listRows = rows.filter(r => r.includes('destination_list'));
    expect(listRows.length).toBeGreaterThan(1);
    const ids = new Set(listRows.map(r => r.split(';')[0]));
    expect(ids.size).toBe(1);
  });

  it('rend les deux langues', () => {
    const rows = messageScheduleToCsv(build()).split('\n').slice(1);
    const listRow = rows.find(r => r.includes('destination_list'));
    const cells = listRow?.split(';') ?? [];
    expect(cells[10]).toBeTruthy();
    expect(cells[11]).toBeTruthy();
    expect(cells[10]).not.toBe(cells[11]);
  });

  it('échappe un texte contenant le séparateur', () => {
    const schedule = build();
    const doctored: MessageSchedule = {
      ...schedule,
      lines: schedule.lines.map(l => ({
        ...l,
        entries: l.entries.map(e => ({
          ...e,
          text: { ...e.text, fr: 'Boutique; Étage "1"' },
        })),
      })),
    };
    const csv = messageScheduleToCsv(doctored);
    expect(csv).toContain('"Boutique; Étage ""1"""');
  });

  it('produit une ligne même pour un bloc sans texte', () => {
    const schedule = build();
    const pictoOnly: MessageSchedule = {
      ...schedule,
      lines: [{
        id: 'sup-1#0#0',
        support_id: 'sup-1',
        face_index: 0,
        block_index: 0,
        block_kind: 'pictogram',
        entries: [],
        pictogram_id: 'picto-1',
        direction: null,
        information_level: 2,
        decision_point_id: null,
        stale: false,
      }],
    };
    const rows = messageScheduleToCsv(pictoOnly).split('\n').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('pictogram');
  });

  it('note la péremption dans la langue demandée', () => {
    const schedule = build();
    const stale: MessageSchedule = {
      ...schedule,
      lines: schedule.lines.map(l => ({ ...l, stale: true })),
    };
    expect(messageScheduleToCsv(stale, 'fr')).toContain('OUI');
    expect(messageScheduleToCsv(stale, 'en')).toContain('YES');
  });

  it('est déterministe (invariant 4)', () => {
    expect(messageScheduleToCsv(build())).toBe(messageScheduleToCsv(build()));
  });
});

describe('H2.5 — export en document', () => {
  it('porte un en-tête traçable', () => {
    const doc = messageScheduleToMarkdown(build());
    expect(doc).toContain('# Tableau des messages');
    expect(doc).toContain('Version : 3');
    expect(doc).toContain('État : pending');
    expect(doc).toContain('Généré le : 2026-04-01T00:00:00.000Z');
    expect(doc).toContain('Empreinte des entrées : ');
  });

  it('rend un tableau markdown avec une ligne d’en-tête et un séparateur', () => {
    const lines = messageScheduleToMarkdown(build()).split('\n');
    const headerIndex = lines.findIndex(l => l.startsWith('| Identifiant'));
    expect(headerIndex).toBeGreaterThan(-1);
    expect(lines[headerIndex + 1]).toMatch(/^\| ---/);
  });

  it('échappe la barre verticale dans un texte', () => {
    const schedule = build();
    const doctored: MessageSchedule = {
      ...schedule,
      lines: schedule.lines.map(l => ({
        ...l,
        entries: l.entries.map(e => ({ ...e, text: { ...e.text, fr: 'A | B' } })),
      })),
    };
    expect(messageScheduleToMarkdown(doctored)).toContain('A \\| B');
  });

  it('traduit son en-tête', () => {
    const doc = messageScheduleToMarkdown(build(), 'en');
    expect(doc).toContain('# Message schedule');
    expect(doc).toContain('Inputs hash : ');
  });

  it('est déterministe (invariant 4)', () => {
    expect(messageScheduleToMarkdown(build())).toBe(messageScheduleToMarkdown(build()));
  });
});
