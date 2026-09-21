import { describe, it, expect } from 'vitest';
import {
  auditSentenceLength, splitSentences, countWords, MAX_WORDS_PER_SENTENCE,
} from '../audit-sentence-length.js';
import { runChecks } from '../run-checks.js';
import { refMultilevel } from '@azimut/testkit';
import type { SiteData } from '@azimut/core-model';

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

describe('QC-20 (complément atelier) — rédaction trop longue', () => {
  it('ne signale rien sur les sites de référence', () => {
    // Le contrôle naît sans rien à dire ; sans cette vérification, une panne
    // aurait l'air d'une vertu.
    const report = auditSentenceLength(refMultilevel);
    expect(report.findings).toHaveLength(0);
  });

  it('admet la phrase au seuil et signale celle qui le dépasse', () => {
    expect(auditSentenceLength(siteAvecTexteLibre(mots(MAX_WORDS_PER_SENTENCE))).findings)
      .toHaveLength(0);
    const r = auditSentenceLength(siteAvecTexteLibre(mots(MAX_WORDS_PER_SENTENCE + 1)));
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.code).toBe('LAYOUT.SENTENCE_TOO_LONG');
    expect(r.findings[0]?.params['words']).toBe(MAX_WORDS_PER_SENTENCE + 1);
    expect(r.findings[0]?.params['maximum']).toBe(MAX_WORDS_PER_SENTENCE);
    expect(r.findings[0]?.ruleRef).toBe('atelier-QC-20');
  });

  it('signale, sans bloquer : QC-20 est signalant', () => {
    const r = auditSentenceLength(siteAvecTexteLibre(mots(40)));
    expect(r.findings[0]?.severity).toBe('warning');
  });

  it('rend une anomalie par phrase, avec son rang', () => {
    // Deux phrases à réécrire sont deux réécritures.
    const texte = `${mots(30)}. Phrase courte. ${mots(28)}.`;
    const r = auditSentenceLength(siteAvecTexteLibre(texte));
    expect(r.findings).toHaveLength(2);
    expect(r.findings.map(f => f.params['sentence_index'])).toEqual([0, 2]);
    expect(r.findings.map(f => f.params['words'])).toEqual([30, 28]);
  });

  it('compte un texte sans ponctuation finale comme une seule phrase', () => {
    // Une note de trente mots sans point reste une note de trente mots.
    const r = auditSentenceLength(siteAvecTexteLibre(mots(30)));
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
    expect(auditSentenceLength(site).findings).toHaveLength(0);
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
      const r = runChecks(siteAvecTexteLibre(mots(40)), {}, { mode });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.checks_run).toContain('sentence_length');
      expect(r.value.findings.map(f => f.code)).toContain('LAYOUT.SENTENCE_TOO_LONG');
    }
  });
});
