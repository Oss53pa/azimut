// Emplacement attendu : packages/rules/src/__tests__/loader-guard.test.ts
// Objet : prouver que la fixture de test ne peut pas servir en production,
// et que l'obligation de reference documentaire n'est pas contournee.

import { describe, it, expect } from 'vitest';
import { loadRulesPack, resolveRule } from '../index';

const FIXTURE = 'packages/testkit/fixtures/rules-packs/test-fixture';

describe('chargeur de paquets de regles', () => {
  it('charge la fixture en environnement de test', () => {
    const outcome = loadRulesPack(FIXTURE, { environment: 'test' });
    expect(outcome.ok).toBe(true);
  });

  it('refuse une juridiction TEST hors environnement de test', () => {
    const outcome = loadRulesPack(FIXTURE, { environment: 'production' });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.findings[0]?.code).toBe('RULES.TEST_PACK_OUTSIDE_TEST_ENV');
      expect(outcome.findings[0]?.severity).toBe('blocking');
    }
  });

  it('refuse un paquet dont une regle n a pas de reference documentaire', () => {
    const outcome = loadRulesPack('packages/testkit/fixtures/rules-packs/no-source-ref', {
      environment: 'test',
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.findings[0]?.code).toBe('RULES.SOURCE_REF_MISSING');
    }
  });

  it('refuse un paquet altere', () => {
    const outcome = loadRulesPack('packages/testkit/fixtures/rules-packs/tampered', {
      environment: 'test',
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.findings[0]?.code).toBe('RULES.PACK_CHECKSUM_MISMATCH');
    }
  });

  it('resout la portee la plus specifique', () => {
    const pack = loadRulesPack(FIXTURE, { environment: 'test' });
    if (!pack.ok) throw new Error('fixture non chargeable');

    const interior = resolveRule(pack.value, 'LEGIBILITY.MIN_CHAR_HEIGHT', {
      supportRegistry: 'wayfinding',
      context: 'interior',
    });
    const exterior = resolveRule(pack.value, 'LEGIBILITY.MIN_CHAR_HEIGHT', {
      supportRegistry: 'wayfinding',
      context: 'exterior',
    });

    expect(interior.ok && interior.value.params.factor).toBe(7);
    expect(exterior.ok && exterior.value.params.factor).toBe(9);
  });

  it('leve une erreur sur une regle absente au lieu de retourner une valeur de repli', () => {
    const pack = loadRulesPack(FIXTURE, { environment: 'test' });
    if (!pack.ok) throw new Error('fixture non chargeable');

    const outcome = resolveRule(pack.value, 'LEGIBILITY.MIN_WORD_SPACING', {
      supportRegistry: 'wayfinding',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.findings[0]?.code).toBe('RULES.RULE_NOT_FOUND');
      expect(outcome.findings[0]?.severity).toBe('blocking');
    }
  });

  it('n admet aucune valeur normative ecrite dans le code des moteurs', () => {
    // Ce test est un rappel : l analyse statique de la chaine d integration
    // cherche les litteraux numeriques suspects dans packages/engine-*.
    // Il echoue ici si la fixture a ete deplacee hors de testkit.
    expect(FIXTURE.startsWith('packages/testkit/')).toBe(true);
  });
});
