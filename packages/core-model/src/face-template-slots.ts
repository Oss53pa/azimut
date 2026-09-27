/**
 * A5.6 / D8 — le gabarit d'une face, et ses emplacements.
 *
 * Un bloc saisi sur une face n'a pas de région : il remplit l'emplacement du
 * gabarit de même indice, s'il est de même nature (décision du 26/09/2026).
 * L'indice d'un emplacement est la place du bloc dans le gabarit trié par
 * ordinal puis par nature — celle que prend `message_line.block_index`.
 *
 * L'indice d'une face est la place de son côté parmi les faces de la
 * typologie triées par côté, comme dans la génération du tableau des
 * messages. Une seule définition, ici, pour que les deux ne divergent pas.
 */
import type { SiteData } from './site.js';
import type { ContentBlockDef, ContentBlockInstance, FaceTemplate, Support, SupportType } from './site-signage.js';
import { supportTypologyOf } from './site-signage.js';
import type { Finding, Outcome } from './outcome.js';

/** La nature d'emplacement qu'un bloc d'instance remplit. */
export const INSTANCE_SLOT_KIND: Readonly<Record<string, ContentBlockDef['kind']>> = {
  free: 'free_text',
  map: 'map',
  legend: 'legend',
};

/** Le premier gabarit de la typologie pour ce côté, par identifiant. */
export function templateForSide(
  templates: readonly FaceTemplate[],
  supportTypeKey: string,
  side: string,
): FaceTemplate | null {
  const matches = templates
    .filter(t => t.support_type_key === supportTypeKey && t.side === side)
    .sort((a, b) => a.id.localeCompare(b.id));
  return matches[0] ?? null;
}

/** Les côtés de la typologie, dans l'ordre des indices de face. */
export function sortedSides(supportType: SupportType): readonly string[] {
  return [...supportType.faces].sort((a, b) => a.side.localeCompare(b.side)).map(f => f.side);
}

/** Les blocs du gabarit dans l'ordre des emplacements. */
export function templateSlots(template: FaceTemplate): readonly ContentBlockDef[] {
  return [...template.blocks].sort((a, b) => a.ordinal - b.ordinal || a.kind.localeCompare(b.kind));
}

/** Le gabarit de la face `faceIndex` du support, ou `null` s'il n'est pas connu au poste. */
export function faceTemplate(site: SiteData, support: Support, faceIndex: number): FaceTemplate | null {
  const typology = supportTypologyOf(site.support_types, support);
  if (typology === null) return null;
  const side = sortedSides(typology)[faceIndex];
  if (side === undefined) return null;
  return templateForSide(site.face_templates, typology.key, side);
}

/** Vrai si le bloc d'instance a son emplacement, de même nature, dans le gabarit. */
export function fitsSlot(template: FaceTemplate, block: Pick<ContentBlockInstance, 'kind' | 'block_index'>): boolean {
  const slotKind = INSTANCE_SLOT_KIND[block.kind];
  return slotKind !== undefined && templateSlots(template)[block.block_index]?.kind === slotKind;
}

/** Les blocs d'instance de la face `faceIndex` du support. */
export function instanceBlocksOf(site: SiteData, supportId: string, faceIndex: number): readonly ContentBlockInstance[] {
  const face = site.support_faces.find(f => f.support_id === supportId && f.face_index === faceIndex);
  if (face === undefined) return [];
  return site.content_blocks
    .filter(b => b.face_id === face.id)
    .sort((a, b) => a.block_index - b.block_index || a.id.localeCompare(b.id));
}

/** Le texte d'un bloc libre par langue ; les entrées non textuelles sont écartées. */
export function freeTextsOf(block: Pick<ContentBlockInstance, 'free_text'>): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [lang, value] of Object.entries(block.free_text ?? {})) {
    if (typeof value === 'string') out[lang] = value;
  }
  return out;
}

/** L'emplacement retenu pour un bloc d'instance, et ce qu'il faut en dire. */
export type SlotChoice = { readonly index: number; readonly warnings: readonly Finding[] };

function slotFinding(code: string, severity: Finding['severity'], supportId: string, params: Record<string, string | number>): Finding {
  return { code, severity, entity: { kind: 'support', id: supportId }, params, ruleRef: 'D8.3' };
}

/**
 * Choisit l'emplacement d'un nouveau bloc d'instance sur la face `faceIndex`.
 *
 * Gabarit connu : l'emplacement demandé doit être de même nature, sinon le
 * premier libre de cette nature ; aucun, refus. Gabarit inconnu au poste
 * (ils ne sont pas stockés en base) : l'emplacement demandé, sinon le suivant
 * des blocs existants, avec un avertissement — le contrôle `instance_blocks`
 * le jugera là où le gabarit est connu. Un emplacement déjà rempli est refusé.
 */
export function chooseSlot(
  site: SiteData,
  support: Support,
  faceIndex: number,
  kind: string,
  existing: readonly Pick<ContentBlockInstance, 'block_index'>[],
  requested: number | undefined,
): Outcome<SlotChoice> {
  const taken = new Set(existing.map(b => b.block_index));
  const params = { face_index: faceIndex, kind };
  const template = faceTemplate(site, support, faceIndex);
  if (template === null) {
    const index = requested ?? existing.reduce((max, b) => Math.max(max, b.block_index + 1), 0);
    if (taken.has(index)) {
      return { ok: false, findings: [slotFinding('LAYOUT.BLOCK_SLOT_TAKEN', 'blocking', support.id, { ...params, block_index: index })] };
    }
    return { ok: true, value: { index, warnings: [slotFinding('LAYOUT.FACE_TEMPLATE_NOT_AT_HAND', 'warning', support.id, { ...params, block_index: index })] }, warnings: [] };
  }
  const fitting = templateSlots(template)
    .map((_, index) => index)
    .filter(index => fitsSlot(template, { kind, block_index: index }));
  const index = requested ?? fitting.find(i => !taken.has(i));
  if (index === undefined || !fitting.includes(index)) {
    return { ok: false, findings: [slotFinding('LAYOUT.INSTANCE_BLOCK_NO_SLOT', 'blocking', support.id, { ...params, block_index: index ?? -1, template_id: template.id })] };
  }
  if (taken.has(index)) {
    return { ok: false, findings: [slotFinding('LAYOUT.BLOCK_SLOT_TAKEN', 'blocking', support.id, { ...params, block_index: index })] };
  }
  return { ok: true, value: { index, warnings: [] }, warnings: [] };
}
