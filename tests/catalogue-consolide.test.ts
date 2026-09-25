import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ERROR_CATALOG, ANOMALY_DOMAINS, RETIRED_CODES } from '@azimut/core-model';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCUMENT = readFileSync(resolve(ROOT, 'docs/cahier-des-charges.md'), 'utf-8');

/**
 * D2.2 — le catalogue du dépôt et celui du consolidé, dans les deux sens.
 *
 * « Toute anomalie produite par un moteur figure dans ce catalogue. Ajouter un
 * code demande une entrée ici dans le même commit. » Et, en fin de D2.2 :
 * « Les codes propres aux parties E à Q figurent dans le tableau de chaque
 * partie. L'ensemble de ces tableaux forme le catalogue. » Le catalogue du
 * document est donc l'union de ses tables, et c'est elle qui est lue ici.
 *
 * Ce contrôle lit le document lui-même, et non une liste recopiée. Deux listes
 * recopiées à la main ont vieilli sans que personne s'en aperçoive — celle des
 * domaines autorisés et celle des codes — et c'est ce qui a laissé 96 codes
 * vivre hors du catalogue pendant plusieurs versions. Le document est dans le
 * dépôt avec son empreinte déposée : le lire coûte moins que de le recopier.
 */

/** Une ligne de table dont la première colonne est un code. */
const TABLE_ROW =
  /^\|\s*`([A-Z_]+\.[A-Z_0-9]+)`\s*\|\s*(bloquant|avertissement|information)\s*\|\s*(.+?)\s*\|\s*$/gm;

const SEVERITY = { bloquant: 'blocking', avertissement: 'warning', information: 'info' } as const;

type DocEntry = { readonly severity: string; readonly sens: string };

function documentCatalogue(): ReadonlyMap<string, DocEntry> {
  const rows = new Map<string, DocEntry>();
  for (const m of DOCUMENT.matchAll(TABLE_ROW)) {
    const [, code, severity, sens] = m;
    if (code === undefined || severity === undefined || sens === undefined) continue;
    rows.set(code, { severity: SEVERITY[severity as keyof typeof SEVERITY], sens });
  }
  return rows;
}

/**
 * L'apostrophe, et rien d'autre.
 *
 * Le dépôt écrit l'apostrophe typographique, le document l'apostrophe droite.
 * La comparaison porte sur les mots, pas sur ce caractère : aligner le dépôt
 * sur le document aurait fait entrer deux apostrophes différentes dans le même
 * fichier.
 */
