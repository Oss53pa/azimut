/**
 * S6.5 — rejouer la validation du graphe après chaque propagation, et nommer
 * les commandes qui ont introduit une incohérence (S-21 ; décision Q5).
 *
 * La validation complète est rejouée sur la portée de la session, avant et
 * après les commandes reçues : seules les anomalies bloquantes apparues avec
 * elles sont retenues. Une anomalie retenue le reste tant que la dernière
 * validation la montre, et tombe dès qu'une propagation suivante l'a résolue.
 *
 * La publication n'a pas à être fermée ici : l'émission du tableau des
 * messages exige déjà un passage de validation réussi pour l'empreinte
 * actuelle du graphe (M02.W11), qu'une propagation qui touche le graphe
 * change. Ce crochet dit pourquoi, et à cause de quelles commandes.
 */
import { useCallback, useState } from 'react';
import type { Finding } from '@azimut/core-model';
import { validateGraph } from '@azimut/engine-graph';
import { graphScopeFromSession } from '../state/session-scope.js';
import type { SessionState } from '../state/session-store.js';
import { introducedBy } from '../state/propagation-findings.js';
import type { JournalEntry } from '../state/journal-follower.js';

function blockingOf(state: SessionState): readonly Finding[] {
  const outcome = validateGraph(graphScopeFromSession(state).scope);
  return (outcome.ok ? outcome.warnings : outcome.findings).filter(f => f.severity === 'blocking');
}

const keyOf = (f: Finding): string =>
  JSON.stringify([f.code, f.entity?.kind ?? null, f.entity?.id ?? null]);

export function usePropagationCheck(): {
  readonly findings: readonly Finding[];
  readonly onReceived: (before: SessionState, after: SessionState, received: readonly JournalEntry[]) => void;
} {
  const [findings, setFindings] = useState<readonly Finding[]>([]);

  const onReceived = useCallback((
    before: SessionState, after: SessionState, received: readonly JournalEntry[],
  ): void => {
    const now = blockingOf(after);
    const fresh = introducedBy(blockingOf(before), now, received);
    const still = new Set(now.map(keyOf));
    setFindings(previous => [
      ...previous.filter(f => still.has(keyOf(f)) && !fresh.some(n => keyOf(n) === keyOf(f))),
      ...fresh,
    ]);
  }, []);

  return { findings, onReceived };
}
