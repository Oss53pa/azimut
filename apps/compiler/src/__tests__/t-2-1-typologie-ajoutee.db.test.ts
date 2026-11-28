import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FaceTemplate, SiteData, SupportType } from '@azimut/core-model';
import { createDb, inRolledBackFixture, loadSiteData, referenceUuid, writeReferenceSite } from '@azimut/db';
import { NO_WAYFINDING_RULES, generateMessageSchedule, validateSupports } from '@azimut/engine-graph';
import { refMultilevel } from '@azimut/testkit';
import { renderArtwork } from '../artwork.js';
import { theme } from './compile-artwork-fixtures.js';

/**
 * T-2.1 — « Ajouter une typologie ne demande aucune modification de code. »
 *
 * Une typologie nouvelle, à deux faces de taille déclarée, est posée en base
 * comme une donnée, et rien d'autre : ni le code, ni les moteurs ne la
 * connaissent, et le site de référence l'ignore. Le support du site lui est
 * rattaché. Le site relu par le chargeur du compilateur la porte avec ses
 * faces ; le contrôle des supports l'accepte ; le tableau des messages produit
 * des lignes sur ses deux faces ; la face rendue prend la taille que la
 * typologie déclare.
 *
 * Avant 0089, la même typologie relue en base n'avait aucune face : refusée
 * par le contrôle, aucune ligne, taille de repli.
 *
 * Tout se fait dans une transaction annulée, sous le rôle de décor du banc.
 */
const URL = process.env['AZIMUT_TEST_DATABASE_URL'];
const KEY = 'ref-multilevel';
const TYPOLOGY = 'totem-t21';
const TYPOLOGY_ID = 'typology-totem-t21';
const uuid = (id: string): string => referenceUuid(KEY, id);

let db: ReturnType<typeof createDb>;

beforeAll(() => {
  if (URL === undefined || URL === '') {
    throw new Error('AZIMUT_TEST_DATABASE_URL absente. Voir packages/db/migrations/ORDRE.md.');
  }
  db = createDb(URL);
});

afterAll(async () => { await db.$client.end(); });

/** La typologie nouvelle : une donnée, que le code ne nomme nulle part ailleurs. */
const TOTEM: SupportType = {
  id: TYPOLOGY_ID, org_id: refMultilevel.organization.id, key: TYPOLOGY, name: 'Totem', face_count: 2,
  faces: [
    { side: 'front', default_width_mm: 800, default_height_mm: 2000 },
    { side: 'back', default_width_mm: 800, default_height_mm: 2000 },
  ],
};

/** Le site relu après l'ajout de la typologie et le rattachement du support. */
function siteWithNewTypology(): Promise<SiteData> {
  const written: SiteData = {
    ...refMultilevel,
    support_types: [...refMultilevel.support_types, TOTEM],
    supports: refMultilevel.supports.map(x => ({ ...x, typology_id: TYPOLOGY_ID })),
  };
  return inRolledBackFixture(db, async tx => {
    await writeReferenceSite(tx, KEY, written);
    return loadSiteData(tx, uuid(refMultilevel.organization.id), uuid(refMultilevel.site.id));
  });
}

/** Les gabarits sont fournis par l'appelant (contrat de `assembleSiteData`). */
function templatesFor(site: SiteData): readonly FaceTemplate[] {
  const base = refMultilevel.face_templates[0];
  if (base === undefined) throw new Error('gabarit de référence absent');
  return [...site.face_templates, ...(['front', 'back'] as const).map(side => ({
    ...base, id: `ftpl-totem-${side}`, support_type_key: TYPOLOGY, side,
  }))];
}

describe('T-2.1 — une typologie ajoutée en donnée va jusqu’à la face rendue', () => {
  let site: SiteData;

  beforeAll(async () => {
    const read = await siteWithNewTypology();
    site = { ...read, face_templates: templatesFor(read) };
  });

  it('le site relu porte la typologie et ses deux faces', () => {
    expect(site.support_types.find(t => t.key === TYPOLOGY)).toMatchObject({
      face_count: 2,
      faces: [
        { side: 'back', default_width_mm: 800, default_height_mm: 2000 },
        { side: 'front', default_width_mm: 800, default_height_mm: 2000 },
      ],
    });
  });

  it('le contrôle des supports l’accepte', () => {
    const checked = validateSupports(site);
    const findings = checked.ok ? checked.warnings : checked.findings;
    expect(findings.filter(f => f.entity?.id === uuid(TYPOLOGY_ID))).toEqual([]);
  });

  it('le tableau des messages produit des lignes sur ses deux faces', () => {
    const profile = site.travel_profiles.find(p => p.key === 'standard');
    if (profile === undefined) throw new Error('profil standard absent');
    const schedule = generateMessageSchedule({
      site, profile, rules: NO_WAYFINDING_RULES, version: 1, generated_at: '2026-11-28T00:00:00.000Z',
      supports: [{ id: uuid('sup-001'), node_id: uuid('n-ml-hall'), support_type_key: TYPOLOGY }],
      informationLevels: [{ support_type_key: TYPOLOGY, levels: [2, 3] }],
    });
    if (!schedule.ok) throw new Error(schedule.findings.map(f => f.code).join(','));
    const faces = new Set(schedule.value.lines.filter(l => l.support_id === uuid('sup-001')).map(l => l.face_index));
    expect([...faces].sort()).toEqual([0, 1]);
  });

  it('la face rendue prend la taille que la typologie déclare', async () => {
    const render = await renderArtwork({
      site, theme, fontFamily: 'Helvetica', pdfTarget: 'pdf-x4', creationDate: new Date('2026-11-28T00:00:00Z'),
      nodeId: uuid('n-ml-hall'), supportId: uuid('sup-001'), templateId: 'ftpl-totem-front',
      profileKey: 'standard', title: 'Totem — front',
    });
    expect([render.supportTypeKey, render.side, render.widthMm, render.heightMm]).toEqual([TYPOLOGY, 'front', 800, 2000]);
  });
});
