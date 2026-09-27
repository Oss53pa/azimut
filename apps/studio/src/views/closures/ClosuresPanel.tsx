import { type JSX, useMemo } from 'react';
import { isClosureReason } from '@azimut/core-model';
import { useSiteData } from '../../context/useSiteData.js';
import { useI18n } from '../../i18n/useI18n.js';
import { DataTable, Panel, Tag, Note, Button, type Column } from '../../components/ui/index.js';
import { siteLabels } from '../register/labels.js';
import { closureRows, type ClosureRow } from './closure-rows.js';

type ClosuresPanelProps = {
  /** Absent, la liste se lit sans action ; présent, chaque fermeture se retire. */
  readonly onWithdraw?: ((row: ClosureRow) => void) | undefined;
  /** Le retrait est inactif : écriture en cours, ou aucune base. */
  readonly disabled?: boolean | undefined;
};

/** A5.3 — les fermetures déclarées sur le graphe du site, telles quelles. */
export function ClosuresPanel({ onWithdraw, disabled = false }: ClosuresPanelProps): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);
  const rows = useMemo(() => closureRows(site), [site]);

  const edge = (r: ClosureRow): string => `${labels.node(r.edge.from_node_id)} — ${labels.node(r.edge.to_node_id)}`;
  // Un motif hors liste, lu en base, s'affiche tel quel plutôt que d'emprunter un libellé.
  const reason = (key: string): string => (isClosureReason(key) ? t(`closures.reason.${key}`) : key);
  const columns: Column<ClosureRow>[] = [
    { id: 'edge', header: t('closures.col.edge'), cell: edge },
    { id: 'from', header: t('closures.col.from'), cell: r => r.closure?.from ?? '—' },
    { id: 'to', header: t('closures.col.to'), cell: r => r.closure?.to ?? '—' },
    {
      id: 'reason',
      header: t('closures.col.reason'),
      cell: r => (r.closure === null
        ? <Tag label={t('closures.unreadable')} severity="blocking" />
        : reason(r.closure.reason_key)),
    },
  ];
  if (onWithdraw !== undefined) {
    columns.push({
      id: 'action',
      header: t('closures.col.action'),
      cell: r => (r.closure === null ? '—' : (
        <Button rank="quiet" disabled={disabled} onClick={() => { onWithdraw(r); }}>
          {t('closures.withdraw')}
        </Button>
      )),
    });
  }

  return (
    <Panel title={t('closures.panel')} note={String(rows.length)} padded={false}>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={r => `${r.edge.id}:${r.closure?.from ?? 'x'}:${r.closure?.to ?? 'x'}:${r.closure?.reason_key ?? 'x'}`}
        empty={t('closures.empty')}
      />
      <Note>{t('closures.note')}</Note>
    </Panel>
  );
}
