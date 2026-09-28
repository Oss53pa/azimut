/**
 * A5.6 / D8.3 — saisir les blocs de contenu d'une face de support.
 *
 * « Un bloc `free` est le seul dont le texte est saisi » (D8.3), et E1.4 ne
 * laisse, en contexte 3, que « Saisir du texte libre : blocs `free`
 * seulement ». Les autres blocs viennent du gabarit et sont résolus par le
 * tableau des messages (INV-1, INV-2). Toute autre nature se refuse par
 * `EDIT.CONTEXT_VIOLATION`.
 *
 * Le texte d'un bloc libre a une entrée par langue — `{"fr": "…", "en": "…"}`
 * (A5.6) — parmi les langues de la face, à défaut celles du site. Une langue
 * de la face restée sans texte est signalée, sans bloquer. Ces contrôles de
 * saisie n'ont pas de code au catalogue : ce sont des refus de formulaire
 * (D2.2, décision du 28/09/2026).
 *
 * Commandes du module 04 (L3). Le fichier est pur.
 */
import type { SiteData } from './site.js';
import type { ContentBlockInstance, SupportFace } from './site-signage.js';
import { buildCommand, type EntityCommand, type RowValues } from './site-commands.js';
import { chooseSlot, freeTextsOf } from './face-template-slots.js';
import type { Finding } from './outcome.js';
import { asFormOutcome, notice, refusedBy, type FormNotice, type FormOutcome } from './form-notice.js';

/** E1.4, contexte 3 : le bloc `free`, et lui seul. */
export const ENTERABLE_BLOCK_KINDS = ['free'] as const;
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

const MODULE = '04-signaletique';

/** E1.4 — une nature de bloc que le contexte 3 ne laisse pas saisir. */
function contextViolation(faceId: string, kind: string): FormOutcome<never> {
  const finding: Finding = {
    code: 'EDIT.CONTEXT_VIOLATION', severity: 'blocking', entity: { kind: 'face', id: faceId },
    params: { kind }, ruleRef: 'E1.4',
  };
  return { ok: false, findings: [finding], notices: [] };
}

/** Les langues d'une face : les siennes, à défaut celles du site. */
export function faceLangs(site: SiteData, face: SupportFace): readonly string[] {
  return face.langs !== undefined && face.langs.length > 0 ? face.langs : site.site.active_langs;
}

/** Le texte d'un bloc libre tel que la base le porte, ses entrées non textuelles écartées. */
export function readFreeTexts(block: ContentBlockInstance): FreeTexts {
  return freeTextsOf(block);
}

/** Le texte tel qu'il s'écrit : langues de la face, dans leur ordre, textes non vides. */
function freeTextValue(langs: readonly string[], texts: FreeTexts): string | null {
  const entries = langs
    .map(l => [l, (texts[l] ?? '').trim()] as const)
    .filter(([, text]) => text !== '');
  return entries.length === 0 ? null : JSON.stringify(Object.fromEntries(entries));
}

/** Refus et avis d'un texte libre sur la face. */
function checkTexts(site: SiteData, face: SupportFace, texts: FreeTexts): { blocking: FormNotice[]; warnings: FormNotice[] } {
  const langs = faceLangs(site, face);
  const blocking: FormNotice[] = [];
  for (const [lang, text] of Object.entries(texts)) {
    if (text.trim() !== '' && !langs.includes(lang)) {
      blocking.push(notice('form.free_text.lang.outside_face', 'blocking', { lang }));
    }
  }
  const filled = langs.filter(l => (texts[l] ?? '').trim() !== '');
  if (filled.length === 0) blocking.push(notice('form.free_text.empty'));
  const warnings = filled.length === 0
    ? []
    : langs.filter(l => !filled.includes(l)).map(lang => notice('form.free_text.lang.missing', 'warning', { lang }));
  return { blocking, warnings };
}

/** Ajoute un bloc libre sur la face, à l'emplacement du gabarit qui l'attend. */
export function declareBlockCommand(
  site: SiteData,
  face: SupportFace,
  kind: string,
  texts: FreeTexts,
  env: BlockEnvironment,
  /** L'emplacement du gabarit visé ; absent, le premier libre de cette nature. */
  slot?: number,
): FormOutcome<EntityCommand> {
  if (!isEnterableBlockKind(kind)) return contextViolation(face.id, kind);
  const checked = checkTexts(site, face, texts);
  if (checked.blocking.length > 0) return refusedBy(checked.blocking);
  const freeText = freeTextValue(faceLangs(site, face), texts);
  const support = site.supports.find(s => s.id === face.support_id);
  if (support === undefined) return refusedBy([notice('form.face.support.unknown')]);
  const chosen = chooseSlot(site, support, face.face_index, kind, site.content_blocks.filter(b => b.face_id === face.id), slot);
  if (!chosen.ok) return chosen;
  const id = env.newId();
  const after: RowValues = {
    id, org_id: face.org_id, face_id: face.id, block_index: chosen.value.index, kind,
    ...(freeText !== null ? { free_text: freeText } : {}),
  };
  return asFormOutcome(buildCommand({
    operation: 'create', module: MODULE, table: 'support_content_block', id, org_id: face.org_id,
    after, timestamp: env.timestamp, groupKey: null,
  }), [...checked.warnings, ...chosen.value.notices]);
}

/** Réécrit le texte d'un bloc libre de la face. */
export function updateFreeTextCommand(
  site: SiteData,
  face: SupportFace,
  block: ContentBlockInstance,
  texts: FreeTexts,
  timestamp: string,
): FormOutcome<EntityCommand> {
  if (block.kind !== 'free' || block.face_id !== face.id) return contextViolation(face.id, block.kind);
  const checked = checkTexts(site, face, texts);
  if (checked.blocking.length > 0) return refusedBy(checked.blocking);
  return asFormOutcome(buildCommand({
    operation: 'update', module: MODULE, table: 'support_content_block', id: block.id, org_id: block.org_id,
    before: { free_text: block.free_text === undefined ? null : JSON.stringify(block.free_text) },
    after: { free_text: freeTextValue(faceLangs(site, face), texts) },
    timestamp, groupKey: null,
  }), checked.warnings);
}

/** Retire un bloc libre ; l'inverse le recrée à l'identique. */
export function withdrawBlockCommand(block: ContentBlockInstance, timestamp: string): FormOutcome<EntityCommand> {
  if (!isEnterableBlockKind(block.kind)) return contextViolation(block.face_id, block.kind);
  const before: RowValues = {
    id: block.id, org_id: block.org_id, face_id: block.face_id, block_index: block.block_index, kind: block.kind,
    ...(block.binding !== undefined ? { binding: JSON.stringify(block.binding) } : {}),
    ...(block.free_text !== undefined ? { free_text: JSON.stringify(block.free_text) } : {}),
  };
  return asFormOutcome(buildCommand({
    operation: 'delete', module: MODULE, table: 'support_content_block', id: block.id, org_id: block.org_id,
    before, timestamp, groupKey: null,
  }));
}
