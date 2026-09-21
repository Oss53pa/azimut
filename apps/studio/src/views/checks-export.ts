import type { Finding } from '@azimut/core-model';

/**
 * Export de l'écran de validation.
 *
 * Il porte deux natures de ligne, et c'est le point : jusqu'ici il ne portait
 * que les anomalies, si bien qu'une validation dont aucun contrôle n'a tourné
 * s'exportait en fichier vide — le même fichier qu'une validation parfaitement
 * propre. Un destinataire qui ne voit que l'export lisait une réussite là où
 * rien n'avait été regardé.
 *
 * Le registre des contrôles part donc avec les anomalies. Une seule table
 * plutôt que deux blocs : un fichier à deux formes se relit mal, et la colonne
 * `record` suffit à trier.
 *
 * `state` porte la sévérité pour une anomalie, l'état pour un contrôle. Les
 * deux répondent à la même question — ce que vaut cette ligne — et les séparer
 * en deux colonnes dont l'une serait toujours vide n'aiderait personne.
 */
export type CheckRoster = {
  readonly run: readonly string[];
  readonly skipped: readonly string[];
  readonly undeclared: readonly string[];
};

export type ExportInput = {
  readonly siteId: string;
  readonly ranAt: string;
  readonly findings: readonly Finding[];
  readonly roster: CheckRoster;
};

const COLUMNS = [
  'site', 'ran_at', 'record', 'code', 'state', 'entity_kind', 'entity_id', 'rule_ref',
] as const;

/**
 * Le point-virgule sépare les colonnes : une valeur qui en contient un, ou un
 * saut de ligne, casserait le fichier. Les valeurs concernées viennent du
 * catalogue et des identifiants, donc n'en portent pas aujourd'hui, mais s'en
 * remettre à cela reviendrait à parier sur la donnée à venir.
 */
function escape(value: string): string {
  return /[;"\n\r]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

function row(cells: readonly string[]): string {
  return cells.map(escape).join(';');
}

export function toChecksCsv(input: ExportInput): string {
  const lines = [row(COLUMNS)];

  for (const finding of input.findings) {
    lines.push(row([
      input.siteId,
      input.ranAt,
      'finding',
      finding.code,
      finding.severity,
      finding.entity?.kind ?? '',
      finding.entity?.id ?? '',
      finding.ruleRef ?? '',
    ]));
  }

  // Ordre fixe des états, puis ordre reçu des contrôles : deux exports du même
  // calcul donnent le même fichier.
  const states: readonly (readonly [string, readonly string[]])[] = [
    ['run', input.roster.run],
    ['skipped', input.roster.skipped],
    ['undeclared', input.roster.undeclared],
  ];
  for (const [state, names] of states) {
    for (const name of names) {
      lines.push(row([input.siteId, input.ranAt, 'check', name, state, '', '', '']));
    }
  }

  return lines.join('\n');
}
