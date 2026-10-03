import { type JSX, useMemo } from 'react';
import type { TemporaryClosure } from '@azimut/core-model';
import { useSiteData } from '../../context/useSiteData.js';
import { useI18n } from '../../i18n/useI18n.js';
import { DataTable, Panel, Note, Button, type Column } from '../../components/ui/index.js';
import { siteLabels } from '../register/labels.js';
import { closureRows } from './closure-rows.js';

type ClosuresPanelProps = {
  /** Absent, la liste se lit sans action ; présent, chaque fermeture se retire. */
  readonly onWithdraw?: ((closure: TemporaryClosure) => void) | undefined;
  /** Le retrait est inactif : écriture en cours, ou aucune base. */
  readonly disabled?: boolean | undefined;
};

/** O11 — les fermetures temporaires du site, telles quelles. */
export function ClosuresPanel({ onWithdraw, disabled = false }: ClosuresPanelProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);
  const rows = useMemo(() => closureRows(site), [site]);
  const edges = useMemo(() => new Map(site.graph.edges.map(e => [e.id, e])), [site]);

  // Une arête que le graphe ne porte plus s'affiche par son identifiant.
  const edgeLabel = (id: string): string => {
    const edge = edges.get(id);
    return edge === undefined ? id : `${labels.node(edge.from_node_id)} — ${labels.node(edge.to_node_id)}`;
  };
  const columns: Column<TemporaryClosure>[] = [
    { id: 'edge', header: t('closures.col.edge'), cell: c => c.edge_ids.map(edgeLabel).join(' ; ') },
    { id: 'from', header: t('closures.col.from'), cell: c => c.from_at },
    { id: 'to', header: t('closures.col.to'), cell: c => c.to_at },
    { id: 'reason', header: t('closures.col.reason'), cell: c => c.reason },
  ];
  if (onWithdraw !== undefined) {
    columns.push({
      id: 'action',
      header: t('closures.col.action'),
      cell: c => (
        <Button rank="quiet" disabled={disabled} onClick={() => { onWithdraw(c); }}>
          {t('closures.withdraw')}
        </Button>
      ),
    });
  }

  return (
    <Panel title={t('closures.panel')} note={String(rows.length)} padded={false}>
      <DataTable columns={columns} rows={rows} rowKey={c => c.id} empty={t('closures.empty')} />
      <Note>{t('closures.note')}</Note>
    </Panel>
  );
}
