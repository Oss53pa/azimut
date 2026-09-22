import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guardAdRulesPack } from '@azimut/engine-graph';
import { receiveCreatives } from '../../../domain/ad-creative-intake.js';
import {
  DEMO_AD_RULES_PACK, DEMO_CREATIVES, DEMO_CREATIVE_SPEC,
} from '../../../domain/demo/commerce.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const VIEW = readFileSync(resolve(HERE, '..', '..', 'AdvertisingView.tsx'), 'utf8');

/**
 * N5.2 — M05.R5 et M05.R7 branchés sur le module 05.
 *
 * Les deux moteurs existaient sans que rien ne les appelle. Ce fichier garde
 * l'appel : un test sur la seule fonction repasserait au vert le jour où
 * l'écran cesserait de l'employer.
 */
describe('M05.R7 — le paquet de règles publicitaires', () => {
  it('manque, et le jeu d’essai n’en invente pas', () => {
    // N5.7 : le corpus par pays n'existe pas. En attacher un ici inventerait
    // ce que M05.R7 interdit d'inventer.
    expect(DEMO_AD_RULES_PACK).toBeNull();
  });

  it('lève AD.RULES_PACK_MISSING sur le jeu d’essai', () => {
    const result = guardAdRulesPack(DEMO_AD_RULES_PACK);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.findings[0]?.code).toBe('AD.RULES_PACK_MISSING');
    expect(result.findings[0]?.severity).toBe('blocking');
    expect(result.findings[0]?.params['reason']).toBe('not_attached');
  });

  it('est interrogé par l’écran', () => {
    expect(VIEW).toContain('guardAdRulesPack');
  });
});

describe('M05.R5 — l’assainissement passe sur les visuels reçus', () => {
  const intakes = receiveCreatives(DEMO_CREATIVES, DEMO_CREATIVE_SPEC);

  it('constate chaque visuel du jeu d’essai', () => {
    expect(intakes).toHaveLength(DEMO_CREATIVES.length);
  });

  it('couvre les deux chemins : assaini ici, remis au serveur', () => {
    const states = new Set(intakes.map(i => i.sanitation));
    expect(states.has('clean')).toBe(true);
    expect(states.has('deferred')).toBe(true);
  });

  it('stocke un SVG débarrassé de ce qu’il portait', () => {
    const dirty = intakes.find(i => i.creative_id === 'cr-0261');
    expect(dirty?.sanitation).toBe('clean');
    expect(dirty?.clean_svg).toBeDefined();
    expect(dirty?.clean_svg).not.toContain('<script');
    expect(dirty?.clean_svg).not.toContain('onclick');
    expect(dirty?.clean_svg).not.toContain('<metadata');
    expect(dirty?.clean_svg).not.toContain('exemple.invalide');
  });

  it('ne tient aucun visuel binaire pour rendable', () => {
    for (const intake of intakes.filter(i => i.sanitation === 'deferred')) {
      expect(intake.renderable).toBe(false);
    }
  });

  it('garde les écarts de fiche technique d’un visuel binaire', () => {
    // cr-0255 : cinq axes hors fiche. L'assainissement remis au serveur ne
    // dispense pas des contrôles techniques, qui portent sur des métadonnées.
    const off = intakes.find(i => i.creative_id === 'cr-0255');
    expect(off?.findings.map(f => f.params['axis'])).toEqual([
      'format', 'resolution', 'safe_zone', 'color_profile', 'weight',
    ]);
  });

  it('est employé par l’écran', () => {
    expect(VIEW).toContain('receiveCreatives');
  });
});
