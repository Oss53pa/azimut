import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit/sites';
import type { TravelProfile } from '@azimut/core-model';
import type { PlacedSupport } from '../compute-quantities.js';
import { generateMessageSchedule } from '../message-schedule-generate.js';
import {
  NO_WAYFINDING_RULES, messageLineId, reduceInformationLevel,
} from '../message-schedule.js';
import type { TypologyInformationLevels } from '../message-schedule.js';

/**
 * N2.7, critère 1 : « Sur un site de référence, le tableau des messages généré
 * est exactement celui attendu, ligne pour ligne. »
 *
 * Le générateur, 243 lignes, n'avait pas d'essai propre : quatre fichiers
 * l'employaient comme décor pour éprouver autre chose. Ce qu'il produit
 * n'était donc vérifié nulle part, et c'est le producteur unique du contenu de
 * toutes les faces (règle M02.W6, et fiche du module 02 : « le tableau des
 * messages est le seul producteur de contenu de face »).
 *
 * L'attente est **dérivée du site**, jamais recopiée d'une exécution. Un essai
 * qui figerait la sortie observée vérifierait que le code ne change pas, pas
 * qu'il est juste : il passerait tout aussi bien sur un tableau faux.
 */

const SITE = refMultilevel;
const GENERATED_AT = '2026-04-01T00:00:00.000Z';
const SUPPORT = 'sup-1';
const HALL = 'n-ml-hall';
const TYPOLOGY = 'directional';

/** Les niveaux d'information rattachés à la typologie (H2.3). */
const LEVELS: readonly TypologyInformationLevels[] = [
  { support_type_key: TYPOLOGY, levels: [2, 3] },
];

const SUPPORTS: readonly PlacedSupport[] = [
  { id: SUPPORT, node_id: HALL, support_type_key: TYPOLOGY },
];

function profile(key = 'standard'): TravelProfile {
  const found = SITE.travel_profiles.find(p => p.key === key);
  if (found === undefined) throw new Error(`profil ${key} absent du site de référence`);
  return found;
}

function generate(supports: readonly PlacedSupport[] = SUPPORTS) {
  return generateMessageSchedule({
    site: SITE,
    supports,
    profile: profile(),
    informationLevels: LEVELS,
    rules: NO_WAYFINDING_RULES,
    version: 1,
    generated_at: GENERATED_AT,
  });
}

/** Le nom d'une destination dans une langue, lu dans l'annuaire du site. */
function nameOf(destinationId: string, lang: 'fr' | 'en'): string {
  const found = SITE.destination_names.find(
    n => n.destination_id === destinationId && n.lang === lang,
  );
  if (found === undefined) throw new Error(`dénomination ${destinationId}/${lang} absente`);
  return found.value;
}

/** Le gabarit de l'unique face de la typologie, d'où découle le nombre de blocs. */
function blockCount(): number {
  const type = SITE.support_types.find(t => t.key === TYPOLOGY);
  if (type === undefined) throw new Error('typologie absente du site de référence');
  const side = [...type.faces].sort((a, b) => a.side.localeCompare(b.side))[0]?.side;
  const template = SITE.face_templates.find(
    t => t.support_type_key === TYPOLOGY && t.side === side,
  );
  if (template === undefined) throw new Error('gabarit absent du site de référence');
  return template.blocks.length;
}

describe('N2.7 critère 1 — le tableau généré est exactement celui attendu', () => {
  it('produit une ligne par bloc du gabarit, et pas une de plus', () => {
    const out = generate();
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // Le compte vient du gabarit, pas d'une exécution. Une ligne de plus ou de
    // moins que ce que le gabarit décrit est une faute, dans les deux sens.
    expect(out.value.lines).toHaveLength(blockCount());
  });

  it('donne à chaque ligne l’identifiant stable que la partie R exige', () => {
    const out = generate();
    if (!out.ok) throw new Error('génération refusée');
    expect(out.value.lines.map(l => l.id)).toEqual(
      out.value.lines.map((_, i) => messageLineId(SUPPORT, 0, i)),
    );
  });

  it('justifie chaque ligne par le point de décision où le support est posé (M02.W4)', () => {
    const out = generate();
    if (!out.ok) throw new Error('génération refusée');
    for (const line of out.value.lines) {
      expect(line.decision_point_id).toBe(HALL);
    }
  });

  it('porte le niveau d’information réduit de la typologie (M02.W3)', () => {
    const out = generate();
    if (!out.ok) throw new Error('génération refusée');
    const expected = reduceInformationLevel(LEVELS[0]?.levels ?? []);
    for (const line of out.value.lines) {
      expect(line.information_level).toBe(expected);
    }
  });

  it('annonce les destinations de l’annuaire, dans les deux langues actives', () => {
    const out = generate();
    if (!out.ok) throw new Error('génération refusée');

    const listed = out.value.lines
      .filter(l => l.block_kind === 'destination_list')
      .flatMap(l => l.entries)
      .filter(e => e.destination_id !== null);

    // Ce que le site déclare atteignable depuis le hall, lu dans l'annuaire —
    // et non ce que le générateur a rendu.
    const expected = SITE.destinations.map(d => d.id);
    expect(listed.map(e => e.destination_id)).toEqual(expected);

    for (const entry of listed) {
      const id = entry.destination_id;
      if (id === null) continue;
      expect(entry.text.fr).toBe(nameOf(id, 'fr'));
      expect(entry.text.en).toBe(nameOf(id, 'en'));
    }
  });

  it('nomme le site dans le bloc d’en-tête', () => {
    const out = generate();
    if (!out.ok) throw new Error('génération refusée');
    const header = out.value.lines.find(l => l.block_kind === 'header');
    expect(header?.entries[0]?.text.fr).toBe(SITE.site.name);
  });

  it('ne signale rien sur un site de référence cohérent', () => {
    const out = generate();
    if (!out.ok) throw new Error('génération refusée');
    expect(out.warnings.map(w => w.code)).toEqual([]);
  });

  it('rend deux fois le même tableau pour la même entrée (INV-4)', () => {
    const first = generate();
    const second = generate();
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('ordonne les supports par identifiant, quel que soit l’ordre reçu', () => {
    const two: readonly PlacedSupport[] = [
      { id: 'sup-2', node_id: HALL, support_type_key: TYPOLOGY },
      { id: 'sup-1', node_id: HALL, support_type_key: TYPOLOGY },
    ];
    const out = generate(two);
    if (!out.ok) throw new Error('génération refusée');
    const order = [...new Set(out.value.lines.map(l => l.support_id))];
    expect(order).toEqual(['sup-1', 'sup-2']);
  });

  it('refuse la ligne d’un support posé hors d’un point de décision (M02.W4)', () => {
    const elsewhere: readonly PlacedSupport[] = [
      { id: 'sup-hors', node_id: 'n-ml-dest-rdc', support_type_key: TYPOLOGY },
    ];
    const out = generate(elsewhere);
    if (!out.ok) throw new Error('génération refusée');
    expect(out.value.lines).toHaveLength(0);
    expect(out.warnings.map(w => w.code)).toContain('WAYFIND.LINE_UNJUSTIFIED');
  });

  it('porte l’empreinte des entrées, qui change avec elles', () => {
    const one = generate();
    const two = generate([
      ...SUPPORTS, { id: 'sup-2', node_id: HALL, support_type_key: TYPOLOGY },
    ]);
    if (!one.ok || !two.ok) throw new Error('génération refusée');
    expect(one.value.inputs_hash).not.toBe(two.value.inputs_hash);
  });
});
