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
 * Q9 — un pays du référentiel, avec ses fuseaux.
 *
 * Les fuseaux voyagent avec le pays parce que M1 (partie M) les lie : le champ
 * de fuseau n'offre que ceux du pays choisi, et se pré-remplit quand le pays
 * n'en compte qu'un.
 */
export type CountryOption = Option & {
  readonly timezones: readonly string[];
};

export type NewSiteDialogProps = {
  readonly countries: readonly CountryOption[];
  readonly rulesPacks: readonly Option[];
  /**
   * Q5 — les entités juridiques de l'organisation. Vide, le champ n'apparaît
   * pas : « à défaut, le formulaire indique où la créer, jamais un sélecteur
   * vide ».
   */
  readonly legalEntities: readonly Option[];
  readonly langs: readonly Option[];
  readonly findings: readonly Finding[];
  readonly busy: boolean;
  readonly onSubmit: (draft: SiteDraft) => void;
  readonly onClose: () => void;
};

/**
 * M1 (partie M) — le formulaire de création d'un site.
 *
 * Six champs : le nom, le pays, le fuseau, le paquet de règles — facultatif à
 * la création —, l'entité juridique — affichée seulement si l'organisation en
 * porte une — et les langues actives.
 *
 * Les anomalies arrivent ensemble et se rangent sous leur champ. M7.5 (partie
 * M) : « Un refus de saisie n'efface jamais le travail en cours. » La saisie
 * reste donc à l'écran après un refus, telle quelle.
 */
export function NewSiteDialog({
  countries, rulesPacks, legalEntities, langs, findings, busy, onSubmit, onClose,
}: NewSiteDialogProps): JSX.Element {
  const { t, lang } = useI18n();
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [timezone, setTimezone] = useState('');
  const [pack, setPack] = useState('');
  const [legalEntity, setLegalEntity] = useState('');
  const [active, setActive] = useState<readonly string[]>(() => langs.map(l => l.value));

  const chosen = countries.find(option => option.value === country);
  const timezones: readonly Option[] =
    chosen?.timezones.map(zone => ({ value: zone, label: zone })) ?? [];

  /**
   * M1 (partie M) : « pré-rempli quand le pays n'en compte qu'un ».
   *
   * Au-delà d'un fuseau, le champ se vide : le fuseau retenu pour le pays
   * précédent n'a aucune raison de valoir pour le nouveau, et le laisser en
   * place ferait passer une erreur pour un choix.
   */
  function pickCountry(code: string): void {
    setCountry(code);
    const zones = countries.find(option => option.value === code)?.timezones ?? [];
    setTimezone(zones.length === 1 ? zones[0] ?? '' : '');
  }

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
      legalEntityId: legalEntity === '' ? null : legalEntity,
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
          onChange={pickCountry}
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
          hint={country === ''
            ? t('sites.create.timezone.needs.country')
            : t('sites.create.timezone.hint')}
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

        {/*
          Q5 et version 7 : « Le champ n'apparaît que si l'organisation en
          porte au moins une. À défaut, le formulaire indique où la créer,
          jamais un sélecteur vide. » Un sélecteur vide ferait chercher une
          valeur qui n'existe nulle part.
        */}
        {legalEntities.length > 0 ? (
          <SelectField
            label={t('sites.create.entity')}
            value={legalEntity}
            options={legalEntities}
            onChange={setLegalEntity}
            placeholder={t('sites.create.entity.none')}
            disabled={busy}
            hint={t('sites.create.entity.hint')}
          />
        ) : (
          <StateBanner severity="info" message={t('sites.create.entity.absent')} />
        )}

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
