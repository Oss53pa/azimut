import { type JSX } from 'react';
import { Button, Dialog, SPACE, TEXT } from '../components/ui/index.js';

/**
 * M7.9 (partie M) — « Une action irréversible ou à conséquence lointaine
 * demande une confirmation qui nomme la conséquence. »
 *
 * Nommer la conséquence, et non demander « êtes-vous sûr ». Une confirmation
 * qui ne dit pas ce qui va se passer ne fait que ralentir le geste : elle
 * s'apprend, se clique sans lire, et cesse de protéger.
 *
 * Le texte de la conséquence est donc obligatoire dans le type, et distinct du
 * libellé de l'action.
 */
export type ConsequenceDialogProps = {
  readonly title: string;
  /** Ce qui va se passer, en toutes lettres. Jamais « êtes-vous sûr ». */
  readonly consequence: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

export function ConsequenceDialog({
  title, consequence, confirmLabel, cancelLabel, onConfirm, onCancel,
}: ConsequenceDialogProps): JSX.Element {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      actions={
        <>
          <Button rank="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button rank="primary" onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <p
        // La conséquence s'annonce : un lecteur d'écran la lit à l'ouverture,
        // et non au moment où l'utilisateur atteint le bouton.
        data-consequence="true"
        style={{ margin: 0, fontSize: TEXT.body, lineHeight: 1.5, paddingBlock: SPACE.xs }}
      >
        {consequence}
      </p>
    </Dialog>
  );
}
