import { describe, it, expect } from 'vitest';
import { auditTypography, FORBIDDEN_CHARACTERS } from '../audit-typography.js';
import { runChecks } from '../run-checks.js';
import { refMultilevel } from '@azimut/testkit';
import type { SiteData } from '@azimut/core-model';

/** Un site dont une dénomination porte le texte donné. */
function siteAvecDenomination(value: string): SiteData {
  const first = refMultilevel.destination_names[0];
  if (first === undefined) throw new Error('le site de référence n’a aucune dénomination');
  return {
    ...refMultilevel,
    destination_names: [{ ...first, value }],
  };
}

describe('QC-06 (complément atelier) — caractères interdits', () => {
  it('ne signale rien sur les sites de référence', () => {
    // Le contrôle naît sans rien à dire : les jeux de référence sont propres.
    // Un essai qui ne le vérifierait pas laisserait croire au contrôle une
    // vertu qui serait en fait une panne.
    const report = auditTypography(refMultilevel);
    expect(report.findings).toHaveLength(0);
    expect(report.checked_texts).toBeGreaterThan(0);
  });

  it('signale chacun des six caractères que le document nomme', () => {
    const cas: readonly [string, string][] = [
      ['Niveau · Un', 'point médian'],
      ['3 × 4 places', 'signe de multiplication'],
      ['Nord – Sud', 'tiret demi-cadratin'],
      ['Nord — Sud', 'tiret cadratin'],
      ['Ouverture prochaine…', 'points de suspension'],
      ['Sortie → Parking', 'flèche'],
    ];
    for (const [texte, nom] of cas) {
      const report = auditTypography(siteAvecDenomination(texte));
      expect(report.findings, texte).toHaveLength(1);
      expect(report.findings[0]?.code).toBe('LAYOUT.FORBIDDEN_CHARACTER');
      expect(report.findings[0]?.severity).toBe('blocking');
      expect(report.findings[0]?.params['name']).toBe(nom);
      expect(report.findings[0]?.ruleRef).toBe('atelier-QC-06');
    }
  });

  it('rend une anomalie par occurrence, et sa position', () => {
    // Deux fautes dans une dénomination sont deux corrections à faire. Un
    // compte agrégé obligerait à relire le texte pour savoir lesquelles.
    const report = auditTypography(siteAvecDenomination('A — B — C'));
    expect(report.findings).toHaveLength(2);
    expect(report.findings.map(f => f.params['position'])).toEqual([2, 6]);
  });

  it('laisse passer le tiret ordinaire, le point et la lettre accentuée', () => {
    // La règle vise des caractères nommés, pas la ponctuation en général.
    const report = auditTypography(siteAvecDenomination('Zone Nord-Est. Accès piétons (3 places)'));
    expect(report.findings).toHaveLength(0);
  });

  it('ne vise pas trois points ASCII, et la limite est assumée', () => {
    // « ... » et « … » se lisent pareil et ne sont pas la même chaîne. Étendre
    // à la suite de trois points ajouterait à la règle au lieu de l'appliquer.
    const report = auditTypography(siteAvecDenomination('Ouverture prochaine...'));
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
    const report = auditTypography(site);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.entity?.kind).toBe('face_template_block');
    expect(report.findings[0]?.params['name']).toBe('flèche');
  });

  it('couvre le bloc des flèches, pas un caractère voisin', () => {
    // U+2190 à U+21FF inclus. U+218F et U+2200 sont juste en dehors.
    const dedans = auditTypography(siteAvecDenomination('←⇿'));
    expect(dedans.findings).toHaveLength(2);
    const dehors = auditTypography(siteAvecDenomination('↏∀'));
    expect(dehors.findings).toHaveLength(0);
  });

  it('la table reste triée par point de code, pour que l’ordre se lise', () => {
    const froms = FORBIDDEN_CHARACTERS.map(r => r.from);
    expect([...froms]).toEqual([...froms].sort((a, b) => a - b));
    for (const range of FORBIDDEN_CHARACTERS) {
      expect(range.to).toBeGreaterThanOrEqual(range.from);
      expect(range.name.length).toBeGreaterThan(0);
    }
  });

  it('tourne aux deux modes, parce que QC-06 est bloquant sans condition', () => {
    // Contrairement à QC-21, la destination du rendu ne change rien : un
    // caractère interdit l'est à l'atelier comme à l'impression.
    for (const mode of ['atelier', 'livrable'] as const) {
      const r = runChecks(siteAvecDenomination('A — B'), {}, { mode });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.checks_run).toContain('forbidden_characters');
      expect(r.value.findings.map(f => f.code)).toContain('LAYOUT.FORBIDDEN_CHARACTER');
    }
  });

  it('ne figure jamais aux contrôles non exercés : il n’attend rien', () => {
    const r = runChecks(refMultilevel, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.checks_undeclared).not.toContain('forbidden_characters');
    expect(r.value.checks_skipped).not.toContain('forbidden_characters');
  });
});
