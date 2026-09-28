/**
 * Q5 — déclarer une entité juridique : le « client » de l'organisation.
 *
 * L'entité juridique est la société qui possède ou exploite un site, et au
 * nom de laquelle une facture s'émet. Le formulaire saisit exactement les
 * colonnes que la table porte (décision du 27/09/2026) : raison sociale, pays,
 * devise, numéros d'immatriculation et fiscal. L'adresse (`address`, jsonb)
 * n'est pas saisie : sa structure n'est définie nulle part, et la fixer ici
 * serait un choix de modèle.
 *
 * Commande du module 00, la plateforme, propriétaire de `legal_entity` (Q2).
 * Le fichier est pur : l'identifiant et l'horodatage viennent de l'appelant.
 */
import { buildCommand, type EntityCommand, type RowValues } from './site-commands.js';
import type { Finding } from './outcome.js';
import { asFormOutcome, notice, type FormNotice, type FormOutcome } from './form-notice.js';

export type LegalEntityDraft = {
  readonly legalName: string;
  /** Code pays sur deux lettres, pris au référentiel `country` (Q9). */
  readonly countryCode: string;
  /** Code de devise, tel que la table `country` le contraint : trois majuscules. */
  readonly currencyCode: string;
  /** Facultatifs : la table les laisse nuls. Une chaîne vide vaut absence. */
  readonly registrationRef: string;
  readonly taxRef: string;
};

export type LegalEntityEnvironment = {
  readonly orgId: string;
  /** Tire l'identifiant. Injecté : une commande ne tire pas au sort. */
  readonly newId: () => string;
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
  /** Les codes du référentiel des pays, contre lesquels le pays se juge. */
  readonly countryCodes: readonly string[];
  /** Les raisons sociales déjà enregistrées dans l'organisation. */
  readonly existingNames: readonly string[];
};

const RULE_REF = 'Q5';
const MODULE = '00-plateforme';

/**
 * Même forme que la contrainte de `country.default_currency_code` : une devise
 * saisie ici doit pouvoir être celle qu'un pays propose par défaut.
 */
const CURRENCY_FORMAT = /^[A-Z]{3}$/;

function finding(code: string, params: Record<string, string | number> = {}): Finding {
  return { code, severity: 'blocking', entity: null, params, ruleRef: RULE_REF };
}

function normalise(value: string): string {
  return value.trim().toLowerCase().normalize('NFC');
}

/**
 * Les refus du formulaire, tous ensemble (M7.5, partie M).
 *
 * La raison sociale et son unicité suivent les codes du catalogue que le
 * formulaire de site emploie déjà (`DATA.NAME_REQUIRED`,
 * `DATA.NAME_DUPLICATE`, bloquants tous deux). Le pays suit
 * `DATA.COUNTRY_REQUIRED`. La devise n'a pas de code au catalogue pour une
 * entité : c'est un refus de saisie (`form.currency.invalid`).
 */
export function validateLegalEntityDraft(
  draft: LegalEntityDraft,
  env: Pick<LegalEntityEnvironment, 'countryCodes' | 'existingNames'>,
): { readonly findings: readonly Finding[]; readonly notices: readonly FormNotice[] } {
  const findings: Finding[] = [];
  const notices: FormNotice[] = [];
  const name = draft.legalName.trim();
  if (name === '') {
    findings.push(finding('DATA.NAME_REQUIRED', { length: 0 }));
  } else if (env.existingNames.some(other => normalise(other) === normalise(name))) {
    findings.push(finding('DATA.NAME_DUPLICATE', { name }));
  }
  if (!env.countryCodes.includes(draft.countryCode)) {
    findings.push(finding('DATA.COUNTRY_REQUIRED', {
      given: draft.countryCode === '' ? 'none' : draft.countryCode,
    }));
  }
  if (!CURRENCY_FORMAT.test(draft.currencyCode.trim())) {
    notices.push(notice('form.currency.invalid', 'blocking', {
      given: draft.currencyCode.trim() === '' ? 'none' : draft.currencyCode.trim(),
    }));
  }
  return { findings, notices };
}

/** Déclare une entité juridique : une commande, ou les refus. */
export function declareLegalEntityCommand(
  draft: LegalEntityDraft,
  env: LegalEntityEnvironment,
): FormOutcome<EntityCommand> {
  const checked = validateLegalEntityDraft(draft, env);
  if (checked.findings.length > 0 || checked.notices.length > 0) {
    return { ok: false, findings: checked.findings, notices: checked.notices };
  }

  const id = env.newId();
  const registration = draft.registrationRef.trim();
  const tax = draft.taxRef.trim();
  const after: RowValues = {
    id,
    org_id: env.orgId,
    legal_name: draft.legalName.trim(),
    country_code: draft.countryCode,
    currency_code: draft.currencyCode.trim(),
    ...(registration !== '' ? { registration_ref: registration } : {}),
    ...(tax !== '' ? { tax_ref: tax } : {}),
  };
  return asFormOutcome(buildCommand({
    operation: 'create', module: MODULE, table: 'legal_entity', id, org_id: env.orgId,
    after, timestamp: env.timestamp, groupKey: null,
  }));
}
