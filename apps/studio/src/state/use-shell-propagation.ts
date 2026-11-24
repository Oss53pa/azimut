/**
 * S6.5, S-21 — la coquille relit le site quand d'autres postes écrivent
 * (S6.6c) ; la porte de publication (`publish-gate.ts`) rejoue alors la
 * validation sur le site relu. Ce crochet dit, en plus, quelles commandes
 * reçues ont introduit une anomalie bloquante du graphe.
 *
 * Il compare le site d'avant la relecture à celui d'après, et attribue les
 * anomalies nouvelles aux commandes reçues entre les deux (`introducedBy`).
 * Seul un changement de site déclenche la comparaison : les commandes reçues
 * attendent la relecture qu'elles ont provoquée, et se lisent par référence.
 */
import { useEffect, useRef, useState } from 'react';
import type { Finding, SiteData } from '@azimut/core-model';
import { validateGraph } from '@azimut/engine-graph';
import { introducedBy } from './propagation-findings.js';
import type { JournalEntry } from './journal-follower.js';

function blockingOf(site: SiteData): readonly Finding[] {
  const outcome = validateGraph(site);
  return (outcome.ok ? outcome.warnings : outcome.findings).filter(f => f.severity === 'blocking');
}

const keyOf = (f: Finding): string => JSON.stringify([f.code, f.entity?.kind ?? null, f.entity?.id ?? null]);

export function useShellPropagation(
  site: SiteData | null,
  received: readonly JournalEntry[],
  clearReceived: () => void,
): readonly Finding[] {
  const previous = useRef<SiteData | null>(null);
  const pending = useRef(received);
  const clear = useRef(clearReceived);
  pending.current = received;
  clear.current = clearReceived;
  const [findings, setFindings] = useState<readonly Finding[]>([]);

  useEffect(() => {
    const before = previous.current;
    previous.current = site;
    if (site === null || before === null || before === site) return;
    const entries = pending.current;
    if (before.site.id !== site.site.id) {
      setFindings([]);
      clear.current();
      return;
    }
    const now = blockingOf(site);
    const still = new Set(now.map(keyOf));
    const fresh = entries.length === 0 ? [] : introducedBy(blockingOf(before), now, entries);
    setFindings(kept => [
      ...kept.filter(f => still.has(keyOf(f)) && !fresh.some(n => keyOf(n) === keyOf(f))),
      ...fresh,
    ]);
    if (entries.length > 0) clear.current();
  }, [site]);

  return findings;
}
