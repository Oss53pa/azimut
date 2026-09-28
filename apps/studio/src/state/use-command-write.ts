/**
 * F15, `state/` — l'écriture d'un geste de saisie, partagée par les écrans
 * qui écrivent par commande (fermetures, plans muraux).
 *
 * Une commande refusée avant envoi rend ses anomalies ; acceptée, elle part
 * vers `apply_commands` et le site se relit depuis le dépôt, qui reste la
 * source de vérité. Sans base configurée, rien ne part et `readonly` le dit :
 * l'écran se désactive plutôt que de simuler une écriture en mémoire.
 */
import { useCallback, useMemo, useState } from 'react';
import type { EntityCommand, Finding, Outcome } from '@azimut/core-model';
import { useSiteReload } from '../context/useSiteReload.js';
import type { UiMessageKey } from '../i18n/messages.js';
import { appSink } from './app-sink.js';

export type CommandWrite = {
  /** Aucune base configurée : la saisie ne peut pas écrire. */
  readonly readonly: boolean;
  readonly busy: boolean;
  readonly findings: readonly Finding[];
  /** Les avertissements du dernier geste écrit : il est passé, ils restent à lire. */
  readonly warnings: readonly Finding[];
  /** Le message du dernier geste écrit, ou `null`. */
  readonly done: UiMessageKey | null;
  /** Envoie le geste ; rend vrai s'il a été écrit. */
  readonly send: (outcome: Outcome<readonly EntityCommand[]>, doneKey: UiMessageKey) => Promise<boolean>;
  readonly clear: () => void;
};

export function useCommandWrite(): CommandWrite {
  const reload = useSiteReload();
  const sink = useMemo(() => appSink(), []);
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [warnings, setWarnings] = useState<readonly Finding[]>([]);
  const [done, setDone] = useState<UiMessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  const send = useCallback(async (outcome: Outcome<readonly EntityCommand[]>, doneKey: UiMessageKey): Promise<boolean> => {
    setDone(null);
    setWarnings([]);
    if (!outcome.ok) { setFindings(outcome.findings); return false; }
    if (sink === null) return false;
    setBusy(true);
    const result = await sink(outcome.value);
    setBusy(false);
    if (!result.ok) { setFindings(result.findings); return false; }
    setFindings([]);
    setWarnings(outcome.warnings);
    setDone(doneKey);
    reload();
    return true;
  }, [sink, reload]);

  const clear = useCallback(() => { setDone(null); setFindings([]); setWarnings([]); }, []);

  return { readonly: sink === null, busy, findings, warnings, done, send, clear };
}

/** Une commande seule, sous la forme d'un geste. */
export function single(outcome: Outcome<EntityCommand>): Outcome<readonly EntityCommand[]> {
  return outcome.ok ? { ...outcome, value: [outcome.value] } : outcome;
}
