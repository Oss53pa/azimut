/**
 * A5.6 / D8.3 — saisir les blocs de contenu d'une face de support.
 *
 * Seuls se saisissent sur une face les blocs que le gabarit ne porte pas
 * (décision du 26/09/2026) : le bloc `free`, dont le texte est une donnée
 * d'instance, et le bloc `legend`, sans contenu. Les blocs `resolved` et
 * `pictogram` restent définis par le gabarit et résolus par le tableau des
 * messages (INV-1, INV-2) ; le bloc `map` se déclare par les plans muraux.
 *
 * Le texte d'un bloc libre a une entrée par langue — `{"fr": "…", "en": "…"}` —
 * parmi les langues de la face, à défaut celles du site. Une langue de la face
 * restée sans texte est signalée, sans bloquer.
 *
 * Commandes du module 04 (L3). Le fichier est pur.
 */
import type { SiteData } from './site.js';
import type { ContentBlockInstance, SupportFace } from './site-signage.js';
import { buildCommand, type EntityCommand, type RowValues } from './site-commands.js';
import type { Finding, Outcome } from './outcome.js';

export const ENTERABLE_BLOCK_KINDS = ['free', 'legend'] as const;
export type EnterableBlockKind = (typeof ENTERABLE_BLOCK_KINDS)[number];

export function isEnterableBlockKind(value: string): value is EnterableBlockKind {
  return (ENTERABLE_BLOCK_KINDS as readonly string[]).includes(value);
}

/** Le texte saisi, par langue. Une chaîne vide vaut absence. */
export type FreeTexts = Readonly<Record<string, string>>;

export type BlockEnvironment = {
  readonly newId: () => string;
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
};

const RULE_REF = 'D8.3';
const MODULE = '04-signaletique';

function finding(code: string, severity: Finding['severity'], id: string, params: Record<string, string | number> = {}): Finding {
  return { code, severity, entity: { kind: 'face', id }, params, ruleRef: RULE_REF };
}

/** Les langues d'une face : les siennes, à défaut celles du site. */
export function faceLangs(site: SiteData, face: SupportFace): readonly string[] {
  return face.langs !== undefined && face.langs.length > 0 ? face.langs : site.site.active_langs;
}

/** Le texte d'un bloc libre tel que la base le porte, ses entrées non textuelles écartées. */
export function readFreeTexts(block: ContentBlockInstance): FreeTexts {
  const out: Record<string, string> = {};
  for (const [lang, value] of Object.entries(block.free_text ?? {})) {
    if (typeof value === 'string') out[lang] = value;
  }
  return out;
}

/** Le texte tel qu'il s'écrit : langues de la face, dans leur ordre, textes non vides. */
function freeTextValue(langs: readonly string[], texts: FreeTexts): string | null {
  const entries = langs
    .map(l => [l, (texts[l] ?? '').trim()] as const)
    .filter(([, text]) => text !== '');
  return entries.length === 0 ? null : JSON.stringify(Object.fromEntries(entries));
}

/** Refus et avertissements d'un texte libre sur la face. */
function checkTexts(site: SiteData, face: SupportFace, texts: FreeTexts): { blocking: Finding[]; warnings: Finding[] } {
  const langs = faceLangs(site, face);
  const blocking: Finding[] = [];
  for (const [lang, text] of Object.entries(texts)) {
    if (text.trim() !== '' && !langs.includes(lang)) {
      blocking.push(finding('LAYOUT.FREE_TEXT_LANG_OUTSIDE_FACE', 'blocking', face.id, { lang }));
    }
  }
  const filled = langs.filter(l => (texts[l] ?? '').trim() !== '');
  if (filled.length === 0) blocking.push(finding('LAYOUT.FREE_TEXT_EMPTY', 'blocking', face.id));
  const warnings = filled.length === 0
    ? []
    : langs.filter(l => !filled.includes(l)).map(lang => finding('LAYOUT.FREE_TEXT_LANG_MISSING', 'warning', face.id, { lang }));
  return { blocking, warnings };
}

/** Ajoute un bloc libre ou une légende après les blocs de la face. */
export function declareBlockCommand(
  site: SiteData,
  face: SupportFace,
  kind: string,
  texts: FreeTexts,
  env: BlockEnvironment,
): Outcome<EntityCommand> {
  if (!isEnterableBlockKind(kind)) {
    return { ok: false, findings: [finding('LAYOUT.BLOCK_KIND_NOT_ENTERABLE', 'blocking', face.id, { kind })] };
  }
  let warnings: Finding[] = [];
  let freeText: string | null = null;
  if (kind === 'free') {
    const checked = checkTexts(site, face, texts);
    if (checked.blocking.length > 0) return { ok: false, findings: checked.blocking };
    warnings = checked.warnings;
    freeText = freeTextValue(faceLangs(site, face), texts);
  }
  const blockIndex = site.content_blocks
    .filter(b => b.face_id === face.id)
    .reduce((max, b) => Math.max(max, b.block_index + 1), 0);
  const id = env.newId();
  const after: RowValues = {
    id, org_id: face.org_id, face_id: face.id, block_index: blockIndex, kind,
    ...(freeText !== null ? { free_text: freeText } : {}),
  };
  const out = buildCommand({
    operation: 'create', module: MODULE, table: 'support_content_block', id, org_id: face.org_id,
    after, timestamp: env.timestamp, groupKey: null,
  });
  return out.ok ? { ...out, warnings } : out;
}

/** Réécrit le texte d'un bloc libre de la face. */
export function updateFreeTextCommand(
  site: SiteData,
  face: SupportFace,
  block: ContentBlockInstance,
  texts: FreeTexts,
  timestamp: string,
): Outcome<EntityCommand> {
  if (block.kind !== 'free' || block.face_id !== face.id) {
    return { ok: false, findings: [finding('LAYOUT.BLOCK_KIND_NOT_ENTERABLE', 'blocking', face.id, { kind: block.kind })] };
  }
  const checked = checkTexts(site, face, texts);
  if (checked.blocking.length > 0) return { ok: false, findings: checked.blocking };
  const out = buildCommand({
    operation: 'update', module: MODULE, table: 'support_content_block', id: block.id, org_id: block.org_id,
    before: { free_text: block.free_text === undefined ? null : JSON.stringify(block.free_text) },
    after: { free_text: freeTextValue(faceLangs(site, face), texts) },
    timestamp, groupKey: null,
  });
  return out.ok ? { ...out, warnings: checked.warnings } : out;
}

/** Retire un bloc libre ou une légende ; l'inverse le recrée à l'identique. */
export function withdrawBlockCommand(block: ContentBlockInstance, timestamp: string): Outcome<EntityCommand> {
  if (!isEnterableBlockKind(block.kind)) {
    return { ok: false, findings: [finding('LAYOUT.BLOCK_KIND_NOT_ENTERABLE', 'blocking', block.face_id, { kind: block.kind })] };
  }
  const before: RowValues = {
    id: block.id, org_id: block.org_id, face_id: block.face_id, block_index: block.block_index, kind: block.kind,
    ...(block.binding !== undefined ? { binding: JSON.stringify(block.binding) } : {}),
    ...(block.free_text !== undefined ? { free_text: JSON.stringify(block.free_text) } : {}),
  };
  return buildCommand({
    operation: 'delete', module: MODULE, table: 'support_content_block', id: block.id, org_id: block.org_id,
    before, timestamp, groupKey: null,
  });
}
