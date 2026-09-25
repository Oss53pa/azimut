import { type JSX } from 'react';
import type { ViewId } from '../views.js';
import { ModuleOutlineView } from './ModuleOutlineView.js';

type DeliverablesViewProps = {
  readonly onNavigate: (view: ViewId) => void;
};

/**
 * Module 14 — restitutions. Les pièces s'exportent déjà module par module ;
 * aucun moteur ne les assemble en dossier client, dossier fabricant ou
 * rapport. L'écran mène aux exports qui existent et nomme le reste.
 */
export function DeliverablesView({ onNavigate }: DeliverablesViewProps): JSX.Element {
  return (
    <ModuleOutlineView
      moduleNumber="14"
      available={[
        { labelKey: 'nav.item.proofs', noteKey: 'deliverables.available.proofs', view: 'proofs' },
        { labelKey: 'module.02.name', noteKey: 'deliverables.available.messages', view: 'message-schedule' },
        { labelKey: 'nav.item.checks', noteKey: 'deliverables.available.checks', view: 'checks' },
      ]}
      planned={[
        'deliverables.planned.client',
        'deliverables.planned.manufacturer',
        'deliverables.planned.report',
        'deliverables.planned.compose',
        'deliverables.planned.pieces',
      ]}
      noteKey="deliverables.note"
      onNavigate={onNavigate}
    />
  );
}
