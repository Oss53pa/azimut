import { describe, it, expect } from 'vitest';
import { auditTypography } from '../audit-typography.js';
import { runChecks } from '../run-checks.js';
import { refMultilevel } from '@azimut/testkit';
import type { CharterRule, SiteData, SiteVocabulary } from '@azimut/core-model';

/**
 * La charte d'un site d'essai — A5.8, `charter_rule`.
 *
 * Les six caractères sont ceux que le dépôt portait en dur jusqu'ici, et leurs
 * noms sont ceux que l'anomalie rapporte. Ils sont ici, dans une charte
 * inventée, parce qu'A5.8 range la règle parmi les règles de charte : aucun
 * caractère n'est plus écrit dans le code du contrôle.
 */
const CARACTERES: CharterRule = {
  kind: 'forbidden_character',
  params: {
    characters: [
      { from: 0x00b7, to: 0x00b7, name: 'point médian' },
      { from: 0x00d7, to: 0x00d7, name: 'signe de multiplication' },
      { from: 0x2013, to: 0x2013, name: 'tiret demi-cadratin' },
      { from: 0x2014, to: 0x2014, name: 'tiret cadratin' },
      { from: 0x2026, to: 0x2026, name: 'points de suspension' },
      { from: 0x2190, to: 0x21ff, name: 'flèche' },
    ],
  },
};

const CHARTE: readonly CharterRule[] = [CARACTERES];
const VOCABULAIRE: SiteVocabulary = { charter_rules: CHARTE };

/** Un site dont une dénomination porte le texte donné. */
function siteAvecDenomination(value: string): SiteData {
  const first = refMultilevel.destination_names[0];
  if (first === undefined) throw new Error('le site de référence n’a aucune dénomination');
  return {
    ...refMultilevel,
    destination_names: [{ ...first, value }],
  };
}

