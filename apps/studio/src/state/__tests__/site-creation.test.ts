import { describe, it, expect } from 'vitest';
import { createSiteCommands, SITE_NAME_MIN, SITE_NAME_MAX } from '../site-creation.js';
import type { SiteDraft, CreationContext } from '../site-creation.js';

const CONTEXT: CreationContext = {
  orgId: 'aaaaaaaa-0000-0000-0000-000000000001',
  siteId: 'site-1',
  buildingId: 'building-1',
  levelId: 'level-1',
  existingNames: ['Centre commercial du Port'],
  defaultBuildingName: 'Bâtiment 1',
  defaultLevelName: 'Niveau 0',
  timestamp: '2026-09-21T10:00:00.000Z',
};

const DRAFT: SiteDraft = {
  name: 'Gare de Lille Flandres',
  countryCode: 'FR',
  rulesPackId: 'fr-erp-2026',
  activeLangs: ['fr', 'en'],
};

function codes(draft: Partial<SiteDraft>, context: Partial<CreationContext> = {}): string[] {
  const r = createSiteCommands({ ...DRAFT, ...draft }, { ...CONTEXT, ...context });
  return r.ok ? [] : r.findings.map(f => f.code);
}

/**
 * M1 (partie M), formulaire de création — quatre champs, quatre contrôles.
 */
describe('M1 (partie M) — création d’un site', () => {
  describe('nom du site', () => {
    it('refuse un nom vide', () => {
      expect(codes({ name: '' })).toContain('DATA.NAME_REQUIRED');
    });

    it(`refuse en deçà de ${SITE_NAME_MIN} caractères`, () => {
      expect(codes({ name: 'A' })).toContain('DATA.NAME_REQUIRED');
    });

    it(`refuse au-delà de ${SITE_NAME_MAX} caractères`, () => {
      expect(codes({ name: 'x'.repeat(SITE_NAME_MAX + 1) })).toContain('DATA.NAME_REQUIRED');
    });

    it('accepte les bornes exactes', () => {
      expect(codes({ name: 'x'.repeat(SITE_NAME_MIN) })).toEqual([]);
      expect(codes({ name: 'x'.repeat(SITE_NAME_MAX) })).toEqual([]);
    });

    it('refuse un nom déjà porté dans l’organisation', () => {
      expect(codes({ name: 'Centre commercial du Port' })).toContain('DATA.NAME_DUPLICATE');
    });

    /**
     * Deux sites qui ne diffèrent que par la casse ou une espace de bord sont
     * le même nom pour un lecteur, et M1 (partie M) veut un nom « unique dans
     * l'organisation ».
     */
    it('juge l’unicité sans tenir compte de la casse ni des espaces de bord', () => {
      expect(codes({ name: '  centre COMMERCIAL du port  ' })).toContain('DATA.NAME_DUPLICATE');
    });

    it('écrit le nom sans ses espaces de bord', () => {
      const r = createSiteCommands({ ...DRAFT, name: '  Gare  ' }, CONTEXT);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value[0]?.after?.['name']).toBe('Gare');
    });
  });

  describe('pays', () => {
    it('refuse un pays non choisi', () => {
      expect(codes({ countryCode: '' })).toContain('DATA.COUNTRY_REQUIRED');
    });

    it('refuse un code qui n’est pas sur deux lettres majuscules', () => {
      expect(codes({ countryCode: 'fra' })).toContain('DATA.COUNTRY_REQUIRED');
      expect(codes({ countryCode: 'fr' })).toContain('DATA.COUNTRY_REQUIRED');
    });
  });

  describe('langues actives', () => {
    it('en exige au moins une', () => {
      expect(codes({ activeLangs: [] })).toContain('DATA.LANG_REQUIRED');
    });

    it('les écrit triées, pour que deux saisies équivalentes donnent le même état', () => {
      const a = createSiteCommands({ ...DRAFT, activeLangs: ['en', 'fr'] }, CONTEXT);
      const b = createSiteCommands({ ...DRAFT, activeLangs: ['fr', 'en'] }, CONTEXT);
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) expect(a.value[0]?.after).toEqual(b.value[0]?.after);
    });
  });

  describe('paquet de règles', () => {
    it('est facultatif, et son absence est un avertissement', () => {
      const r = createSiteCommands({ ...DRAFT, rulesPackId: null }, CONTEXT);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.warnings.map(f => f.code)).toEqual(['RULES.PACK_NOT_BOUND']);
    });

    it('ne prévient pas quand il est lié', () => {
      const r = createSiteCommands(DRAFT, CONTEXT);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.warnings).toEqual([]);
    });
  });

  /**
   * M7.5 (partie M) — « Un refus de saisie n'efface jamais le travail en
   * cours. » Corriger un champ pour découvrir le suivant ferait du formulaire
   * un couloir : les anomalies sortent ensemble.
   */
  it('rend toutes les anomalies ensemble, pas la première', () => {
    const all = codes({ name: '', countryCode: '', activeLangs: [] });
    expect(all).toContain('DATA.NAME_REQUIRED');
    expect(all).toContain('DATA.COUNTRY_REQUIRED');
    expect(all).toContain('DATA.LANG_REQUIRED');
  });
});

/**
 * M1 (partie M) : « Créer un site crée aussi un premier bâtiment et un premier niveau,
 * nommés par défaut et renommables. Un site sans niveau est un état inutile
 * que l'utilisateur devrait corriger lui-même. »
 */
describe('M1 (partie M) — le site naît avec un bâtiment et un niveau', () => {
  it('rend trois commandes, dans l’ordre des dépendances', () => {
    const r = createSiteCommands(DRAFT, CONTEXT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.map(c => c.table)).toEqual(['site', 'building', 'level']);
  });

  it('rattache le bâtiment au site et le niveau au bâtiment', () => {
    const r = createSiteCommands(DRAFT, CONTEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value[1]?.after?.['site_id']).toBe(CONTEXT.siteId);
      expect(r.value[2]?.after?.['building_id']).toBe(CONTEXT.buildingId);
    }
  });

  /** Un seul geste, une seule annulation (E5.2). */
  it('groupe les trois commandes sous un même geste', () => {
    const r = createSiteCommands(DRAFT, CONTEXT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const groups = new Set(r.value.map(c => c.groupKey));
      expect(groups.size).toBe(1);
      expect([...groups][0]).not.toBeNull();
    }
  });

  /**
   * M12.A2 et INT-1 : les trois tables appartiennent au module
   * 01, et c'est lui qui les écrit. `buildCommand` refuserait une table d'un
   * autre module.
   */
  it('n’écrit que des tables du module 01', () => {
    const r = createSiteCommands(DRAFT, CONTEXT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.every(c => c.module === '01-socle')).toBe(true);
  });

  /** E5.1 : l'horodatage vient de l'appelant, jamais de l'horloge. */
  it('porte l’horodatage fourni, sur les trois', () => {
    const r = createSiteCommands(DRAFT, CONTEXT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.every(c => c.timestamp === CONTEXT.timestamp)).toBe(true);
  });

  it('deux créations du même état produisent les mêmes commandes (INV-4)', () => {
    const a = createSiteCommands(DRAFT, CONTEXT);
    const b = createSiteCommands(DRAFT, CONTEXT);
    expect(a).toEqual(b);
  });
});
