/**
 * S6.5 — S-21 : « La validation de complétude du graphe est rejouée après
 * chaque propagation. Un état incohérent bloque la publication et nomme les
 * commandes en cause. »
 *
 * Ce module compare les anomalies bloquantes d'avant et d'après une
 * propagation, et attribue chaque anomalie nouvelle aux commandes reçues qui
 * en touchent l'objet. Pur : ni horloge, ni réseau.
 *
 * Décision Q5 d'Oss53pa : aucun code nouveau ; l'anomalie garde son code et
 * porte en paramètre les commandes en cause. Une commande s'identifie par son
 * numéro au journal du site, le seul identifiant qui soit le sien : son champ
 * `id` est celui de la ligne qu'elle modifie.
 *
 * Une commande touche l'objet d'une anomalie si elle porte sur cette ligne, ou
 * si l'une de ses valeurs la cite (une arête dont une extrémité est le nœud
 * en cause). Si aucune ne le touche, l'anomalie est attribuée au lot entier :
 * elle est apparue avec lui, et la taire serait pire que d'en dire trop.
 */
import type { EntityCommand, Finding } from '@azimut/core-model';

export type ReceivedCommand = {
  /** Numéro de la commande au journal du site. */
  readonly seq: number;
  readonly command: EntityCommand;
};

/** Paramètre portant les numéros des commandes en cause, séparés par des virgules. */
export const CAUSE_PARAM = 'commands';

function keyOf(finding: Finding): string {
  return JSON.stringify([finding.code, finding.entity?.kind ?? null, finding.entity?.id ?? null, finding.params]);
}

function cites(command: EntityCommand, id: string): boolean {
  if (command.id === id) return true;
  const values = [command.before, command.after];
  return values.some(row => row !== null && Object.values(row).some(v => v === id));
}

/**
 * Les anomalies bloquantes apparues avec la propagation, chacune portant en
 * paramètre les commandes en cause. Celles qui existaient déjà ne sont pas
 * rendues : la propagation ne les a pas causées.
 */
export function introducedBy(
  before: readonly Finding[],
  after: readonly Finding[],
  received: readonly ReceivedCommand[],
): readonly Finding[] {
  if (received.length === 0) return [];
  const known = new Set(before.filter(f => f.severity === 'blocking').map(keyOf));
  const all = [...received].sort((a, b) => a.seq - b.seq).map(r => r.seq);
  return after
    .filter(f => f.severity === 'blocking' && !known.has(keyOf(f)))
    .map(finding => {
      const id = finding.entity?.id;
      const touching = id === undefined
        ? []
        : received.filter(r => cites(r.command, id)).map(r => r.seq).sort((a, b) => a - b);
      const causes = touching.length > 0 ? touching : all;
      return { ...finding, params: { ...finding.params, [CAUSE_PARAM]: causes.join(',') } };
    });
}

/** Les numéros des commandes en cause, sans doublon, dans l'ordre du journal. */
export function causesOf(findings: readonly Finding[]): string {
  const seqs = new Set<number>();
  for (const f of findings) {
    for (const part of String(f.params[CAUSE_PARAM] ?? '').split(',')) {
      const n = Number(part);
      if (Number.isSafeInteger(n) && n > 0) seqs.add(n);
    }
  }
  return [...seqs].sort((a, b) => a - b).join(', ');
}
