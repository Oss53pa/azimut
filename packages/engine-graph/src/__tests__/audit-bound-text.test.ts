import { describe, it, expect } from 'vitest';
import type { BoundParagraph, BindingValues } from '@azimut/core-model';
import { auditBoundText } from '../audit-bound-text.js';

const VALEURS: BindingValues = { parking: { capacity: '89' } };

const LIE: BoundParagraph = {
  id: 'p-b',
  segments: [
    { kind: 'literal', text: 'Le parking compte ' },
    { kind: 'bound', binding: { source: 'parking', field: 'capacity' } },
    { kind: 'literal', text: ' places.' },
  ],
};

const RECOPIE: BoundParagraph = {
  id: 'p-a',
  segments: [{ kind: 'literal', text: 'Le parking compte 89 places.' }],
};

describe('auditBoundText (M15)', () => {
  it('rend un paragraphe lié sans rien signaler', () => {
    const r = auditBoundText([LIE], VALEURS);
    expect(r.findings).toEqual([]);
    expect(r.rendered[0]?.text).toBe('Le parking compte 89 places.');
  });

  it('avertit sur un nombre recopié, et rend quand même', () => {
    // Le texte est juste aujourd'hui ; il sera faux au prochain relevé.
    const r = auditBoundText([RECOPIE], VALEURS);
    expect(r.findings[0]?.code).toBe('DOC.LITERAL_NUMBER');
    expect(r.findings[0]?.severity).toBe('warning');
    expect(r.findings[0]?.params['numbers']).toBe('89');
    expect(r.rendered).toHaveLength(1);
  });

  it('bloque et ne rend rien quand une liaison manque', () => {
    const r = auditBoundText([LIE], {});
    expect(r.findings[0]?.code).toBe('DOC.BINDING_UNRESOLVED');
    expect(r.findings[0]?.severity).toBe('blocking');
    expect(r.findings[0]?.params['field']).toBe('capacity');
    expect(r.rendered).toEqual([]);
  });

  it('les deux anomalies se répondent : le trou bloque, le bouchon avertit', () => {
    const r = auditBoundText([LIE, RECOPIE], {});
    const codes = r.findings.map(f => f.code);
    expect(codes).toContain('DOC.BINDING_UNRESOLVED');
    expect(codes).toContain('DOC.LITERAL_NUMBER');
  });

  it('parcourt les paragraphes par identifiant', () => {
    const r = auditBoundText([LIE, RECOPIE], VALEURS);
    expect(r.findings[0]?.entity?.id).toBe('p-a');
    expect(r.paragraph_count).toBe(2);
  });

  it('est déterministe', () => {
    expect(JSON.stringify(auditBoundText([LIE, RECOPIE], VALEURS)))
      .toBe(JSON.stringify(auditBoundText([RECOPIE, LIE], VALEURS)));
  });
});
