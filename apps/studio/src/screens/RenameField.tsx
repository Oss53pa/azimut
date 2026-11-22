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
 */
import { type JSX, useState } from 'react';
import { TextField } from '../components/ui/index.js';

export function RenameField({ label, value, onCommit }: {
  readonly label: string;
  readonly value: string;
  readonly onCommit: (name: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);

  function commit(): void {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  }

  return (
    <TextField
      label={label}
      value={draft ?? value}
      onChange={setDraft}
      onBlur={commit}
      onKey={key => {
        if (key === 'Enter') commit();
        if (key === 'Escape') setDraft(null);
      }}
    />
  );
}
