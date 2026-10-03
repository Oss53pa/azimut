import { type JSX, useMemo, useState } from 'react';
import {
  declareLegalEntityCommand, type Finding, type FormNotice, type LegalEntityDraft,
} from '@azimut/core-model';
import { Button, StateBanner, SPACE, TEXT, LABEL_STYLE } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import type { AsyncState, CountrySummary, LegalEntitySummary } from '../data/index.js';
import type { CommandSink } from '../state/command-store.js';
import { NewClientDialog, type ClientCountryOption } from '../screens/NewClientDialog.js';

type ClientsSectionProps = {
  readonly orgId: string;
  readonly entities: AsyncState<readonly LegalEntitySummary[]>;
  readonly countries: readonly CountrySummary[];
  /** L'émetteur de la page des sites : `apply_commands`, ou rien hors ligne. */
  readonly sink: CommandSink;
  /** Relit la liste des clients après une création acceptée. */
  readonly onCreated: () => void;
};

type DialogState = {
  readonly open: boolean;
  readonly busy: boolean;
  readonly findings: readonly Finding[];
  readonly notices: readonly FormNotice[];
};

const CLOSED: DialogState = { open: false, busy: false, findings: [], notices: [] };

/**
 * Q5 — les clients de l'organisation, sous la liste des sites : leurs
 * entités juridiques, et le formulaire qui en crée une. Le formulaire du site
 * les propose ensuite dans son champ « Entité juridique ».
 */
export function ClientsSection({
  orgId, entities, countries, sink, onCreated,
}: ClientsSectionProps): JSX.Element {
  const { t, lang } = useI18n();
  const [dialog, setDialog] = useState<DialogState>(CLOSED);
  const [done, setDone] = useState(false);

  const list = entities.status === 'ready' ? entities.value : [];
  const countryOptions: readonly ClientCountryOption[] = useMemo(
    () => countries.map(country => ({
      value: country.code,
      label: lang === 'en' ? country.name_en : country.name_fr,
      defaultCurrency: country.default_currency_code,
    })),
    [countries, lang],
  );

  async function submit(draft: LegalEntityDraft): Promise<void> {
    setDialog(previous => ({ ...previous, busy: true, findings: [], notices: [] }));
    const outcome = declareLegalEntityCommand(draft, {
      orgId,
      newId: () => crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      countryCodes: countries.map(country => country.code),
      existingNames: list.map(entity => entity.legal_name),
    });
    if (!outcome.ok) {
      setDialog(previous => ({ ...previous, busy: false, findings: outcome.findings, notices: outcome.notices }));
      return;
    }
    const written = await sink([outcome.value]);
    if (!written.ok) {
      setDialog(previous => ({ ...previous, busy: false, findings: written.findings }));
      return;
    }
    setDialog(CLOSED);
    setDone(true);
    onCreated();
  }

  return (
    <section aria-label={t('clients.title')} style={{ display: 'grid', gap: SPACE.sm, padding: '16px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: SPACE.md }}>
        <h2 style={{ ...LABEL_STYLE, margin: 0 }}>{t('clients.title')}</h2>
        <Button rank="secondary" onClick={() => { setDone(false); setDialog({ ...CLOSED, open: true }); }}>
          {t('clients.create.open')}
        </Button>
      </div>
      <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>{t('clients.intro')}</p>

      {done && <StateBanner severity="valid" message={t('clients.create.done')} />}

      {entities.status === 'loading' && <p style={{ margin: 0, fontSize: TEXT.small }}>{t('clients.loading')}</p>}
      {entities.status === 'failed' && <StateBanner severity="blocking" message={t('clients.failed')} />}
      {entities.status === 'ready' && list.length === 0 && (
        <p style={{ margin: 0, fontSize: TEXT.small, color: 'var(--text-muted)' }}>{t('clients.empty')}</p>
      )}
      {list.length > 0 && (
        <ul aria-label={t('clients.col.name')} style={{ margin: 0, paddingLeft: SPACE.lg, fontSize: TEXT.small }}>
          {list.map(entity => <li key={entity.id}>{entity.legal_name}</li>)}
        </ul>
      )}

      {dialog.open && (
        <NewClientDialog
          countries={countryOptions}
          findings={dialog.findings}
          notices={dialog.notices}
          busy={dialog.busy}
          onSubmit={draft => { void submit(draft); }}
          onClose={() => { setDialog(CLOSED); }}
        />
      )}
    </section>
  );
}
