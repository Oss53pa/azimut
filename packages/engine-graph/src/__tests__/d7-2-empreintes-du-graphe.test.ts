import { describe, it, expect } from 'vitest';
import { refMinimal } from '@azimut/testkit';
import type { GraphNode, SiteData, TravelProfile } from '@azimut/core-model';
import { computeGraphHash as computeGraphHashOutcome, computeInputsHash as computeInputsHashOutcome } from '../compute-hashes.js';
import { RouteCache } from '../route-cache.js';

/** computeGraphHash déballé : un refus fait échouer l'essai en nommant ses codes. */
function computeGraphHash(...args: Parameters<typeof computeGraphHashOutcome>): string {
  const hash = computeGraphHashOutcome(...args);
  if (!hash.ok) throw new Error(hash.findings.map(f => f.code).join(', '));
  return hash.value;
}

/** computeInputsHash déballé : un refus fait échouer l'essai en nommant ses codes. */
function computeInputsHash(...args: Parameters<typeof computeInputsHashOutcome>): string {
  const hash = computeInputsHashOutcome(...args);
  if (!hash.ok) throw new Error(hash.findings.map(f => f.code).join(', '));
  return hash.value;
}

/**
 * D7.2, version 25 — « Ces règles valent pour toutes les empreintes du
 * produit » : l'empreinte des entrées d'un parcours et celle du graphe qu'une
 * validation enregistre suivent la même forme canonique que l'empreinte de
 * contenu.
 *
 * Les deux premiers essais échouaient sous l'ancienne sérialisation (pas de
 * préfixe, pas de NFC). Les deux derniers passaient déjà : les champs du graphe
 * sont toujours écrits par leur sélecteur, si bien qu'absence et nullité s'y
 * confondaient aussi ; ils gardent la règle, ils ne la démontrent pas.
 */

const profile = refMinimal.travel_profiles[0] as TravelProfile;
const junction = refMinimal.graph.nodes.find(n => n.id === 'n-junction') as GraphNode;

/** refMinimal dont le carrefour est remplacé par `node`. */
function withJunction(node: unknown): SiteData {
  return {
    ...refMinimal,
    graph: {
      ...refMinimal.graph,
      nodes: refMinimal.graph.nodes.map(n => (n.id === junction.id ? node as GraphNode : n)),
    },
  };
}

describe('D7.2 — forme canonique des empreintes du graphe', () => {
  it('porte le préfixe `sha256:` et un condensé hexadécimal minuscule', () => {
    expect(computeGraphHash(refMinimal.graph)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(computeInputsHash(refMinimal, profile)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('normalise les chaînes en NFC : deux écritures d’un même libellé, une empreinte', () => {
    const composed = withJunction({ ...junction, label: 'Entr\u00e9e' });
    const decomposed = withJunction({ ...junction, label: 'Entre\u0301e' });
    expect(computeGraphHash(decomposed.graph)).toBe(computeGraphHash(composed.graph));
    expect(computeInputsHash(decomposed, profile)).toBe(computeInputsHash(composed, profile));
  });

  it('omet un champ absent, et ne distingue pas l’absence d’une valeur nulle', () => {
    const withoutLabel: Record<string, unknown> = { ...junction };
    delete withoutLabel['label'];
    const absent = withJunction(withoutLabel);
    const nul = withJunction({ ...junction, label: null });
    const undef = withJunction({ ...junction, label: undefined });
    expect(computeGraphHash(nul.graph)).toBe(computeGraphHash(absent.graph));
    expect(computeGraphHash(undef.graph)).toBe(computeGraphHash(absent.graph));
    expect(computeInputsHash(nul, profile)).toBe(computeInputsHash(absent, profile));
  });

  it('reste sensible au contenu : un libellé changé change l’empreinte', () => {
    const renamed = withJunction({ ...junction, label: 'Carrefour nord' });
    expect(computeGraphHash(renamed.graph)).not.toBe(computeGraphHash(refMinimal.graph));
  });
});

describe('D2.2 — une valeur non hachable est refusée, jamais écrite nulle', () => {
  const broken = withJunction({ ...junction, position: { x_m: Number.NaN, y_m: 0 } });

  it('l’empreinte du graphe refuse par DATA.HASH_INPUT_INVALID', () => {
    const hash = computeGraphHashOutcome(broken.graph);
    expect(hash.ok).toBe(false);
    if (hash.ok) return;
    expect(hash.findings.map(f => f.code)).toEqual(['DATA.HASH_INPUT_INVALID']);
  });

  it('l’empreinte des entrées refuse, et nomme le site', () => {
    const hash = computeInputsHashOutcome(broken, profile);
    expect(hash.ok).toBe(false);
    if (hash.ok) return;
    expect(hash.findings[0]?.entity).toEqual({ kind: 'site', id: refMinimal.site.id });
  });

  it('le cache de parcours s’appuie sur la même empreinte, et en rend le refus', () => {
    const cache = new RouteCache();
    const from = refMinimal.graph.nodes[0]?.id ?? '';
    const route = cache.computeOrGet(broken, profile, from, from);
    expect(route.ok).toBe(false);
    if (route.ok) return;
    expect(route.findings.map(f => f.code)).toEqual(['DATA.HASH_INPUT_INVALID']);
  });
});
