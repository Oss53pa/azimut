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
import type { Finding, Outcome } from './outcome.js';

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

function finding(
  code: string, severity: Finding['severity'], params: Record<string, string | number> = {},
): Finding {
  return { code, severity, entity: null, params, ruleRef: RULE_REF };
}

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase('fr').normalize('NFC');
}

/** Les refus et avertissements du formulaire, tous ensemble (M7.5, partie M). */
export function validateLegalEntityDraft(
  draft: LegalEntityDraft,
  env: Pick<LegalEntityEnvironment, 'countryCodes' | 'existingNames'>,
): { readonly blocking: readonly Finding[]; readonly warnings: readonly Finding[] } {
  const blocking: Finding[] = [];
  const warnings: Finding[] = [];
  const name = draft.legalName.trim();
  if (name === '') blocking.push(finding('DATA.LEGAL_NAME_REQUIRED', 'blocking'));
  if (!env.countryCodes.includes(draft.countryCode)) {
    blocking.push(finding('DATA.COUNTRY_REQUIRED', 'blocking', {
      given: draft.countryCode === '' ? 'none' : draft.countryCode,
    }));
  }
  if (!CURRENCY_FORMAT.test(draft.currencyCode.trim())) {
    blocking.push(finding('DATA.CURRENCY_INVALID', 'blocking', {
      given: draft.currencyCode.trim() === '' ? 'none' : draft.currencyCode.trim(),
    }));
  }
  // Deux sociétés distinctes peuvent porter la même raison sociale dans deux
  // pays : le doublon avertit, il ne bloque pas.
  if (name !== '' && env.existingNames.some(other => normalise(other) === normalise(name))) {
    warnings.push(finding('DATA.LEGAL_NAME_DUPLICATE', 'warning', { name }));
  }
  return { blocking, warnings };
}

/** Déclare une entité juridique : une commande, ou les refus. */
export function declareLegalEntityCommand(
  draft: LegalEntityDraft,
  env: LegalEntityEnvironment,
): Outcome<EntityCommand> {
  const checked = validateLegalEntityDraft(draft, env);
  if (checked.blocking.length > 0) return { ok: false, findings: [...checked.blocking] };

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
  const out = buildCommand({
    operation: 'create', module: MODULE, table: 'legal_entity', id, org_id: env.orgId,
    after, timestamp: env.timestamp, groupKey: null,
  });
  return out.ok ? { ...out, warnings: [...checked.warnings] } : out;
}
