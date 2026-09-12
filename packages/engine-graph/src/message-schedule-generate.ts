/**
 * H2.5 — Génération du tableau des messages.
 *
 * Parcourt les supports posés, résout chaque face par
 * `resolveFaceContent`, et aplatit le résultat en lignes de message.
 *
 * La résolution n'est pas réécrite ici : le tableau et la composition
 * dérivent du même calcul, donc ne peuvent pas diverger (invariant 1).
 */

import type {
  FaceTemplate,
  Finding,
  Outcome,
  SupportType,
} from '@azimut/core-model';
import { deriveDecisionPoints } from './decision-points.js';
import { resolveFaceContent } from './resolve-face.js';
import type { ResolvedBlock } from './resolve-face.js';
import type {
  InformationLevel,
  MessageEntry,
  MessageLine,
  MessageSchedule,
  ScheduleInputs,
} from './message-schedule.js';
import {
  computeScheduleInputsHash,
  messageLineId,
  reduceInformationLevel,
} from './message-schedule.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export type GenerateScheduleOptions = ScheduleInputs & {
  readonly version: number;
  /** ISO-8601 fourni par l'appelant (E5.1, jamais lu dans un moteur). */
  readonly generated_at: string;
};

// ---------------------------------------------------------------------------
// Aplatissement d'un bloc résolu en ligne
// ---------------------------------------------------------------------------

function entriesOfBlock(block: ResolvedBlock): readonly MessageEntry[] {
  const content = block.content;

  switch (content.type) {
    case 'header':
      return [{
        destination_id: null,
        text: { fr: content.site_name, en: content.site_name },
        direction: null,
        distance_m: null,
      }];
    case 'destination_list':
      return content.entries.map((e): MessageEntry => ({
        destination_id: e.destination_id,
        text: e.names,
        direction: e.direction,
        distance_m: e.distance_m,
      }));
    case 'arrow':
      return [{
        destination_id: null,
        text: {},
        direction: content.direction,
        distance_m: null,
      }];
    case 'free_text':
      return [{
        destination_id: null,
        text: { fr: content.text, en: content.text },
        direction: null,
        distance_m: null,
      }];
    case 'pictogram':
    case 'map':
    case 'legend':
    case 'logo':
    case 'emergency_info':
      // Blocs sans texte : la ligne existe pour être revue et validée,
      // son contenu tient dans le pictogramme ou dans le type de bloc.
      return [];
  }
}

function pictogramOfBlock(block: ResolvedBlock): string | null {
  return block.content.type === 'pictogram' ? block.content.pictogram_id : null;
}

function directionOfBlock(block: ResolvedBlock): string | null {
  if (block.content.type === 'arrow') return block.content.direction;
  return null;
}

// ---------------------------------------------------------------------------
// Génération
// ---------------------------------------------------------------------------

function templateFor(
  templates: readonly FaceTemplate[],
  supportTypeKey: string,
  side: string,
): FaceTemplate | null {
  const matches = templates
    .filter(t => t.support_type_key === supportTypeKey && t.side === side)
    .sort((a, b) => a.id.localeCompare(b.id));
  return matches[0] ?? null;
}

/**
 * Génère le tableau des messages.
 *
 * Un support sans typologie connue, ou une face sans gabarit, produit
 * une anomalie et aucune ligne : mieux vaut une ligne manquante et
 * signalée qu'une ligne inventée.
 */
export function generateMessageSchedule(
  options: GenerateScheduleOptions,
): Outcome<MessageSchedule> {
  const { site, supports, profile, informationLevels, rules, version, generated_at } = options;

  const warnings: Finding[] = [];

  const typeByKey = new Map<string, SupportType>(
    site.support_types.map(t => [t.key, t]),
  );

  const levelsByKey = new Map<string, readonly InformationLevel[]>(
    informationLevels.map(l => [l.support_type_key, l.levels]),
  );

  const decisionPoints = deriveDecisionPoints(site, profile, site.destinations);
  const decisionNodeIds = new Set(
    decisionPoints.ok ? decisionPoints.value.map(p => p.node_id) : [],
  );
  if (!decisionPoints.ok) {
    warnings.push(...decisionPoints.findings);
  }

  const lines: MessageLine[] = [];
  const ordered = [...supports].sort((a, b) => a.id.localeCompare(b.id));

  for (const support of ordered) {
    const supportType = typeByKey.get(support.support_type_key);
    if (supportType === undefined) {
      warnings.push({
        code: 'WAYFIND.SUPPORT_TYPE_UNKNOWN',
        severity: 'blocking',
        entity: { kind: 'support', id: support.id },
        params: { support_type_key: support.support_type_key },
        ruleRef: 'H2.5',
      });
      continue;
    }

    const level = reduceInformationLevel(
      levelsByKey.get(support.support_type_key) ?? [],
    );
    const decisionPointId = decisionNodeIds.has(support.node_id) ? support.node_id : null;

    const faces = [...supportType.faces].sort((a, b) => a.side.localeCompare(b.side));

    faces.forEach((face, faceIndex) => {
      const template = templateFor(site.face_templates, supportType.key, face.side);
      if (template === null) {
        warnings.push({
          code: 'WAYFIND.FACE_TEMPLATE_MISSING',
          severity: 'blocking',
          entity: { kind: 'support', id: support.id },
          params: { support_type_key: supportType.key, side: face.side },
          ruleRef: 'H2.5',
        });
        return;
      }

      const resolved = resolveFaceContent(site, template, support.node_id, profile);
      if (!resolved.ok) {
        warnings.push(...resolved.findings);
        return;
      }
      warnings.push(...resolved.warnings);

      resolved.value.blocks.forEach((block, blockIndex) => {
        lines.push({
          id: messageLineId(support.id, faceIndex, blockIndex),
          support_id: support.id,
          face_index: faceIndex,
          block_index: blockIndex,
          block_kind: block.kind,
          entries: entriesOfBlock(block),
          pictogram_id: pictogramOfBlock(block),
          direction: directionOfBlock(block),
          information_level: level,
          decision_point_id: decisionPointId,
          stale: false,
        });
      });
    });
  }

  return {
    ok: true,
    value: {
      site_id: site.site.id,
      version,
      state: 'pending',
      generated_at,
      inputs_hash: computeScheduleInputsHash({
        site, supports, profile, informationLevels, rules,
      }),
      lines,
    },
    warnings,
  };
}
