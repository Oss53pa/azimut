import { describe, it, expect } from 'vitest';
import { buildCommand } from '@azimut/core-model';
import { guardCharterOnSafety } from '@azimut/engine-graph';
import { refMinimal } from '@azimut/testkit';
import type { CommandDraft, Outcome, Finding } from '@azimut/core-model';

/**
 * INV-3 — « Aucune charte client ne peut modifier une couleur, une géométrie,
 * un pictogramme ou une proportion relevant du registre de sécurité. Le moteur
 * refuse l'opération et lève une erreur. Il n'avertit pas, il ne dégrade pas,
 * il refuse. »
 *
 * N4.7, critère 3 : « Toute tentative de modification du registre de sécurité
 * échoue, **un test par voie de contournement**. »
 *
 * **Ce que cet essai ferme.** L'invariant n'était appliqué que sur le chemin de
 * la charte. Les trois gardes de la bibliothèque — création, modification,
 * suppression — existaient, étaient éprouvés un par un, et **rien ne les
 * appelait**. Le garde de câblage ne le voyait pas, parce qu'il tient un
 * ré-export de baril pour un appelant. Le registre était donc protégé à
 * moitié, et c'est la moitié la moins évidente qui manquait.
 *
 * Il est désormais appliqué au passage obligé de toute écriture,
 * `buildCommand` (M12.A2). Cet essai emprunte chaque voie, une par une, et
 * vérifie qu'aucune n'arrive.
 */

/** Une commande bien formée sur `pictogram`, à détourner ensuite. */
function commande(partiel: Partial<CommandDraft>): CommandDraft {
  return {
    operation: 'update',
    module: '04-signaletique',
    table: 'pictogram',
    id: 'picto-sortie-secours',
    org_id: 'org-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    ...partiel,
  };
}

function refus(outcome: Outcome<unknown>): readonly Finding[] {
  expect(outcome.ok, 'la commande a été acceptée').toBe(false);
  return outcome.ok ? [] : outcome.findings;
}

function codes(outcome: Outcome<unknown>): readonly string[] {
  return refus(outcome).map(f => f.code);
}

