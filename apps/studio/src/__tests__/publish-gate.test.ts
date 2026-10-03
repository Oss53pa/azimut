import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { runChecks } from '@azimut/engine-graph';
import { evaluatePublishGate } from '../publish-gate.js';
import { EMPTY_VOCABULARY_STATE, type VocabularyState } from '../context/site-vocabulary.js';
import type { SiteFact } from '@azimut/core-model';
import { PARKING_CAPACITY_KEY } from '@azimut/core-model';

/**
 * A5.11 — le statut porte sur le fait, non sur l'objet.
 *
 * Ni `zone` ni `footprint` n'en déclarent : la section S8 a retiré les tables
 * de stationnement qui en portaient un. Une capacité annoncée mais non arrêtée
 * est une proposition, et c'est elle qu'un livrable ne peut pas montrer.
 */
const capaciteProposee: SiteFact = {
  key: PARKING_CAPACITY_KEY,
  value: 4,
  status: 'proposal',
  source_ref: 'Détection assistée',
  declared_at: '2026-01-05',
  target: { kind: 'zone', id: 'zone-ml-parking-ouest' },
  forbidden: [],
};

function avecFaits(facts: readonly SiteFact[]): VocabularyState {
  return {
    ...EMPTY_VOCABULARY_STATE,
    vocabulary: { ...EMPTY_VOCABULARY_STATE.vocabulary, facts: [...facts] },
  };
}

const ETAT_PROPOSITION = avecFaits([capaciteProposee]);

function codes(findings: readonly { code: string }[]): readonly string[] {
  return findings.map(f => f.code);
}

describe('porte de publication', () => {
  it('pose la question dans le mode du livrable, et non dans celui de l’atelier', () => {
    // La même donnée, les deux modes. À l'atelier une proposition est un état
    // de travail légitime ; portée à un livrable elle s'afficherait comme un
    // fait, et la règle M01.S11 la refuse. Le bouton « Publier » doit lire la seconde
    // réponse, pas la première.
    const atelier = runChecks(refMultilevel, ETAT_PROPOSITION.vocabulary);
    expect(atelier.ok).toBe(true);
    if (!atelier.ok) return;
    expect(codes(atelier.value.findings)).not.toContain('PARK.PROPOSAL_AS_EXISTING');

    const gate = evaluatePublishGate(refMultilevel, ETAT_PROPOSITION);
    expect(codes(gate.findings)).toContain('PARK.PROPOSAL_AS_EXISTING');
    expect(codes(gate.blocking)).toContain('PARK.PROPOSAL_AS_EXISTING');
    expect(gate.publishable).toBe(false);
  });

  it('laisse passer un site dont les faits sont arrêtés', () => {
    const arrete = avecFaits([{ ...capaciteProposee, status: 'existing' }]);
    const gate = evaluatePublishGate(refMultilevel, arrete);
    expect(codes(gate.blocking)).not.toContain('PARK.PROPOSAL_AS_EXISTING');
  });

  it('refuse tant que le vocabulaire n’a pas été lu', () => {
    // Un registre illisible porte la même valeur qu'un registre vide et ne dit
    // pas la même chose. Publier sur cette valeur, c'est publier à l'aveugle :
    // la valeur inconnue tombe du côté qui ne publie pas.
    const echec: VocabularyState = { ...EMPTY_VOCABULARY_STATE, status: 'failed' };
    const gate = evaluatePublishGate(refMultilevel, echec);
    expect(gate.vocabularyRefusal).toBe('failed');
    expect(gate.publishable).toBe(false);
  });

  it('refuse aussi pendant la lecture, sans la confondre avec un échec', () => {
    const enCours: VocabularyState = { ...EMPTY_VOCABULARY_STATE, status: 'loading' };
    const gate = evaluatePublishGate(refMultilevel, enCours);
    expect(gate.vocabularyRefusal).toBe('loading');
    expect(gate.publishable).toBe(false);
  });

  it('nomme les contrôles non exercés sans pour autant fermer la porte', () => {
    // « Aucune anomalie bloquante » et « tout a été contrôlé » ne sont pas la
    // même phrase. Décider qu'un paquet de règles manquant interdit de publier
    // relève de A2.2 : la porte les rend, elle ne tranche pas.
    const gate = evaluatePublishGate(refMultilevel, EMPTY_VOCABULARY_STATE);
    expect(gate.unchecked.length).toBeGreaterThan(0);
    expect(gate.publishable).toBe(gate.blocking.length === 0);
  });
});
