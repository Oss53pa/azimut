import type { BindingValues, BoundParagraph, Finding } from '@azimut/core-model';
import { literalNumbers, resolveBoundParagraph } from '@azimut/core-model';

/**
 * Contrôle du texte lié d'un document — complément atelier, M15.
 *
 * Deux anomalies de nature opposée. La première dit qu'une liaison n'a pas de
 * valeur : le paragraphe ne se rend pas, c'est bloquant. La seconde dit qu'un
 * nombre est écrit à la main là où une liaison est attendue : c'est un
 * avertissement, parce que tous les chiffres d'un texte ne sont pas des données
 * du site.
 *
 * Elles se répondent : la première refuse un document troué, la seconde refuse
 * qu'on le bouche en recopiant la valeur dans la phrase.
 */
export type DocumentTextReport = {
  readonly paragraph_count: number;
  readonly rendered: readonly { readonly id: string; readonly text: string }[];
  readonly findings: readonly Finding[];
};

export function auditBoundText(
  paragraphs: readonly BoundParagraph[],
  values: BindingValues,
): DocumentTextReport {
  const ordered = [...paragraphs].sort((l, r) => l.id.localeCompare(r.id));
  const findings: Finding[] = [];
  const rendered: { id: string; text: string }[] = [];

  for (const paragraph of ordered) {
    const result = resolveBoundParagraph(paragraph, values);

    if (result.ok) {
      rendered.push({ id: result.id, text: result.text });
    } else {
      for (const binding of result.missing) {
        findings.push({
          code: 'DOC.BINDING_UNRESOLVED',
          severity: 'blocking',
          entity: { kind: 'paragraph', id: paragraph.id },
          params: { source: binding.source, field: binding.field },
          ruleRef: 'atelier-M15',
        });
      }
    }

    const numbers = literalNumbers(paragraph);
    if (numbers.length > 0) {
      findings.push({
        code: 'DOC.LITERAL_NUMBER',
        severity: 'warning',
        entity: { kind: 'paragraph', id: paragraph.id },
        // Les nombres vus, pour que le rédacteur juge sans relire la phrase.
        params: { numbers: numbers.join(', '), count: numbers.length },
        ruleRef: 'atelier-M15',
      });
    }
  }

  return { paragraph_count: ordered.length, rendered, findings };
}
