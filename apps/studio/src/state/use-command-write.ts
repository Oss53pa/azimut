/**
 * F15, `state/` — l'écriture d'un geste de saisie, partagée par les écrans
 * qui écrivent par commande (fermetures, faces, blocs libres).
 *
 * Une commande refusée avant envoi rend ses anomalies, et ses refus de saisie
 * sans code (D2.2) ; acceptée, elle part par l'émetteur de la coquille —
 * `apply_journaled_commands` sous une session ouverte (S6.6c), `apply_commands`
 * sinon — et le site se relit depuis le dépôt, qui reste la source de vérité. Sans base configurée, rien ne part et `readonly` le dit :
 * l'écran se désactive plutôt que de simuler une écriture en mémoire.
 */
import { useCallback, useContext, useMemo, useState } from 'react';
import type { EntityCommand, Finding, FormNotice, FormOutcome } from '@azimut/core-model';
import { useSiteReload } from '../context/useSiteReload.js';
import { SiteSinkContext } from '../context/site-writer.js';
import type { UiMessageKey } from '../i18n/messages.js';
import { appSink } from './app-sink.js';

export type CommandWrite = {
  /** Aucune base configurée : la saisie ne peut pas écrire. */
  readonly readonly: boolean;
  readonly busy: boolean;
  readonly findings: readonly Finding[];
  /** Les refus de saisie sans code au catalogue ; après écriture, les avis restants. */
  readonly notices: readonly FormNotice[];
  /** Les avertissements du dernier geste écrit : il est passé, ils restent à lire. */
  readonly warnings: readonly Finding[];
  /** Le message du dernier geste écrit, ou `null`. */
  readonly done: UiMessageKey | null;
  /** Envoie le geste ; rend vrai s'il a été écrit. */
  readonly send: (outcome: FormOutcome<readonly EntityCommand[]>, doneKey: UiMessageKey) => Promise<boolean>;
  readonly clear: () => void;
};

function isStaleRefusal(finding: Finding): boolean {
  return finding.code === 'EDIT.WRITE_REFUSED' && finding.params['cause'] === '409';
}

export function useCommandWrite(): CommandWrite {
  const reload = useSiteReload();
  // S6.6c — la coquille fournit son émetteur, journalisé dès qu'une session
  // est ouverte. Hors coquille (essais d'écran), il se construit ici.
  const provided = useContext(SiteSinkContext);
  const own = useMemo(() => (provided === undefined ? appSink() : null), [provided]);
  const sink = provided === undefined ? own : provided;
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [notices, setNotices] = useState<readonly FormNotice[]>([]);
  const [warnings, setWarnings] = useState<readonly Finding[]>([]);
  const [done, setDone] = useState<UiMessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  const send = useCallback(async (outcome: FormOutcome<readonly EntityCommand[]>, doneKey: UiMessageKey): Promise<boolean> => {
    setDone(null);
    setWarnings([]);
    setNotices(outcome.notices);
    if (!outcome.ok) { setFindings(outcome.findings); return false; }
    if (sink === null) return false;
    setBusy(true);
    const result = await sink(outcome.value);
    setBusy(false);
    if (!result.ok) {
      setFindings(result.findings);
      // Une commande périmée (S6.2) : l'écran se relit pour montrer ce qu'un
      // autre poste a écrit entre-temps. Le refus reste affiché.
      if (result.findings.some(isStaleRefusal)) reload();
      return false;
    }
    setFindings([]);
    setWarnings(outcome.warnings);
    setDone(doneKey);
    reload();
    return true;
  }, [sink, reload]);

  const clear = useCallback(() => { setDone(null); setFindings([]); setNotices([]); setWarnings([]); }, []);

  return { readonly: sink === null, busy, findings, notices, warnings, done, send, clear };
}
