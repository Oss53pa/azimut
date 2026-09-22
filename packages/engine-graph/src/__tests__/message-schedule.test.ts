import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import type { SiteData, TravelProfile } from '@azimut/core-model';
import type { PlacedSupport } from '../compute-quantities.js';
import { resolveFaceContent } from '../resolve-face.js';
import {
  INFORMATION_LEVELS,
  NO_WAYFINDING_RULES,
  computeScheduleInputsHash,
  isInformationLevel,
  messageLineId,
  reduceInformationLevel,
} from '../message-schedule.js';
import type {
  MessageSchedule,
  TypologyInformationLevels,
  WayfindingRules,
} from '../message-schedule.js';
import { generateMessageSchedule } from '../message-schedule-generate.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SITE = refMultilevel;
const GENERATED_AT = '2026-04-01T00:00:00.000Z';

function profile(key = 'standard'): TravelProfile {
  const found = SITE.travel_profiles.find(p => p.key === key);
  if (found === undefined) throw new Error(`profil ${key} absent du site de référence`);
  return found;
}

const SUPPORTS: readonly PlacedSupport[] = [
  { id: 'sup-1', node_id: 'n-ml-hall', support_type_key: 'directional' },
];

const LEVELS: readonly TypologyInformationLevels[] = [
  { support_type_key: 'directional', levels: [2, 3] },
];

function generate(over: Partial<{
  site: SiteData;
  supports: readonly PlacedSupport[];
  informationLevels: readonly TypologyInformationLevels[];
  rules: WayfindingRules;
  version: number;
  generated_at: string;
}> = {}) {
  return generateMessageSchedule({
    site: over.site ?? SITE,
    supports: over.supports ?? SUPPORTS,
    profile: profile(),
    informationLevels: over.informationLevels ?? LEVELS,
    rules: over.rules ?? NO_WAYFINDING_RULES,
    version: over.version ?? 1,
    generated_at: over.generated_at ?? GENERATED_AT,
  });
}

function scheduleOrThrow(over = {}): MessageSchedule {
  const outcome = generate(over);
  if (!outcome.ok) throw new Error('génération échouée');
  return outcome.value;
}

// ---------------------------------------------------------------------------
// Niveaux d'information
// ---------------------------------------------------------------------------

