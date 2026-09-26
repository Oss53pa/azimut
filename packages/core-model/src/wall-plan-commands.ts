/**
 * T-2.9 / A5.6 — déclarer ou retirer un emplacement de plan mural.
 *
 * Un emplacement de plan mural n'a pas de table (proposition de schéma, 4.2) :
 * c'est un bloc de contenu de type `map` sur une face de support. Le déclarer
 * écrit ce bloc, et la face d'abord si le support ne la porte pas encore ; le
 * retirer supprime le bloc et laisse la face. Le contenu du bloc n'est pas
 * saisi : le plan se calcule depuis le site (INV-1, INV-2), le bloc ne porte
 * ni liaison ni texte.
 *
 * Commandes du module 04, propriétaire des faces et des blocs (L3). Le
 * fichier est pur : les identifiants et l'horodatage viennent de l'appelant.
 */
import type { SiteData } from './site.js';
import type { ContentBlockInstance } from './site-signage.js';
import { supportFaceCount } from './support-face-commands.js';
import { buildCommand, type EntityCommand, type RowValues } from './site-commands.js';
import type { Finding, Outcome } from './outcome.js';

/** Le type de bloc qui porte un plan mural (A5.6, `content_block.kind`). */
export const WALL_PLAN_BLOCK_KIND = 'map';

export type WallPlanEnvironment = {
  /** Tire un identifiant. Injecté : une commande ne tire pas au sort. */
  readonly newId: () => string;
  /** ISO-8601, fourni par l'appelant (E5.1). */
  readonly timestamp: string;
};

const RULE_REF = 'A5.6';
const MODULE = '04-signaletique';

function refusal(code: string, id: string, params: Record<string, string | number> = {}): Finding {
  return { code, severity: 'blocking', entity: { kind: 'support', id }, params, ruleRef: RULE_REF };
}

/** Les blocs de plan mural du site, face par face. */
export function wallPlanBlocks(site: SiteData): readonly ContentBlockInstance[] {
  return site.content_blocks.filter(b => b.kind === WALL_PLAN_BLOCK_KIND);
}

function command(draft: Parameters<typeof buildCommand>[0]): EntityCommand {
  const out = buildCommand(draft);
  // Le module 04 possède les deux tables et la forme est tenue ici : un refus
  // serait une faute de ce fichier, non une saisie à corriger.
  if (!out.ok) throw new Error(`wall plan command refused: ${out.findings.map(f => f.code).join(', ')}`);
  return out.value;
}

/** Déclare un plan mural sur la face donnée : une ou deux commandes, ou les refus. */
export function declareWallPlanCommands(
  site: SiteData,
  supportId: string,
  faceIndex: number,
  env: WallPlanEnvironment,
): Outcome<readonly EntityCommand[]> {
  const support = site.supports.find(s => s.id === supportId);
  if (support === undefined) {
    return { ok: false, findings: [refusal('LAYOUT.WALL_PLAN_SUPPORT_UNKNOWN', supportId)] };
  }
  const faces = supportFaceCount(site, supportId);
  if (!Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex >= faces) {
    return { ok: false, findings: [refusal('LAYOUT.WALL_PLAN_FACE_OUT_OF_RANGE', supportId, { face: faceIndex, faces })] };
  }

  const face = site.support_faces.find(f => f.support_id === supportId && f.face_index === faceIndex);
  const blocks = face === undefined ? [] : site.content_blocks.filter(b => b.face_id === face.id);
  if (blocks.some(b => b.kind === WALL_PLAN_BLOCK_KIND)) {
    return { ok: false, findings: [refusal('LAYOUT.WALL_PLAN_DUPLICATE', supportId, { face: faceIndex })] };
  }

  const commands: EntityCommand[] = [];
  let faceId = face?.id;
  if (faceId === undefined) {
    faceId = env.newId();
    commands.push(command({
      operation: 'create', module: MODULE, table: 'support_face', id: faceId, org_id: support.org_id,
      after: { id: faceId, org_id: support.org_id, support_id: supportId, face_index: faceIndex },
      timestamp: env.timestamp, groupKey: `wall-plan:${supportId}:${String(faceIndex)}`,
    }));
  }
  const blockId = env.newId();
  const blockIndex = blocks.reduce((max, b) => Math.max(max, b.block_index + 1), 0);
  commands.push(command({
    operation: 'create', module: MODULE, table: 'support_content_block', id: blockId, org_id: support.org_id,
    after: { id: blockId, org_id: support.org_id, face_id: faceId, block_index: blockIndex, kind: WALL_PLAN_BLOCK_KIND },
    timestamp: env.timestamp, groupKey: `wall-plan:${supportId}:${String(faceIndex)}`,
  }));
  return { ok: true, value: commands, warnings: [] };
}

/** Retire un bloc de plan mural. La face reste : d'autres blocs peuvent s'y ajouter. */
export function withdrawWallPlanCommand(block: ContentBlockInstance, timestamp: string): Outcome<EntityCommand> {
  if (block.kind !== WALL_PLAN_BLOCK_KIND) {
    return { ok: false, findings: [refusal('LAYOUT.WALL_PLAN_NOT_A_PLAN', block.id, { kind: block.kind })] };
  }
  const before: RowValues = {
    id: block.id, org_id: block.org_id, face_id: block.face_id, block_index: block.block_index, kind: block.kind,
    ...(block.binding !== undefined ? { binding: JSON.stringify(block.binding) } : {}),
    ...(block.free_text !== undefined ? { free_text: JSON.stringify(block.free_text) } : {}),
  };
  return {
    ok: true,
    value: command({
      operation: 'delete', module: MODULE, table: 'support_content_block', id: block.id, org_id: block.org_id,
      before, timestamp, groupKey: null,
    }),
    warnings: [],
  };
}
