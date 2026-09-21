import { type JSX } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import type { AsyncState, RepositoryError, SiteRepository, SiteSummary } from '../data/index.js';
import {
  Panel, StateBanner, Note, DataTable, Tag,
  SPACE, TEXT, BUTTON_STYLE, PRIMARY_BUTTON_STYLE, LABEL_STYLE,
  type Column,
} from './ui/index.js';

type SiteGateProps = {
  readonly repository: SiteRepository;
  readonly siteState: AsyncState<unknown>;
  readonly listState: AsyncState<readonly SiteSummary[]>;
  readonly onOpenSite: (siteId: string) => void;
  readonly onRetry: () => void;
};

/**
 * Ce que l'application montre tant qu'aucun site n'est chargé.
 *
 * Quatre situations, et aucune ne se confond avec une autre : le dépôt répond
 * et n'a rien, il ne répond pas, le chargement est en cours, ou il a échoué.
 * Aucun écran vide ne passe pour une réussite.
 */
export function SiteGate(
  { repository, siteState, listState, onOpenSite, onRetry }: SiteGateProps,
): JSX.Element {
  const { t } = useI18n();

  const failure: RepositoryError | null =
    siteState.status === 'failed' ? siteState.error
      : listState.status === 'failed' ? listState.error
        : null;

  const loading = siteState.status === 'loading' || listState.status === 'loading';
  const sites = listState.status === 'ready' ? listState.value : [];

  const columns: readonly Column<SiteSummary>[] = [
    { id: 'name', header: t('gate.col.name'), cell: s => s.name },
    { id: 'country', header: t('gate.col.country'), cell: s => s.country_code },
    {
      id: 'pack',
      header: t('gate.col.rulespack'),
      cell: s => s.rules_pack_id ?? t('gate.nopack'),
    },
    {
      id: 'open',
      header: t('gate.col.action'),
      cell: s => (
        <button
          type="button"
          onClick={() => { onOpenSite(s.id); }}
          style={{ ...BUTTON_STYLE, padding: '2px 8px', fontSize: TEXT.micro }}
        >
          {t('gate.action.open')}
        </button>
      ),
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--surface-page)',
      display: 'flex',
      justifyContent: 'center',
      padding: '48px 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 720, display: 'grid', gap: SPACE.lg, alignContent: 'start' }}>
        <div>
          <div style={{ ...LABEL_STYLE, marginBottom: SPACE.xs }}>{t('gate.eyebrow')}</div>
          <h1 style={{ margin: 0, fontSize: TEXT.title, fontWeight: 500, color: 'var(--text-primary)' }}>
            {t('gate.title')}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center', flexWrap: 'wrap' }}>
          <Tag
            label={t(repository.kind === 'reference' ? 'gate.source.reference' : 'gate.source.repository')}
            severity={repository.kind === 'reference' ? 'warning' : 'valid'}
          />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: TEXT.micro,
            color: 'var(--text-muted)',
            overflowWrap: 'anywhere',
          }}>
            {repository.origin}
          </span>
        </div>

        {failure !== null && (
          <StateBanner
            severity={failure.failure === 'offline' ? 'warning' : 'blocking'}
            message={t(`repo.failure.${failure.failure}`)}
            hint={t(`repo.failure.${failure.failure}.hint`)}
          />
        )}

        {loading && failure === null && (
          <StateBanner severity="info" message={t('gate.loading')} />
        )}

        {!loading && failure === null && sites.length === 0 && (
          <StateBanner
            severity="warning"
            message={t('gate.empty.message')}
            hint={t('gate.empty.hint')}
          />
        )}

        {sites.length > 0 && (
          <Panel title={t('gate.panel.sites')} note={String(sites.length)} padded={false}>
            <DataTable columns={columns} rows={sites} rowKey={s => s.id} empty={t('gate.empty.message')} />
          </Panel>
        )}

        <div>
          <button type="button" onClick={onRetry} style={PRIMARY_BUTTON_STYLE}>
            {t('gate.action.retry')}
          </button>
        </div>

        <Note>{t('gate.note')}</Note>
      </div>
    </div>
  );
}
