/**
 * S6.4 — verrouiller l'objet que l'on édite, le temps du geste (S-20, Q2).
 *
 * Le geste commence à la première modification non écrite d'un objet, et
 * finit quand elle est écrite, abandonnée, ou que la sélection change. Tant
 * qu'il dure, le verrou se renouvelle ; à sa fin, il se lève.
 *
 * Tenu par un autre, le verrou refuse le geste : `refused` le dit, et
 * l'appelant rend l'objet tel qu'il est en base. Sans liaison au journal —
 * mode local, ou session sans identité — rien n'est posé et rien n'est
 * refusé.
 */
import { useContext, useEffect, useRef, useState } from 'react';
import type { Finding } from '@azimut/core-model';
import { LOCK_RENEW_MS, acquireLock, releaseLock } from './object-lock-client.js';
import type { LockTarget } from './object-lock-client.js';
import { ObjectLockContext } from '../context/object-lock.js';

export function useEditLock(
  target: LockTarget | null,
  editing: boolean,
  /** Appelé une fois à chaque refus : l'appelant rend l'objet tel qu'en base. */
  onRefused: () => void,
): { readonly refused: boolean; readonly findings: readonly Finding[] } {
  const config = useContext(ObjectLockContext);
  const [refused, setRefused] = useState(false);
  const refusedRef = useRef(onRefused);
  refusedRef.current = onRefused;
  const table = target?.table ?? '';
  const id = target?.id ?? '';

  useEffect(() => { setRefused(false); }, [table, id]);

  useEffect(() => {
    if (config === null || !editing || table === '' || id === '') return;
    const held: LockTarget = { table, id };
    let live = true;
    const take = async (): Promise<void> => {
      const outcome = await acquireLock(config, held);
      if (!live || outcome === 'failed') return;
      // Chaque tentative fixe l'état d'après son propre résultat : un verrou
      // libéré entre-temps rend le geste à nouveau possible.
      setRefused(outcome === 'locked');
      if (outcome === 'locked') refusedRef.current();
    };
    void take();
    const renew = setInterval(() => { void take(); }, LOCK_RENEW_MS);
    return () => {
      live = false;
      clearInterval(renew);
      void releaseLock(config, held);
    };
  }, [config, editing, table, id]);

  // Q5 : le code existant de T-1.16, aucun code nouveau.
  const findings: readonly Finding[] = refused && target !== null
    ? [{
      code: 'EDIT.OBJECT_LOCKED', severity: 'warning',
      entity: { kind: target.table, id: target.id }, params: {}, ruleRef: 'S-20',
    }]
    : [];
  return { refused, findings };
}
