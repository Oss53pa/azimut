import { describe, it, expect } from 'vitest';
import {
  auditSentenceLength, splitSentences, countWords,
} from '../audit-sentence-length.js';
import { runChecks } from '../run-checks.js';
import { refMultilevel } from '@azimut/testkit';
import type { CharterRule, SiteData, SiteVocabulary } from '@azimut/core-model';

/**
 * La limite de la charte d'un site d'essai — A5.8, `charter_rule`.
 *
 * Vingt-cinq est la valeur que le contrôle portait en dur. Elle est ici, dans
 * une charte inventée, et le contrôle ne connaît plus aucun nombre.
 */
const LIMITE = 25;
const CHARTE: readonly CharterRule[] = [
  { kind: 'max_sentence_words', params: { maximum: LIMITE } },
];
const VOCABULAIRE: SiteVocabulary = { charter_rules: CHARTE };

/** Un site dont un gabarit porte un bloc de texte libre. */
function siteAvecTexteLibre(text: string): SiteData {
  const template = refMultilevel.face_templates[0];
  if (template === undefined) throw new Error('aucun gabarit de référence');
  return {
    ...refMultilevel,
    face_templates: [{
      ...template,
      blocks: [{
        kind: 'free_text',
        ordinal: 1,
        region: { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 20 },
        config: { text },
      }],
    }],
  };
}

/** `n` mots, séparés par des espaces. */
function mots(n: number): string {
  return Array.from({ length: n }, (_, i) => `mot${String(i + 1)}`).join(' ');
}

