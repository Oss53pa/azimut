/**
 * S-19 — un champ de renommage qui n'écrit qu'à la validation.
 *
 * « Ce qui se propage, ce sont les commandes validées de la section E5.1,
 * jamais un geste en cours ni une saisie caractère par caractère. » Le champ
 * garde un brouillon pendant la frappe ; Entrée ou la sortie du champ le
 * valident, Échap rend le nom en place. Une seule commande part, et une seule
 * entrée entre dans la pile d'annulation.
 *
 * Tant que le champ n'est pas en cours de saisie, il suit le nom que la
 * session porte : un renommage fait sur un autre poste y paraît.
 *
 * S6.4 — la saisie est un geste : elle verrouille l'objet tant qu'elle dure.
 */
import { type JSX, useState } from 'react';
import { getErrorMessage } from '@azimut/core-model';
import { TextField } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { useEditLock } from '../state/use-edit-lock.js';
import type { LockTarget } from '../state/object-lock-client.js';

export function RenameField({ label, value, onCommit, lock }: {
  readonly label: string;
  readonly value: string;
  readonly onCommit: (name: string) => void;
  /**
   * S6.4 — l'objet que le champ renomme. La saisie le verrouille pour les
   * autres ; tenu par un autre, la saisie est rendue et le champ le dit.
   */
  readonly lock?: LockTarget | undefined;
}): JSX.Element {
  const { lang } = useI18n();
  const [draft, setDraft] = useState<string | null>(null);
  const editLock = useEditLock(lock ?? null, draft !== null, () => { setDraft(null); });
  const locked = editLock.refused
    ? getErrorMessage('EDIT.OBJECT_LOCKED', lang === 'en' ? 'en' : 'fr') ?? 'EDIT.OBJECT_LOCKED'
    : undefined;

  function commit(): void {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  }

  return (
    <TextField
      label={label}
      value={draft ?? value}
      onChange={setDraft}
      error={locked}
      onBlur={commit}
      onKey={key => {
        if (key === 'Enter') commit();
        if (key === 'Escape') setDraft(null);
      }}
    />
  );
}
