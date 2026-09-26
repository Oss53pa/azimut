import { type JSX, useMemo, useState } from 'react';
import { useSiteData } from '../context/useSiteData.js';
import { useI18n } from '../i18n/useI18n.js';
import {
  DataTable, RegisterLayout, Inspector, InspectorEmpty, Tag, StateBanner, SPACE,
  type Column, type RegisterFilter,
} from '../components/ui/index.js';
import { useCommandWrite } from '../state/use-command-write.js';
import { siteLabels } from './register/labels.js';
import { faceSlots, slotKey, type FaceSlot } from './faces/face-slots.js';
import { FaceForm } from './faces/FaceForm.js';

const ALL = 'all';
const DECLARED = 'declared';
const UNDECLARED = 'undeclared';

/**
 * Module 04 — les faces des supports (A5.6), au gabarit « registre » : une
 * ligne par face que la typologie prévoit, déclarée ou non. L'inspecteur
 * déclare la face ou modifie son gabarit et ses langues, par commande ; le
 * site se relit ensuite. Sans base configurée, la saisie est inactive.
 */
export function SupportFacesView(): JSX.Element {
  const site = useSiteData();
  const { t, lang } = useI18n();
  const write = useCommandWrite();
  const labels = useMemo(() => siteLabels(site, lang), [site, lang]);
  const rows = useMemo(() => faceSlots(site), [site]);
  const [filter, setFilter] = useState(ALL);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const visible = rows.filter(r => {
    if (filter === DECLARED) return r.face !== undefined;
    if (filter === UNDECLARED) return r.face === undefined;
    return true;
  });
  const selected = rows.find(r => slotKey(r) === selectedKey) ?? visible[0] ?? null;
  const templateName = (key: string | undefined): string => {
    if (key === undefined) return t('supportfaces.template.inherited');
    return site.face_templates.find(tpl => tpl.id === key)?.name ?? key;
  };
  const level = (r: FaceSlot): string => {
    const id = labels.nodeLevel(r.support.node_id);
    return id === null ? '—' : labels.level(id);
  };

  const filters: readonly RegisterFilter[] = [
    { id: ALL, label: t('supportfaces.filter.all') },
    { id: DECLARED, label: t('supportfaces.filter.declared') },
    { id: UNDECLARED, label: t('supportfaces.filter.undeclared') },
  ];
  const state = (r: FaceSlot): JSX.Element => {
    if (r.outOfRange) return <Tag label={t('supportfaces.state.outofrange')} severity="blocking" />;
    if (r.face === undefined) return <Tag label={t('supportfaces.state.undeclared')} severity="warning" />;
    return <Tag label={t('supportfaces.state.declared')} severity="valid" />;
  };
  const langsOf = (r: FaceSlot): string => (r.face?.langs === undefined || r.face.langs.length === 0
    ? t('supportfaces.langs.none')
    : r.face.langs.join(' · '));

  const columns: readonly Column<FaceSlot>[] = [
    { id: 'support', header: t('supportfaces.col.support'), cell: r => r.support.code ?? r.support.id },
    { id: 'level', header: t('supportfaces.col.level'), cell: level },
    { id: 'face', header: t('supportfaces.col.face'), numeric: true, cell: r => String(r.faceIndex) },
    { id: 'template', header: t('supportfaces.col.template'), cell: r => (r.face === undefined ? '—' : templateName(r.face.template_key)) },
    { id: 'langs', header: t('supportfaces.col.langs'), cell: r => (r.face === undefined ? '—' : langsOf(r)) },
    { id: 'blocks', header: t('supportfaces.col.blocks'), numeric: true, cell: r => String(r.blocks) },
    { id: 'state', header: t('supportfaces.col.state'), cell: state },
  ];

  const inspector = selected === null
    ? <InspectorEmpty text={t('supportfaces.inspector.empty')} />
    : (
      <Inspector
        title={`${selected.support.code ?? selected.support.id} · ${String(selected.faceIndex)}`}
        subtitle={t('supportfaces.inspector.subtitle', { face: selected.faceIndex, node: labels.node(selected.support.node_id) })}
        sections={[]}
      >
        <FaceForm key={`${slotKey(selected)}:${selected.face?.id ?? 'new'}`} slot={selected} write={write} />
      </Inspector>
    );

  return (
    <div>
      {write.readonly && (
        <div style={{ marginBottom: SPACE.lg }}>
          <StateBanner severity="info" message={t('supportfaces.form.readonly')} />
        </div>
      )}
      {write.done !== null && (
        <div style={{ marginBottom: SPACE.lg }}>
          <StateBanner severity="valid" message={t(write.done)} />
        </div>
      )}
      <RegisterLayout
        title={t('supportfaces.title')}
        summary={t('supportfaces.summary', { count: rows.length, declared: rows.filter(r => r.face !== undefined).length })}
        filtersLabel={t('register.filters')}
        filters={filters}
        filter={filter}
        onFilter={id => { setFilter(id); setSelectedKey(null); }}
        shown={t('supportfaces.shown', { count: visible.length })}
        inspector={inspector}
        note={t('supportfaces.note')}
      >
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={slotKey}
          empty={t('supportfaces.empty')}
          onSelect={r => { setSelectedKey(slotKey(r)); write.clear(); }}
          selectedKey={selected === null ? undefined : slotKey(selected)}
        />
      </RegisterLayout>
    </div>
  );
}