function words(value: string): string {
  return value.replace(/['’]/g, '’');
}

/**
 * Codes que le consolidé catalogue et que le dépôt ne porte pas encore.
 *
 * Aucun n'est un oubli : chacun appartient à un module non construit. La liste
 * est déclarée pour que l'écart reste visible et nommé — un code qui
 * disparaîtrait de cette liste sans apparaître au catalogue ferait échouer le
 * contrôle.
 */
const NON_CONSTRUITS: Readonly<Record<string, string>> = {
  'ACCOUNT.LAST_ADMIN': 'O3, cycle de vie des comptes, plateforme.',
  'ACCOUNT.MFA_NOT_ENROLLED': 'O3, cycle de vie des comptes, plateforme.',
  'ASSIST.OUT_OF_SCOPE': 'S7, module 14, assistant de conception, incrément 5.',
  'ASSIST.UNAVAILABLE': 'S7, module 14, assistant de conception, incrément 5.',
  'CLOSURE.OVERLAP': 'O11, fermetures temporaires, incrément 3.',
  // Le seul de cette liste qui ne soit pas en attente d'un module : il est en
  // attente d'un arbitrage. S-35 fait de la place une empreinte et du parking
  // une zone, mais A5.2 ne donne à `zone` ni géométrie ni liste d'empreintes,
  // et la zone d'orientation d'H11, qui en porte une, est une autre table.
  // « Hors de toute zone de nature `parking` » n'est donc pas calculable, et
  // ajouter le lien qui le rendrait calculable est un choix de modèle non
  // prévu en A5 : A2.2, point 2.
  'DATA.PARKING_SPACE_WITHOUT_ZONE':
    'S8, stationnement : l’appartenance d’une empreinte à une zone n’est pas '
    + 'modélisée en A5.2. Arbitrage A2.2, point 2.',
  'DATA.CURRENCY_MIXED': 'Q4, devises, incrément 4.',
  'DATA.CURRENCY_REQUIRED': 'Q4, devises, incrément 4.',
  'DATA.LEGAL_ENTITY_REQUIRED': 'Q5, entité juridique émettrice, incrément 4.',
  'DATA.TAX_RATE_MISSING': 'Q6, taxes sur les factures, incrément 4.',
  'EXPORT.GEOMETRY_FORMAT_UNSET':
    'S5, export de géométrie, incrément 2. Le format est au registre, S12 nº 1.',
  'EXPORT.RASTER_FOR_FABRICATION': 'S5, exports PNG et géométrie, incrément 2.',
  'IMPORT.COUNTER_OVERLAP': 'O5, import des données de comptage, module 03.',
  'KIOSK.NO_HEARTBEAT': 'O10, supervision du parc de bornes, incrément 3.',
  'KIOSK.VERSION_MISMATCH': 'O10, supervision du parc de bornes, incrément 3.',
  'SECURITY.INCIDENT_OPEN': 'Q7, réponse aux incidents, plateforme.',
  'SITE_STATE.ACTIVE_LOCKED': 'O12, versionnement de la géométrie, incrément 3.',
  'TERMINATION.EXPORT_PENDING': 'O15, fin de contrat, incrément 4.',
  'VENDOR.OFFER_INCOMPLETE': 'O8, consultation des fabricants, module 07.',
  'VISITOR.AUDIO_IN_COMMERCIAL': 'Partie P, module 13, application visiteur.',
  'VISITOR.CAMPAIGN_NOT_VALIDATED': 'Partie P, module 13, application visiteur.',
  'VISITOR.COMMERCIAL_BLOCKS_ORIENTATION': 'Partie P, module 13, application visiteur.',
  'VISITOR.CONSENT_MISSING': 'Partie P, module 13, application visiteur.',
  'VISITOR.EMERGENCY_ACTIVE': 'Partie P, module 13, application visiteur.',
  'VISITOR.EXPIRED_CONTENT': 'Partie P, module 13, application visiteur.',
  'VISITOR.FLASH_HAZARD': 'Partie P, module 13, application visiteur.',
  'VISITOR.FORMAT_MISMATCH': 'Partie P, module 13, application visiteur.',
  'VISITOR.PII_ON_KIOSK': 'Partie P, module 13, application visiteur.',
};

describe('D2.2 — le catalogue du dépôt et celui du consolidé', () => {
  const doc = documentCatalogue();
  const repo = Object.keys(ERROR_CATALOG) as (keyof typeof ERROR_CATALOG)[];

  it('le document est lu, sans quoi rien ne serait prouvé', () => {
    expect(doc.size).toBeGreaterThan(200);
  });

  it('aucun code du dépôt n’est absent du catalogue du consolidé', () => {
    const absents = repo.filter(code => !doc.has(code));
    expect(
      absents,
      'Ces codes sont levés par le dépôt et ne figurent dans aucune table du '
      + 'consolidé. Un code s’inscrit au catalogue dans le même commit que sa '
      + 'première utilisation ; à défaut, c’est un arbitrage de l’éditeur.\n'
      + absents.join('\n'),
    ).toEqual([]);
  });

  it('chaque code du consolidé est au dépôt, ou déclaré non construit', () => {
    const manquants = [...doc.keys()]
      .filter(code => !(code in ERROR_CATALOG))
      .filter(code => !(code in NON_CONSTRUITS))
      .sort();
    expect(
      manquants,
      'Ces codes sont au catalogue du consolidé et nulle part dans le dépôt. '
      + 'Les construire, ou les inscrire à NON_CONSTRUITS avec leur module.\n'
      + manquants.join('\n'),
    ).toEqual([]);
  });

  it('aucun code déclaré non construit n’a été construit entre-temps', () => {
    const construits = Object.keys(NON_CONSTRUITS).filter(code => code in ERROR_CATALOG);
    expect(construits, `À retirer de NON_CONSTRUITS :\n${construits.join('\n')}`).toEqual([]);
  });

  it('chaque code déclaré non construit est bien au catalogue du consolidé', () => {
    const inconnus = Object.keys(NON_CONSTRUITS).filter(code => !doc.has(code));
    expect(inconnus, `Inconnus du consolidé :\n${inconnus.join('\n')}`).toEqual([]);
  });

  it('les gravités concordent', () => {
    const ecarts = repo
      .map(code => ({ code, repo: ERROR_CATALOG[code].severity, doc: doc.get(code)?.severity }))
      .filter(x => x.doc !== undefined && x.repo !== x.doc)
      .map(x => `${x.code} : dépôt ${x.repo}, consolidé ${String(x.doc)}`);
    expect(ecarts, ecarts.join('\n')).toEqual([]);
  });

  it('les libellés concordent', () => {
    const ecarts = repo
      .map(code => ({ code, repo: ERROR_CATALOG[code].description, doc: doc.get(code)?.sens }))
      .filter(x => x.doc !== undefined && words(x.repo) !== words(x.doc))
      .map(x => `${x.code}\n   dépôt     : ${x.repo}\n   consolidé : ${String(x.doc)}`);
    expect(ecarts, ecarts.join('\n')).toEqual([]);
  });

  /**
   * D2.1 : « Un code retiré est marqué obsolète et sa valeur reste réservée. »
   * Un code retiré du dépôt mais resté au catalogue du document reviendrait par
   * le contrôle précédent, ce qui n'aurait aucun sens.
   */
  it('aucun code réservé ne figure au catalogue du consolidé', () => {
    const revenus = Object.keys(RETIRED_CODES).filter(code => doc.has(code));
    expect(revenus, revenus.join('\n')).toEqual([]);
  });
});

describe('D2.1 — les domaines du dépôt et ceux du consolidé', () => {
  /** La phrase de D2.1 qui énumère les domaines, et elle seule. */
  function documentDomains(): ReadonlySet<string> {
    const line = /Domaines autorisés, et eux seuls\s*:([^\n]+)/.exec(DOCUMENT);
    const enumeration = line?.[1];
    if (enumeration === undefined) {
      throw new Error('la phrase des domaines de D2.1 est introuvable');
    }
    return new Set([...enumeration.matchAll(/`([A-Z_]+)`/g)].map(m => m[1] ?? ''));
  }

  it('la liste de D2.1 est lue', () => {
    expect(documentDomains().size).toBeGreaterThan(30);
  });

  it('aucun domaine du dépôt n’est hors de la liste de D2.1', () => {
    const autorises = documentDomains();
    const hors = [...ANOMALY_DOMAINS].filter(domain => !autorises.has(domain));
    expect(hors, `Hors de D2.1 :\n${hors.join('\n')}`).toEqual([]);
  });
});