describe('H2.3 — niveaux d’information', () => {
  it('en déclare quatre, du plus général au plus spécifique', () => {
    expect(INFORMATION_LEVELS).toEqual([1, 2, 3, 4]);
  });

  it('n’accepte que ces quatre valeurs', () => {
    expect(isInformationLevel(1)).toBe(true);
    expect(isInformationLevel(4)).toBe(true);
    expect(isInformationLevel(0)).toBe(false);
    expect(isInformationLevel(5)).toBe(false);
  });

  it('réduit plusieurs niveaux déclarés au plus général', () => {
    expect(reduceInformationLevel([3, 2])).toBe(2);
    expect(reduceInformationLevel([4])).toBe(4);
  });

  it('ne rend aucun niveau quand rien n’est déclaré', () => {
    expect(reduceInformationLevel([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Génération
// ---------------------------------------------------------------------------

describe('H2.5 — génération du tableau des messages', () => {
  it('produit une ligne par bloc de chaque face', () => {
    const schedule = scheduleOrThrow();
    // Le gabarit de référence porte deux blocs : header et destination_list.
    expect(schedule.lines).toHaveLength(2);
    expect(schedule.lines.map(l => l.block_kind)).toEqual(['header', 'destination_list']);
  });

  it('donne à chaque ligne un identifiant stable dérivé de sa position', () => {
    const schedule = scheduleOrThrow();
    expect(schedule.lines[0]?.id).toBe(messageLineId('sup-1', 0, 0));
    expect(schedule.lines[1]?.id).toBe(messageLineId('sup-1', 0, 1));
  });

  it('entre dans le circuit de validation des bons à tirer', () => {
    expect(scheduleOrThrow().state).toBe('pending');
  });

  it('reprend l’horodatage de l’appelant, sans lire d’horloge', () => {
    const stamp = '2030-12-25T11:22:33.000Z';
    expect(scheduleOrThrow({ generated_at: stamp }).generated_at).toBe(stamp);
  });

  it('porte la version fournie', () => {
    expect(scheduleOrThrow({ version: 7 }).version).toBe(7);
  });

  it('est déterministe : deux générations identiques (invariant 4)', () => {
    expect(scheduleOrThrow()).toEqual(scheduleOrThrow());
  });

  it('résout les destinations dans les deux langues', () => {
    const line = scheduleOrThrow().lines.find(l => l.block_kind === 'destination_list');
    expect(line).toBeDefined();
    expect(line?.entries.length).toBeGreaterThan(0);
    const first = line?.entries[0];
    expect(first?.text['fr']).toBeTruthy();
    expect(first?.text['en']).toBeTruthy();
    expect(first?.destination_id).toBeTruthy();
  });

  it('porte le niveau d’information de la typologie', () => {
    for (const line of scheduleOrThrow().lines) {
      expect(line.information_level).toBe(2);
    }
  });

  it('ne porte aucun niveau quand la typologie n’en déclare pas', () => {
    const schedule = scheduleOrThrow({ informationLevels: [] });
    for (const line of schedule.lines) {
      expect(line.information_level).toBeNull();
    }
  });

  it('rattache la ligne au point de décision quand le support y est posé', () => {
    const schedule = scheduleOrThrow();
    // n-ml-hall est un carrefour du site de référence.
    expect(schedule.lines[0]?.decision_point_id).toBe('n-ml-hall');
  });

  it('M02.W4 — ne crée aucune ligne pour un support hors point de décision', () => {
    const outcome = generate({
      supports: [{ id: 'sup-x', node_id: 'n-ml-entrance', support_type_key: 'directional' }],
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // N2.7-4 : une ligne sans point de décision ne peut pas être créée.
    expect(outcome.value.lines).toHaveLength(0);

    const unjustified = outcome.warnings.filter(w => w.code === 'WAYFIND.LINE_UNJUSTIFIED');
    expect(unjustified).toHaveLength(1);
    expect(unjustified[0]?.severity).toBe('blocking');
    expect(unjustified[0]?.entity).toEqual({ kind: 'support', id: 'sup-x' });
    expect(unjustified[0]?.params['node_id']).toBe('n-ml-entrance');
    expect(unjustified[0]?.ruleRef).toBe('N2.4');
  });

  it('M02.W4 — un nœud absent du graphe garde sa cause propre, pas « ligne non justifiée »', () => {
    // Un nœud inconnu n'est pas un point de décision, mais le dire ainsi
    // ferait chercher au mauvais endroit : la résolution de contenu nomme la
    // vraie faute, et c'est elle qui doit remonter.
    const outcome = generate({
      supports: [{ id: 'sup-x', node_id: 'n-inexistant', support_type_key: 'directional' }],
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.value.lines).toHaveLength(0);
    const codes = outcome.warnings.map(w => w.code);
    expect(codes).toContain('GRAPH.RESOLVE_NODE_NOT_FOUND');
    expect(codes).not.toContain('WAYFIND.LINE_UNJUSTIFIED');
  });

  it('M02.W4 — toute ligne produite porte son point de décision', () => {
    const schedule = scheduleOrThrow();
    expect(schedule.lines.length).toBeGreaterThan(0);
    for (const line of schedule.lines) {
      expect(line.decision_point_id.length).toBeGreaterThan(0);
    }
  });

  it('M02.W4 — le support justifié produit ses lignes, celui qui ne l\u2019est pas non', () => {
    const outcome = generate({
      supports: [
        { id: 'sup-ok', node_id: 'n-ml-hall', support_type_key: 'directional' },
        { id: 'sup-ko', node_id: 'n-ml-entrance', support_type_key: 'directional' },
      ],
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    // Ni plus, ni moins : seul le support hors point de décision est écarté.
    expect(new Set(outcome.value.lines.map(l => l.support_id))).toEqual(new Set(['sup-ok']));
    expect(outcome.warnings.filter(w => w.code === 'WAYFIND.LINE_UNJUSTIFIED'))
      .toHaveLength(1);
  });

  it('n’invente aucune ligne pour une typologie inconnue', () => {
    const outcome = generate({
      supports: [{ id: 'sup-bad', node_id: 'n-ml-hall', support_type_key: 'inexistante' }],
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.lines).toHaveLength(0);
    expect(outcome.warnings.map(w => w.code)).toContain('WAYFIND.SUPPORT_TYPE_UNKNOWN');
  });

  it('signale une face sans gabarit plutôt que de la passer sous silence', () => {
    const siteSansGabarit: SiteData = { ...SITE, face_templates: [] };
    const outcome = generate({ site: siteSansGabarit });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.lines).toHaveLength(0);
    expect(outcome.warnings.map(w => w.code)).toContain('WAYFIND.FACE_TEMPLATE_MISSING');
  });

  it('produit le même contenu que la résolution de face (invariant 1)', () => {
    const template = SITE.face_templates.find(
      t => t.support_type_key === 'directional' && t.side === 'front',
    );
    if (template === undefined) throw new Error('gabarit de référence absent');

    const direct = resolveFaceContent(SITE, template, 'n-ml-hall', profile());
    expect(direct.ok).toBe(true);
    if (!direct.ok) return;

    const line = scheduleOrThrow().lines.find(l => l.block_kind === 'destination_list');
    const block = direct.value.blocks.find(b => b.kind === 'destination_list');
    expect(block?.content.type).toBe('destination_list');
    if (block?.content.type !== 'destination_list') return;

    expect(line?.entries.map(e => e.destination_id))
      .toEqual(block.content.entries.map(e => e.destination_id));
  });

  it('trie les supports par identifiant, quel que soit l’ordre reçu', () => {
    const a = scheduleOrThrow({
      supports: [
        { id: 'sup-b', node_id: 'n-ml-hall', support_type_key: 'directional' },
        { id: 'sup-a', node_id: 'n-ml-hall', support_type_key: 'directional' },
      ],
    });
    expect(a.lines.map(l => l.support_id)).toEqual(['sup-a', 'sup-a', 'sup-b', 'sup-b']);
  });
});

// ---------------------------------------------------------------------------
// Empreinte des entrées
// ---------------------------------------------------------------------------

describe('H2.5 — empreinte des entrées', () => {
  const base = {
    site: SITE,
    supports: SUPPORTS,
    profile: profile(),
    informationLevels: LEVELS,
    rules: NO_WAYFINDING_RULES,
  };

  it('est stable pour des entrées identiques', () => {
    expect(computeScheduleInputsHash(base)).toBe(computeScheduleInputsHash(base));
  });

  it('change quand l’annuaire change', () => {
    const renamed: SiteData = {
      ...SITE,
      destination_names: SITE.destination_names.map((n, i) =>
        i === 0 ? { ...n, value: `${n.value} modifié` } : n,
      ),
    };
    expect(computeScheduleInputsHash({ ...base, site: renamed }))
      .not.toBe(computeScheduleInputsHash(base));
  });

  it('change quand un support est ajouté', () => {
    expect(computeScheduleInputsHash({
      ...base,
      supports: [...SUPPORTS, { id: 'sup-2', node_id: 'n-ml-hall', support_type_key: 'directional' }],
    })).not.toBe(computeScheduleInputsHash(base));
  });

  it('change quand un principe de wayfinding change', () => {
    expect(computeScheduleInputsHash({
      ...base,
      rules: { max_destinations_per_face: 4 },
    })).not.toBe(computeScheduleInputsHash(base));
  });

  it('ne dépend pas de l’ordre des entrées reçues', () => {
    const reversed: SiteData = {
      ...SITE,
      destinations: [...SITE.destinations].reverse(),
      destination_names: [...SITE.destination_names].reverse(),
    };
    expect(computeScheduleInputsHash({ ...base, site: reversed }))
      .toBe(computeScheduleInputsHash(base));
  });
});
