import type {
  BindingCatalogue, BindingValues, BoundParagraph, Finding,
} from '@azimut/core-model';
import { literalNumbers, resolveBoundParagraph } from '@azimut/core-model';

/**
 * Contrôle du texte lié d'un document — complément atelier, M15.
 *
 * Trois anomalies. La liaison qui désigne un champ inexistant est une faute du
 * document ; celle qui désigne un champ vide est une donnée qui manque ; le
 * nombre écrit à la main est une valeur recopiée. Les deux premières bloquent,
 * la troisième avertit.
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
  catalogue?: BindingCatalogue,
): DocumentTextReport {
  const ordered = [...paragraphs].sort((l, r) => l.id.localeCompare(r.id));
  const findings: Finding[] = [];
  const rendered: { id: string; text: string }[] = [];

  for (const paragraph of ordered) {
    const result = resolveBoundParagraph(paragraph, values, catalogue);

    if (result.ok) {
      rendered.push({ id: result.id, text: result.text });
    } else {
      for (const missing of result.missing) {
        findings.push({
          // Deux causes, deux gestes : corriger le document, ou saisir la
          // donnée. Un seul code enverrait la moitié des lecteurs au mauvais
          // endroit.
          code: missing.cause === 'unknown'
            ? 'DOC.BINDING_UNKNOWN'
            : 'DOC.BINDING_UNRESOLVED',
          severity: 'blocking',
          entity: { kind: 'paragraph', id: paragraph.id },
          params: {
            source: missing.binding.source,
            field: missing.binding.field,
          },
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