describe('LAYOUT.SENTENCE_TOO_LONG — A5.8, la limite vient de la charte', () => {
  it('ne signale rien sur les sites de référence', () => {
    // Le contrôle naît sans rien à dire ; sans cette vérification, une panne
    // aurait l'air d'une vertu.
    const report = auditSentenceLength(refMultilevel, CHARTE);
    expect(report.findings).toHaveLength(0);
  });

  it('admet la phrase au seuil et signale celle qui le dépasse', () => {
    expect(auditSentenceLength(siteAvecTexteLibre(mots(LIMITE)), CHARTE).findings)
      .toHaveLength(0);
    const r = auditSentenceLength(siteAvecTexteLibre(mots(LIMITE + 1)), CHARTE);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.code).toBe('LAYOUT.SENTENCE_TOO_LONG');
    expect(r.findings[0]?.params['words']).toBe(LIMITE + 1);
    expect(r.findings[0]?.params['maximum']).toBe(LIMITE);
    expect(r.findings[0]?.ruleRef).toBe('A5.8');
  });

  it('signale, sans bloquer : D2.2 le donne en avertissement', () => {
    const r = auditSentenceLength(siteAvecTexteLibre(mots(40)), CHARTE);
    expect(r.findings[0]?.severity).toBe('warning');
  });

  it('rend une anomalie par phrase, avec son rang', () => {
    // Deux phrases à réécrire sont deux réécritures.
    const texte = `${mots(30)}. Phrase courte. ${mots(28)}.`;
    const r = auditSentenceLength(siteAvecTexteLibre(texte), CHARTE);
    expect(r.findings).toHaveLength(2);
    expect(r.findings.map(f => f.params['sentence_index'])).toEqual([0, 2]);
    expect(r.findings.map(f => f.params['words'])).toEqual([30, 28]);
  });

  it('compte un texte sans ponctuation finale comme une seule phrase', () => {
    // Une note de trente mots sans point reste une note de trente mots.
    const r = auditSentenceLength(siteAvecTexteLibre(mots(30)), CHARTE);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.params['words']).toBe(30);
  });

  it('ne juge pas les dénominations du site, qui ne sont pas des phrases', () => {
    // Le modèle ne porte ni cartouche ni note ; le texte libre est ce qui s'en
    // approche. Opposer une règle de phrase à une dénomination signalerait une
    // longueur là où il n'y a pas de rédaction.
    const premiere = refMultilevel.destination_names[0];
    if (premiere === undefined) throw new Error('aucune dénomination');
    const site: SiteData = {
      ...refMultilevel,
      destination_names: [{ ...premiere, value: mots(40) }],
    };
    expect(auditSentenceLength(site, CHARTE).findings).toHaveLength(0);
  });

  describe('découpage en phrases', () => {
    it('coupe sur les quatre ponctuations finales', () => {
      expect(splitSentences('Un. Deux ! Trois ? Quatre… Cinq'))
        .toEqual(['Un', 'Deux', 'Trois', 'Quatre', 'Cinq']);
    });

    it('ne coupe pas sur un point collé à un chiffre', () => {
      // « 3.5 m » est une mesure, pas une fin de phrase : la coupure exige une
      // espace ou la fin du texte après la ponctuation.
      expect(splitSentences('La rampe fait 3.5 m de large')).toHaveLength(1);
    });

    it('coupe à tort sur une abréviation, et la conséquence est du bon côté', () => {
      // « M. Dupont » compte pour deux phrases. Une phrase coupée trop tôt est
      // plus courte, donc moins signalée : le contrôle sous-estime, il ne
      // sur-signale pas.
      expect(splitSentences('M. Dupont accueille')).toEqual(['M', 'Dupont accueille']);
    });

    it('ignore les blancs et les ponctuations redoublées', () => {
      expect(splitSentences('  Un...   Deux !!  ')).toEqual(['Un', 'Deux']);
      expect(splitSentences('')).toEqual([]);
    });
  });

  describe('comptage des mots', () => {
    it('compte ce que les espaces séparent', () => {
      expect(countWords('un deux trois')).toBe(3);
      expect(countWords('  un\tdeux\n trois  ')).toBe(3);
      expect(countWords('')).toBe(0);
    });
  });

  it('remonte jusqu’à runChecks, aux deux modes', () => {
    for (const mode of ['atelier', 'livrable'] as const) {
      const r = runChecks(siteAvecTexteLibre(mots(40)), VOCABULAIRE, { mode });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.checks_run).toContain('sentence_length');
      expect(r.value.findings.map(f => f.code)).toContain('LAYOUT.SENTENCE_TOO_LONG');
    }
  });

  /**
   * A5.8 — « Quand la charte ne porte pas une règle, le contrôle correspondant
   * ne s'exécute pas et le signale. Il n'applique aucune valeur par défaut. »
   *
   * La phrase de quarante mots est le cas décisif : l'ancienne limite de
   * vingt-cinq l'aurait signalée. Qu'elle passe prouve qu'aucun nombre ne
   * subsiste dans le contrôle.
   */
  it('ne s’exécute pas, et ne signale rien, quand la charte ne porte pas la limite', () => {
    const report = auditSentenceLength(siteAvecTexteLibre(mots(40)), []);
    expect(report.applied).toBe(false);
    expect(report.findings).toEqual([]);
    expect(report.checked_texts).toBeGreaterThan(0);

    const r = runChecks(siteAvecTexteLibre(mots(40)), {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.findings.map(f => f.code)).not.toContain('LAYOUT.SENTENCE_TOO_LONG');
    expect(r.value.checks_undeclared).toContain('sentence_length');
    expect(r.value.checks_run).not.toContain('sentence_length');
  });

  it('retient la plus contraignante de deux limites déclarées', () => {
    // Comme une surcouche pays durcit un socle en D3.6 : retenir la plus
    // permissive laisserait passer ce que la charte interdit ailleurs.
    const deux: readonly CharterRule[] = [
      { kind: 'max_sentence_words', params: { maximum: 30 } },
      { kind: 'max_sentence_words', params: { maximum: 12 } },
    ];
    const r = auditSentenceLength(siteAvecTexteLibre(mots(20)), deux);
    expect(r.applied).toBe(true);
    expect(r.findings[0]?.params['maximum']).toBe(12);
  });

  it('écarte une limite qui n’est pas une limite', () => {
    // Zéro refuserait toute phrase, y compris celles d'un mot. Seule déclarée,
    // elle laisse le contrôle non exercé plutôt que de signaler au nom d'une
    // règle illisible.
    const zero: readonly CharterRule[] = [{ kind: 'max_sentence_words', params: { maximum: 0 } }];
    expect(auditSentenceLength(siteAvecTexteLibre(mots(40)), zero).applied).toBe(false);
  });
});