describe('LAYOUT.FORBIDDEN_CHARACTER — A5.8, caractères interdits par la charte', () => {
  it('ne signale rien sur les sites de référence', () => {
    // Le contrôle naît sans rien à dire : les jeux de référence sont propres.
    // Un essai qui ne le vérifierait pas laisserait croire au contrôle une
    // vertu qui serait en fait une panne.
    const report = auditTypography(refMultilevel, CHARTE);
    expect(report.findings).toHaveLength(0);
    expect(report.checked_texts).toBeGreaterThan(0);
  });

  it('signale chacun des six caractères que la charte nomme', () => {
    const cas: readonly [string, string][] = [
      ['Niveau · Un', 'point médian'],
      ['3 × 4 places', 'signe de multiplication'],
      ['Nord – Sud', 'tiret demi-cadratin'],
      ['Nord — Sud', 'tiret cadratin'],
      ['Ouverture prochaine…', 'points de suspension'],
      ['Sortie → Parking', 'flèche'],
    ];
    for (const [texte, nom] of cas) {
      const report = auditTypography(siteAvecDenomination(texte), CHARTE);
      expect(report.findings, texte).toHaveLength(1);
      expect(report.findings[0]?.code).toBe('LAYOUT.FORBIDDEN_CHARACTER');
      expect(report.findings[0]?.severity).toBe('blocking');
      expect(report.findings[0]?.params['name']).toBe(nom);
      expect(report.findings[0]?.ruleRef).toBe('A5.8');
    }
  });

  it('rend une anomalie par occurrence, et sa position', () => {
    // Deux fautes dans une dénomination sont deux corrections à faire. Un
    // compte agrégé obligerait à relire le texte pour savoir lesquelles.
    const report = auditTypography(siteAvecDenomination('A — B — C'), CHARTE);
    expect(report.findings).toHaveLength(2);
    expect(report.findings.map(f => f.params['position'])).toEqual([2, 6]);
  });

  it('laisse passer le tiret ordinaire, le point et la lettre accentuée', () => {
    // La règle vise des caractères nommés, pas la ponctuation en général.
    const report = auditTypography(siteAvecDenomination('Zone Nord-Est. Accès piétons (3 places)'), CHARTE);
    expect(report.findings).toHaveLength(0);
  });

  it('ne vise pas trois points ASCII, et la limite est assumée', () => {
    // « ... » et « … » se lisent pareil et ne sont pas la même chaîne. Étendre
    // à la suite de trois points ajouterait à la règle au lieu de l'appliquer.
    const report = auditTypography(siteAvecDenomination('Ouverture prochaine...'), CHARTE);
    expect(report.findings).toHaveLength(0);
  });

  it('lit aussi le texte libre d’un gabarit de face', () => {
    // C'est le seul texte qu'on saisit librement, donc l'endroit où la règle a
    // le plus de chances d'être enfreinte. Il reste hors des contrôles de
    // vocabulaire, qui eux ont besoin d'une langue ; un caractère, non.
    const template = refMultilevel.face_templates[0];
    if (template === undefined) throw new Error('aucun gabarit de référence');
    const site: SiteData = {
      ...refMultilevel,
      face_templates: [{
        ...template,
        blocks: [{
          kind: 'free_text',
          ordinal: 1,
          region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 10 },
          config: { text: 'Accueil → niveau 1' },
        }],
      }],
    };
    const report = auditTypography(site, CHARTE);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.entity?.kind).toBe('face_template_block');
    expect(report.findings[0]?.params['name']).toBe('flèche');
  });

  it('parcourt les blocs d’un gabarit par rang, quel que soit l’ordre du tableau', () => {
    // L'ordre annoncé est déterministe ; rien ne garantit que le tableau des
    // blocs arrive trié de la base.
    const template = refMultilevel.face_templates[0];
    if (template === undefined) throw new Error('aucun gabarit de référence');
    const bloc = (ordinal: number, text: string) => ({
      kind: 'free_text' as const,
      ordinal,
      region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 10 },
      config: { text },
    });
    const site: SiteData = {
      ...refMultilevel,
      face_templates: [{
        ...template,
        blocks: [bloc(3, 'trois \u2014'), bloc(1, 'un \u2014'), bloc(2, 'deux \u2014')],
      }],
    };
    const report = auditTypography(site, CHARTE);
    expect(report.findings).toHaveLength(3);
    expect(report.findings.map(f => f.entity?.id)).toEqual([
      `${template.id}#1`, `${template.id}#2`, `${template.id}#3`,
    ]);
  });

  it('couvre le bloc des flèches, pas un caractère voisin', () => {
    // U+2190 à U+21FF inclus. U+218F et U+2200 sont juste en dehors.
    const dedans = auditTypography(siteAvecDenomination('←⇿'), CHARTE);
    expect(dedans.findings).toHaveLength(2);
    const dehors = auditTypography(siteAvecDenomination('↏∀'), CHARTE);
    expect(dehors.findings).toHaveLength(0);
  });

  /**
   * A5.8 — « Quand la charte ne porte pas une règle, le contrôle correspondant
   * ne s'exécute pas et le signale. Il n'applique aucune valeur par défaut :
   * une règle absente n'est pas une règle permissive. »
   */
  it('ne s’exécute pas quand la charte ne porte pas la règle', () => {
    const report = auditTypography(siteAvecDenomination('A — B'), []);
    expect(report.applied).toBe(false);
    expect(report.findings).toEqual([]);
    // Les textes sont bien là : c'est la règle qui manque, pas la matière.
    expect(report.checked_texts).toBeGreaterThan(0);
  });

  /**
   * Le seul essai qui tienne contre un repli silencieux : si le contrôle
   * gardait une liste par défaut, l'essai ci-dessus passerait pour une autre
   * raison — un site propre. Celui-ci porte un caractère que l'ancienne liste
   * interdisait, et exige qu'il passe faute de charte pour le refuser.
   */
  it('n’applique aucune liste par défaut : le tiret cadratin passe sans charte', () => {
    const r = runChecks(siteAvecDenomination('A — B'), {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.findings.map(f => f.code)).not.toContain('LAYOUT.FORBIDDEN_CHARACTER');
    expect(r.value.checks_undeclared).toContain('forbidden_characters');
    expect(r.value.checks_run).not.toContain('forbidden_characters');
  });

  it('une charte qui porte la règle sans rien interdire n’est pas une charte absente', () => {
    // `null` et le tableau vide ne disent pas la même chose : l'un veut dire
    // « pas de règle », l'autre « une règle qui n'interdit rien ».
    const vide: CharterRule = { kind: 'forbidden_character', params: { characters: [] } };
    const report = auditTypography(siteAvecDenomination('A — B'), [vide]);
    expect(report.applied).toBe(true);
    expect(report.findings).toEqual([]);
  });

  it('réunit les caractères de deux règles de même nature', () => {
    // Une charte peut interdire les tirets dans une règle et les flèches dans
    // une autre. Refuser l'une des deux au motif qu'il y en a deux serait
    // arbitraire.
    const tirets: CharterRule = {
      kind: 'forbidden_character',
      params: { characters: [{ from: 0x2014, to: 0x2014, name: 'tiret cadratin' }] },
    };
    const fleches: CharterRule = {
      kind: 'forbidden_character',
      params: { characters: [{ from: 0x2190, to: 0x21ff, name: 'flèche' }] },
    };
    const report = auditTypography(siteAvecDenomination('A — B → C'), [tirets, fleches]);
    expect(report.findings.map(f => f.params['name'])).toEqual(['tiret cadratin', 'flèche']);
  });

  it('tourne aux deux modes : un caractère interdit l’est sans condition de destination', () => {
    // La destination du rendu ne change rien : un caractère que la charte
    // interdit l'est à l'atelier comme à l'impression.
    for (const mode of ['atelier', 'livrable'] as const) {
      const r = runChecks(siteAvecDenomination('A — B'), VOCABULAIRE, { mode });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.checks_run).toContain('forbidden_characters');
      expect(r.value.findings.map(f => f.code)).toContain('LAYOUT.FORBIDDEN_CHARACTER');
    }
  });
});
