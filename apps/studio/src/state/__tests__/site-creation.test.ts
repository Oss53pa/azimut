import { describe, it, expect } from 'vitest';
import { createSiteCommands, SITE_NAME_MIN, SITE_NAME_MAX } from '../site-creation.js';
import type { SiteDraft, CreationContext } from '../site-creation.js';

const CONTEXT: CreationContext = {
  orgId: 'aaaaaaaa-0000-0000-0000-000000000001',
  siteId: 'site-1',
  buildingId: 'building-1',
  levelId: 'level-1',
  existingNames: ['Centre commercial du Port'],
  // Q9 — un extrait du référentiel. Les contrôles de pays et de fuseau s'y
  // adossent ; l'essai n'a pas besoin des 249 lignes pour les exercer.
  countries: [
    { code: 'FR', timezones: ['Europe/Paris'] },
    { code: 'CI', timezones: ['Africa/Abidjan'] },
    { code: 'US', timezones: ['America/New_York', 'America/Chicago'] },
  ],
  defaultBuildingName: 'Bâtiment 1',
  defaultLevelName: 'Niveau 0',
  timestamp: '2026-09-21T10:00:00.000Z',
};

const DRAFT: SiteDraft = {
  name: 'Gare de Lille Flandres',
  countryCode: 'FR',
  timezone: 'Europe/Paris',
  rulesPackId: 'fr-erp-2026',
  activeLangs: ['fr', 'en'],
  legalEntityId: null,
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

    /**
     * Q9, version 7 — le pays se juge contre le référentiel et non contre une
     * forme. Un code bien formé qu'aucune ligne de `country` ne porte donnerait
     * un site dont le fuseau ne se contrôle contre rien.
     */
    it('refuse un code bien formé mais absent du référentiel', () => {
      expect(codes({ countryCode: 'ZZ' })).toContain('DATA.COUNTRY_REQUIRED');
    });

    it('refuse tout pays quand le référentiel n’a pas pu être lu', () => {
      expect(codes({}, { countries: [] })).toContain('DATA.COUNTRY_REQUIRED');
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

  /**
   * M1 (partie M), version 6 : « facultatif à la création | aucune anomalie à
   * la création ; information affichée ». `RULES.PACK_NOT_BOUND` a désormais
   * une gravité unique, bloquante, et se lève à l'opération qui exige des
   * règles — jamais ici.
   */
  describe('paquet de règles', () => {
    it('est facultatif, et son absence ne lève aucune anomalie', () => {
      const r = createSiteCommands({ ...DRAFT, rulesPackId: null }, CONTEXT);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.warnings).toEqual([]);
    });

    it('ne lève rien non plus quand il est lié', () => {
      const r = createSiteCommands(DRAFT, CONTEXT);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.warnings).toEqual([]);
    });
  });

  /**
   * O4 et A5.2 — le fuseau du site est requis. La colonne est NOT NULL en
   * base : sans contrôle ici, la création échouerait à l'écriture sur une
   * violation de contrainte, là où il faut dire quel champ manque.
   */
  describe('fuseau horaire', () => {
    it('est écrit sur la ligne du site', () => {
      const r = createSiteCommands(DRAFT, CONTEXT);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value[0]?.after?.['timezone']).toBe('Europe/Paris');
    });

    it('est requis', () => {
      const r = createSiteCommands({ ...DRAFT, timezone: '' }, CONTEXT);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.findings.map(f => f.code)).toContain('DATA.TIMEZONE_REQUIRED');
    });

    it('doit être un fuseau que le référentiel connaît', () => {
      const r = createSiteCommands({ ...DRAFT, timezone: 'Europe/Atlantide' }, CONTEXT);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.findings.map(f => f.code)).toContain('DATA.TIMEZONE_REQUIRED');
    });

    it('accepte un fuseau hors d’Europe : le produit n’est pas français', () => {
      const r = createSiteCommands(
        { ...DRAFT, countryCode: 'CI', timezone: 'Africa/Abidjan' }, CONTEXT);
      expect(r.ok).toBe(true);
    });

    /**
     * M1 (partie M), version 7 : « valeurs issues de `country.timezones` ». Un
     * fuseau valide ailleurs mais étranger au pays choisi est une erreur de
     * saisie, et c'est la seule que le contrôle précédent laissait passer.
     */
    it('refuse un fuseau valide mais étranger au pays choisi', () => {
      const r = createSiteCommands(
        { ...DRAFT, countryCode: 'FR', timezone: 'America/New_York' }, CONTEXT);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.findings.map(f => f.code)).toContain('DATA.TIMEZONE_REQUIRED');
    });

    it('accepte l’un quelconque des fuseaux d’un pays qui en compte plusieurs', () => {
      for (const zone of ['America/New_York', 'America/Chicago']) {
        const r = createSiteCommands(
          { ...DRAFT, countryCode: 'US', timezone: zone }, CONTEXT);
        expect(r.ok, zone).toBe(true);
      }
    });
  });

  /**
   * Q5 et M1 (partie M), version 7 — l'entité juridique est facultative à la
   * création, « requise avant l'émission de la première facture ».
   */
  describe('entité juridique', () => {
    it('s’écrit sur la ligne du site quand elle est choisie', () => {
      const id = 'e0000000-0000-0000-0000-000000000001';
      const r = createSiteCommands({ ...DRAFT, legalEntityId: id }, CONTEXT);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value[0]?.after?.['legal_entity_id']).toBe(id);
    });

    it('ne lève aucune anomalie quand elle est absente', () => {
      const r = createSiteCommands({ ...DRAFT, legalEntityId: null }, CONTEXT);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value[0]?.after?.['legal_entity_id']).toBeNull();
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
