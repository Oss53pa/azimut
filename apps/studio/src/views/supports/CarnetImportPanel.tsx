import { type JSX, useMemo, useState } from 'react';
import type { Finding } from '@azimut/core-model';
import { importSupports } from '@azimut/engine-graph';
import { useSiteData } from '../../context/useSiteData.js';
import { useI18n } from '../../i18n/useI18n.js';
import { Button, DataTable, Panel, SelectField, StateBanner, Tag, type Column } from '../../components/ui/index.js';
import { SPACE } from '../../components/ui/tokens.js';
import { useCommandWrite } from '../../state/use-command-write.js';
import { carnetCommands, resolveCarnet } from '../../state/carnet-import.js';
import type { CarnetLine } from '../../state/carnet-import.js';
import { readCarnetText } from '../../state/carnet-file.js';
import { FindingList } from '../message-schedule/FindingList.js';

type Decimal = 'point' | 'comma';

const detailOf = (line: CarnetLine): string =>
  line.findings.map(f => {
    const reason = f.params['reason'];
    return typeof reason === 'string' ? `${f.code} (${reason})` : f.code;
  }).join(' · ');

/**
 * T-1.13 et D4.1 — la reprise d'un carnet existant. Le fichier est lu au
 * poste, confronté au site, et le rapport dit chaque ligne. Seules les lignes
 * prêtes s'écrivent, par l'émetteur de la coquille (journalisé), comme tout
 * geste ; la base valide chaque commande.
 */
export function CarnetImportPanel(): JSX.Element {
  const site = useSiteData();
  const { t } = useI18n();
  const write = useCommandWrite();
  const [decimal, setDecimal] = useState<Decimal>('point');
  const [text, setText] = useState<string | null>(null);
  const [fileFindings, setFileFindings] = useState<readonly Finding[]>([]);

  const outcome = useMemo(() => {
    if (text === null) return null;
    const report = importSupports(site, text, { decimalSeparator: decimal });
    return report.ok ? { lines: resolveCarnet(report.value, site), findings: [] } : { lines: [], findings: report.findings };
  }, [site, text, decimal]);
  const lines = outcome?.lines ?? [];
  const count = (status: CarnetLine['status']) => lines.filter(l => l.status === status).length;
  const ready = count('ready');

  const onFile = async (file: File | undefined): Promise<void> => {
    write.clear();
    setText(null);
    setFileFindings([]);
    if (file === undefined) return;
    const read = readCarnetText(new Uint8Array(await file.arrayBuffer()));
    if (read.ok) setText(read.value);
    else setFileFindings(read.findings);
  };

  const importReady = (): void => {
    const commands = carnetCommands(lines, site, {
      orgId: site.organization.id, siteId: site.site.id, timestamp: new Date().toISOString(),
      groupKey: `carnet-${crypto.randomUUID()}`, newId: () => crypto.randomUUID(),
    });
    void write.send({ ...commands, notices: [] }, 'carnet.done')
      .then(ok => { if (ok) setText(null); });
  };

  const columns: readonly Column<CarnetLine>[] = [
    { id: 'row', header: t('carnet.col.row'), numeric: true, cell: l => String(l.row) },
    { id: 'reference', header: t('carnet.col.reference'), cell: l => l.reference },
    {
      id: 'status', header: t('carnet.col.status'),
      cell: l => <Tag label={t(`carnet.status.${l.status}`)} severity={l.status === 'ready' ? 'valid' : l.status === 'pending' ? 'warning' : 'blocking'} />,
    },
    { id: 'detail', header: t('carnet.col.detail'), cell: detailOf },
  ];

  return (
    <Panel title={t('carnet.panel')} note={t('carnet.note')}>
      <div style={{ display: 'grid', gap: SPACE.md }}>
        {write.readonly && <StateBanner severity="info" message={t('carnet.readonly')} />}
        <div style={{ display: 'flex', gap: SPACE.md, alignItems: 'end', flexWrap: 'wrap' }}>
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label={t('carnet.file')}
            onChange={event => { void onFile(event.target.files?.[0]); }}
          />
          <SelectField
            label={t('carnet.decimal')}
            value={decimal}
            options={[{ value: 'point', label: t('carnet.decimal.point') }, { value: 'comma', label: t('carnet.decimal.comma') }]}
            onChange={v => { setDecimal(v === 'comma' ? 'comma' : 'point'); }}
          />
        </div>
        <FindingList findings={[...fileFindings, ...(outcome?.findings ?? []), ...write.findings]} empty="" />
        {write.done !== null && <StateBanner severity="valid" message={t(write.done)} />}
        {outcome !== null && outcome.findings.length === 0 && (
          <>
            <StateBanner
              severity={count('rejected') + count('pending') === 0 ? 'valid' : 'warning'}
              message={t('carnet.summary', { total: lines.length, ready, pending: count('pending'), rejected: count('rejected') })}
              hint={t('carnet.kept')}
            />
            <DataTable columns={columns} rows={lines} rowKey={l => String(l.row)} empty="" />
            <div>
              <Button rank="primary" onClick={importReady} disabled={ready === 0 || write.readonly || write.busy}>
                {t('carnet.import', { count: ready })}
              </Button>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
