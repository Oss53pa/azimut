import { type JSX, useState } from 'react';
import {
  Button, Dialog, MultiChoice, SelectField, StateBanner, TextField, SPACE,
} from '../components/ui/index.js';
import type { Option } from '../components/ui/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { getErrorMessage } from '@azimut/core-model';
import type { ErrorCode, Finding } from '@azimut/core-model';
import type { SiteDraft } from '../state/site-creation.js';
import { SITE_NAME_MAX } from '../state/site-creation.js';

/**
 * M1 (partie M) — le formulaire de création d'un site.
 *
 * Quatre champs, quatre contrôles, et rien de plus : le nom, le pays, le
 * paquet de règles — facultatif à la création — et les langues actives.
 *
 * Les anomalies arrivent ensemble et se rangent sous leur champ. M7.5 (partie
 * M) : « Un refus de saisie n'efface jamais le travail en cours. » La saisie
 * reste donc à l'écran après un refus, telle quelle.
 */
export type NewSiteDialogProps = {
  readonly countries: readonly Option[];
  /** O4 — les fuseaux que la plateforme déclare, jamais une liste écrite ici. */
  readonly timezones: readonly Option[];
  readonly rulesPacks: readonly Option[];
  readonly langs: readonly Option[];
  readonly findings: readonly Finding[];
  readonly busy: boolean;
  readonly onSubmit: (draft: SiteDraft) => void;
  readonly onClose: () => void;
};

export function NewSiteDialog({
  countries, timezones, rulesPacks, langs, findings, busy, onSubmit, onClose,
}: NewSiteDialogProps): JSX.Element {
  const { t, lang } = useI18n();
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [timezone, setTimezone] = useState('');
  const [pack, setPack] = useState('');
  const [active, setActive] = useState<readonly string[]>(() => langs.map(l => l.value));

  function messageFor(...codes: readonly string[]): string | undefined {
    const found = findings.find(f => codes.includes(f.code));
    if (found === undefined) return undefined;
    return getErrorMessage(found.code as ErrorCode, lang) ?? found.code;
  }

  function submit(): void {
    onSubmit({
      name,
      countryCode: country,
      timezone,
      rulesPackId: pack === '' ? null : pack,
      activeLangs: active,
    });
  }

  return (
    <Dialog
      title={t('sites.create.title')}
      onClose={onClose}
      actions={
        <>
          <Button rank="secondary" onClick={onClose}>{t('sites.create.cancel')}</Button>
          <Button rank="primary" onClick={submit} disabled={busy}>
            {busy ? t('sites.create.submitting') : t('sites.create.submit')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
        <TextField
          label={t('sites.create.name')}
          value={name}
          onChange={setName}
          maxLength={SITE_NAME_MAX}
          autoFocus
          disabled={busy}
          hint={t('sites.create.name.hint')}
          error={messageFor('DATA.NAME_REQUIRED', 'DATA.NAME_DUPLICATE')}
        />

        <SelectField
          label={t('sites.create.country')}
          value={country}
          options={countries}
          onChange={setCountry}
          placeholder={t('sites.create.country.placeholder')}
          disabled={busy}
          error={messageFor('DATA.COUNTRY_REQUIRED')}
        />

        <SelectField
          label={t('sites.create.timezone')}
          value={timezone}
          options={timezones}
          onChange={setTimezone}
          placeholder={t('sites.create.timezone.placeholder')}
          disabled={busy}
          hint={t('sites.create.timezone.hint')}
          error={messageFor('DATA.TIMEZONE_REQUIRED')}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
          <SelectField
            label={t('sites.create.pack')}
            value={pack}
            options={rulesPacks}
            onChange={setPack}
            placeholder={t('sites.create.pack.none')}
            disabled={busy}
            hint={t('sites.create.pack.hint')}
          />
          {/*
            M1 (partie M), version 6 : « aucune anomalie à la création ;
            information affichée ». Un bandeau d'information, et non une
            pastille d'avertissement : l'absence de paquet à la création n'est
            pas un défaut, c'est une conséquence à connaître.
          */}
          {pack === '' && (
            <StateBanner severity="info" message={t('sites.create.pack.note')} />
          )}
        </div>

        <MultiChoice
          label={t('sites.create.langs')}
          options={langs}
          selected={active}
          onChange={setActive}
          disabled={busy}
          error={messageFor('DATA.LANG_REQUIRED')}
        />
      </div>
    </Dialog>
  );
}
