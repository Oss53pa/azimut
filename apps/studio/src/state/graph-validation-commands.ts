/**
 * A5.3 — l'enregistrement d'un passage de la validation de complétude.
 *
 * M5 (partie M) : « Relancer | Recalcule, affiche la durée réelle, enregistre
 * le passage dans `graph_validation`. » Jusqu'ici le résultat mourait avec la
 * session, et la règle M02.W11 n'avait rien à lire.
 *
 * Ce module traduit, il ne juge pas. Ce qu'il refuse, il le refuse parce que
 * le modèle d'A5.3 l'exige, jamais parce qu'il apprécierait le résultat.
 */
import type { EntityCommand, Finding, Outcome } from '@azimut/core-model';
import { buildCommand } from '@azimut/core-model';

const MODULE = '01-socle';

export type ValidationWrite = {
  readonly orgId: string;
  readonly siteId: string;
  /** Identifiant de la ligne, tiré par l'appelant. */
  readonly id: string;
  /** ISO-8601, fourni par l'appelant (E5.1). C'est aussi `ran_at`. */
  readonly timestamp: string;
  /** D7.2 — l'empreinte du graphe validé, sans profil. */
  readonly graphHash: string;
};

/**
 * La commande d'écriture d'un passage.
 *
 * Aucune mise à jour, aucune suppression : la table est en insertion seule
 * (A12.3), et la base le refuserait de toute façon. La commande ne porte donc
 * qu'une création, et son inverse — que le motif de commande exige calculable
 * — est vide de sens ici. C'est assumé : un passage de validation est un fait
 * daté, pas un état qu'on modifie.
 */
export function writeGraphValidation(
  findings: readonly Finding[],
  write: ValidationWrite,
): Outcome<EntityCommand> {
  if (write.graphHash.trim() === '') {
    return {
      ok: false,
      findings: [{
        code: 'EDIT.COMMAND_SHAPE_INVALID',
        severity: 'blocking',
        entity: { kind: 'graph_validation', id: write.id },
        params: { field: 'graphHash' },
        ruleRef: 'A5.3',
      }],
    };
  }

  const blocking = findings.filter(f => f.severity === 'blocking');
  const warnings = findings.filter(f => f.severity !== 'blocking');

  return buildCommand({
    operation: 'create',
    module: MODULE,
    table: 'graph_validation',
    id: write.id,
    org_id: write.orgId,
    after: {
      id: write.id,
      org_id: write.orgId,
      site_id: write.siteId,
      graph_hash: write.graphHash,
      ran_at: write.timestamp,
      // La contrainte de base lie les deux : un passage sans anomalie
      // bloquante est passé, et réciproquement.
      passed: blocking.length === 0,
      blocking_count: blocking.length,
      warning_count: warnings.length,
      findings: JSON.stringify([...findings]),
    },
    timestamp: write.timestamp,
    groupKey: null,
  });
}

/**
 * M02.W11 — la validation de complétude est-elle passée pour ce graphe ?
 *
 * « Le dernier enregistrement de `graph_validation` du site est passé et porte
 * l'empreinte du graphe actuel. Une validation obtenue avant une modification
 * du graphe ne vaut pas. »
 *
 * Les deux conditions comptent. Le seul dernier passage ne suffit pas : un
 * graphe modifié après une validation réussie reste non validé, et c'est
 * l'empreinte qui le dit.
 */
export type ValidationRecord = {
  readonly graphHash: string;
  readonly ranAt: string;
  readonly passed: boolean;
};

export function graphIsValidated(
  records: readonly ValidationRecord[],
  currentGraphHash: string,
): boolean {
  const latest = [...records].sort((a, b) => b.ranAt.localeCompare(a.ranAt))[0];
  if (latest === undefined) return false;
  return latest.passed && latest.graphHash === currentGraphHash;
}