describe('INV-3 — le registre de sécurité refuse chaque voie de contournement', () => {
  it('voie 1 : créer un pictogramme dans le registre de sécurité', () => {
    const findings = refus(buildCommand(commande({
      operation: 'create',
      after: { registry: 'safety', code: 'E001', svg_path: 'M0 0' },
    })));
    expect(findings.map(f => f.code)).toContain('SECURITY.REGISTRY_WRITE_DENIED');
    expect(findings[0]?.ruleRef).toBe('INV-3');
    expect(findings[0]?.severity).toBe('blocking');
  });

  it('voie 2 : modifier un pictogramme qui s’y trouve', () => {
    expect(codes(buildCommand(commande({
      before: { registry: 'safety', svg_path: 'M0 0' },
      after: { registry: 'safety', svg_path: 'M1 1' },
    })))).toContain('SECURITY.REGISTRY_WRITE_DENIED');
  });

  it('voie 3 : y faire entrer un pictogramme d’orientation', () => {
    // La voie la moins évidente. Un garde qui ne lirait que l'état antérieur
    // verrait un pictogramme d'orientation et laisserait passer ; la ligne
    // serait alors dans le registre de sécurité sans jamais y être entrée par
    // une création.
    expect(codes(buildCommand(commande({
      before: { registry: 'wayfinding', svg_path: 'M0 0' },
      after: { registry: 'safety', svg_path: 'M0 0' },
    })))).toContain('SECURITY.REGISTRY_WRITE_DENIED');
  });

  it('voie 4 : l’en faire sortir pour le modifier ensuite', () => {
    // Le symétrique de la précédente, et tout aussi dangereux : un pictogramme
    // normalisé déclassé en pictogramme d'orientation devient modifiable.
    expect(codes(buildCommand(commande({
      before: { registry: 'safety', svg_path: 'M0 0' },
      after: { registry: 'wayfinding', svg_path: 'M0 0' },
    })))).toContain('SECURITY.REGISTRY_WRITE_DENIED');
  });

  it('voie 5 : supprimer un pictogramme qui s’y trouve', () => {
    expect(codes(buildCommand(commande({
      operation: 'delete',
      before: { registry: 'safety', svg_path: 'M0 0' },
    })))).toContain('SECURITY.REGISTRY_WRITE_DENIED');
  });

  it('voie 6 : ne pas déclarer le registre du tout', () => {
    // La voie la plus simple de toutes, si rien ne la ferme : une commande qui
    // omet la colonne ne dit pas ce qu'elle touche. A7 tranche — un moteur qui
    // reçoit une entrée qu'il ne peut pas traiter refuse.
    const findings = refus(buildCommand(commande({
      before: { svg_path: 'M0 0' },
      after: { svg_path: 'M1 1' },
    })));
    expect(findings.map(f => f.code)).toContain('SECURITY.REGISTRY_WRITE_DENIED');
    expect(findings.some(f => f.params['fault'] === 'registry_undeclared')).toBe(true);
  });

  it('voie 7 : déclarer un registre que le modèle ne connaît pas', () => {
    // « safety_ » ou « SAFETY » ne sont pas des registres. Les traiter comme
    // inconnus, donc refusés, est le sens strict : une valeur que le code ne
    // comprend pas ne doit pas ouvrir l'écriture.
    for (const registry of ['SAFETY', 'safety ', 'securite', '']) {
      expect(codes(buildCommand(commande({
        before: { registry, svg_path: 'M0 0' },
        after: { registry, svg_path: 'M1 1' },
      }))), `registre « ${registry} » accepté`)
        .toContain('SECURITY.REGISTRY_WRITE_DENIED');
    }
  });

  it('voie 8 : passer par une charte, sur chacune des quatre natures', () => {
    // La seule voie qui était déjà fermée. Elle reste éprouvée ici pour que
    // les huit tiennent au même endroit : c'est la liste qui fait la preuve,
    // pas chaque essai pris à part.
    //
    // T-2.6 exige un essai par nature de tentative, et INV-3 les nomme :
    // « une couleur, une géométrie, un pictogramme ou une proportion ».
    for (const change_kind of ['color', 'geometry', 'pictogram', 'proportion'] as const) {
      expect(codes(guardCharterOnSafety(refMinimal, [{
        target_id: 'picto-sortie-secours',
        target_registry: 'safety',
        change_kind,
        field: 'fill',
        value: 'charte',
      }])), `nature « ${change_kind} » acceptée`)
        .toContain('SECURITY.CHARTER_OVERRIDE_DENIED');
    }
  });

  /**
   * Le contre-exemple. Sans lui, un garde qui refuserait toute écriture sur
   * `pictogram` passerait les huit essais ci-dessus, et le registre
   * d'orientation deviendrait inutilisable — la partie J en fait pourtant le
   * lieu où l'éditeur travaille.
   */
  it('mais laisse passer le registre d’orientation, que J5.1 ouvre', () => {
    for (const draft of [
      commande({ operation: 'create', after: { registry: 'wayfinding', code: 'W1' } }),
      commande({
        before: { registry: 'wayfinding', svg_path: 'M0 0' },
        after: { registry: 'wayfinding', svg_path: 'M1 1' },
      }),
      commande({ operation: 'delete', before: { registry: 'wayfinding', svg_path: 'M0 0' } }),
    ]) {
      expect(buildCommand(draft).ok, `${draft.operation} refusée à tort`).toBe(true);
    }
  });

  it('et ne juge pas les tables qu’INV-3 ne protège pas', () => {
    // Une colonne `registry` existe aussi sur `support` et `support_typology`.
    // Le garde ne porte que sur les pictogrammes : l'étendre en silence
    // bloquerait l'implantation d'un support de sécurité, que rien n'interdit.
    const r = buildCommand({
      operation: 'update',
      module: '02-wayfinding',
      table: 'support',
      id: 'sup-1',
      org_id: 'org-1',
      timestamp: '2026-01-01T00:00:00.000Z',
      before: { azimuth_deg: 0 },
      after: { azimuth_deg: 90 },
    });
    expect(r.ok).toBe(true);
  });
});
