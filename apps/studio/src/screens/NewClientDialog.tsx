import { type JSX, useState } from 'react';
import {
  Button, Dialog, SelectField, StateBanner, TextField, SPACE,
} from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { getErrorMessage } from '@azimut/core-model';
import type { ErrorCode, Finding, FormNotice, FormNoticeKey, LegalEntityDraft } from '@azimut/core-model';

/** Un pays du référentiel, avec la devise qu'il propose par défaut (Q4). */
export type ClientCountryOption = {
  readonly value: string;
  readonly label: string;
  readonly defaultCurrency: string | null;
};

type NewClientDialogProps = {
  readonly countries: readonly ClientCountryOption[];
  readonly findings: readonly Finding[];
  readonly notices: readonly FormNotice[];
  readonly busy: boolean;
  readonly onSubmit: (draft: LegalEntityDraft) => void;
  readonly onClose: () => void;
};

/**
 * Q5 — le formulaire de création d'un client, c'est-à-dire d'une entité
 * juridique de l'organisation. Il saisit les colonnes de `legal_entity`, sauf
 * l'adresse, dont la forme n'est pas définie.
 */
export function NewClientDialog({
  countries, findings, notices, busy, onSubmit, onClose,
}: NewClientDialogProps): JSX.Element {
  const { t, lang } = useI18n();
  const [legalName, setLegalName] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('');
  const [registration, setRegistration] = useState('');
  const [tax, setTax] = useState('');

  /**
   * Q4 : la devise proposée par le pays pré-remplit le champ, sans écraser une
   * devise déjà saisie.
   */
  function pickCountry(code: string): void {
    setCountry(code);
    const proposed = countries.find(option => option.value === code)?.defaultCurrency ?? null;
    if (proposed !== null && currency.trim() === '') setCurrency(proposed);
  }

  function noticeFor(key: FormNoticeKey): string | undefined {
    return notices.some(n => n.key === key) ? t(key) : undefined;
  }

  function messageFor(code: string): string | undefined {
    const found = findings.find(f => f.code === code);
    if (found === undefined) return undefined;
    return getErrorMessage(found.code as ErrorCode, lang) ?? found.code;
  }

  function submit(): void {
    onSubmit({
      legalName, countryCode: country, currencyCode: currency, registrationRef: registration, taxRef: tax,
    });
  }

  return (
    <Dialog
      title={t('clients.create.title')}
      onClose={onClose}
      actions={
        <>
          <Button rank="secondary" onClick={onClose}>{t('clients.create.cancel')}</Button>
          <Button rank="primary" onClick={submit} disabled={busy}>
            {busy ? t('clients.create.submitting') : t('clients.create.submit')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
        <TextField
          label={t('clients.create.name')}
          value={legalName}
          onChange={setLegalName}
          autoFocus
          disabled={busy}
          error={messageFor('DATA.NAME_REQUIRED') ?? messageFor('DATA.NAME_DUPLICATE')}
        />
        <SelectField
          label={t('clients.create.country')}
          value={country}
          options={countries}
          onChange={pickCountry}
          placeholder={t('clients.create.country.placeholder')}
          disabled={busy}
          error={messageFor('DATA.COUNTRY_REQUIRED')}
        />
        <TextField
          label={t('clients.create.currency')}
          value={currency}
          onChange={value => { setCurrency(value.toUpperCase()); }}
          maxLength={3}
          disabled={busy}
          hint={t('clients.create.currency.hint')}
          error={noticeFor('form.currency.invalid')}
        />
        <TextField
          label={t('clients.create.registration')}
          value={registration}
          onChange={setRegistration}
          disabled={busy}
          hint={t('clients.create.optional')}
        />
        <TextField
          label={t('clients.create.tax')}
          value={tax}
          onChange={setTax}
          disabled={busy}
          hint={t('clients.create.optional')}
        />
        <StateBanner severity="info" message={t('clients.create.address.note')} />
      </div>
    </Dialog>
  );
}
