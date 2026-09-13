/**
 * H2.5 — La composition consomme le tableau des messages.
 *
 * « Le moteur de composition consomme le tableau des messages. Il ne
 * résout pas le contenu directement depuis le graphe. »
 *
 * Répartition des rôles, qui est ce que cette règle impose :
 *
 *   - le **message** vient du tableau : textes par langue, direction,
 *     pictogramme retenu, niveau d'information, point de décision ;
 *   - la **mise en page** vient du gabarit : nature, ordre et région
 *     des blocs. Le tableau n'a pas à en connaître, et H2.5 ne le
 *     demande pas ;
 *   - le **chemin d'un actif** vient du registre des pictogrammes.
 *     Le tableau fixe *quel* pictogramme, pas où son fichier se trouve.
 *
 * Ce que cette étape ne fait pas encore : imposer qu'un tableau soit
 * validé avant d'être composé. `composeFace` accepte un tableau déjà
 * généré et validé, et en génère un à la volée quand l'appelant n'en a
 * pas. Le jour où les tableaux seront versionnés en base, seule la
 * provenance du tableau change — le moteur, lui, consomme déjà des
 * lignes de message et pas le graphe.
 */

import type {
  ContentBlockDef,
  FaceTemplate,
  Finding,
  Outcome,
  Pictogram,
  SiteData,
  SupportType,
  TravelProfile,
} from '@azimut/core-model';
import type { ResolvedBlock, ResolvedContent, ResolvedDestinationEntry, ResolvedFace } from './resolve-face.js';
import {
  resolveMapContent,
  resolveLegendContent,
  resolveLogoContent,
  resolveEmergencyContent,
} from './resolve-face.js';
import type {
  MessageLine,
  MessageSchedule,
  TypologyInformationLevels,
  WayfindingRules,
} from './message-schedule.js';
import { NO_WAYFINDING_RULES } from './message-schedule.js';
import { generateMessageSchedule } from './message-schedule-generate.js';

// ---------------------------------------------------------------------------
// Repérage d'une face
// ---------------------------------------------------------------------------

/**
 * Indice de la face portant ce côté, dans l'ordre que la génération
 * emploie. Les deux doivent trier pareil, sans quoi les lignes se
 * rattacheraient à la mauvaise face.
 */
export function faceIndexForSide(
  supportType: SupportType,
  side: string,
): number | null {
  const sorted = [...supportType.faces].sort((a, b) => a.side.localeCompare(b.side));
  const index = sorted.findIndex(f => f.side === side);
  return index === -1 ? null : index;
}

function sortedBlocks(template: FaceTemplate): readonly ContentBlockDef[] {
  return [...template.blocks].sort(
    (a, b) => a.ordinal - b.ordinal || a.kind.localeCompare(b.kind),
  );
}

// ---------------------------------------------------------------------------
// Ligne de message → contenu composable
// ---------------------------------------------------------------------------

function destinationEntries(
  line: MessageLine,
  findings: Finding[],
): readonly ResolvedDestinationEntry[] {
  const entries: ResolvedDestinationEntry[] = [];

  for (const entry of line.entries) {
    if (entry.destination_id === null) {
      findings.push({
        code: 'WAYFIND.LINE_MALFORMED',
        severity: 'blocking',
        entity: { kind: 'message_line', id: line.id },
        params: { reason: 'destination_id_absent' },
        ruleRef: 'H2.5',
      });
      continue;
    }
    entries.push({
      destination_id: entry.destination_id,
      names: entry.text,
      direction: entry.direction,
      distance_m: entry.distance_m,
    });
  }

  return entries;
}

function firstText(line: MessageLine): string {
  return line.entries[0]?.text['fr'] ?? '';
}

function contentOfLine(
  blockDef: ContentBlockDef,
  line: MessageLine,
  pictograms: readonly Pictogram[],
  findings: Finding[],
  orgName: string,
): ResolvedContent {
  switch (blockDef.kind) {
    case 'header':
      return { type: 'header', site_name: firstText(line) };
    case 'destination_list':
      return { type: 'destination_list', entries: destinationEntries(line, findings) };
    case 'pictogram': {
      const picto = line.pictogram_id === null
        ? undefined
        : pictograms.find(p => p.id === line.pictogram_id);
      return {
        type: 'pictogram',
        pictogram_id: line.pictogram_id,
        svg_path: picto?.svg_path ?? null,
      };
    }
    case 'arrow':
      return { type: 'arrow', direction: line.direction ?? 'forward' };
    case 'free_text':
      return { type: 'free_text', text: firstText(line) };
    case 'map':
      return resolveMapContent(blockDef.config);
    case 'legend':
      return resolveLegendContent(blockDef.config);
    case 'logo':
      return resolveLogoContent(blockDef.config, orgName);
    case 'emergency_info':
      return resolveEmergencyContent(blockDef.config, pictograms);
  }
}

// ---------------------------------------------------------------------------
// Lecture d'une face depuis le tableau
// ---------------------------------------------------------------------------

export type ResolveFromScheduleOptions = {
  readonly schedule: MessageSchedule;
  readonly template: FaceTemplate;
  readonly supportId: string;
  readonly faceIndex: number;
  readonly pictograms: readonly Pictogram[];
  /** Default label for a logo block with no configured one (K-Tier-A). */
  readonly org_name?: string;
};

/**
 * Reconstitue une face composable depuis les lignes du tableau.
 *
 * Une ligne manquante est bloquante : mieux vaut refuser de composer
 * qu'afficher un bloc vide sans le dire. Une ligne périmée passe en
 * avertissement, pour que la composition n'utilise jamais un message
 * dépassé en silence.
 */
export function resolveFaceFromSchedule(
  options: ResolveFromScheduleOptions,
): Outcome<ResolvedFace> {
  const { schedule, template, supportId, faceIndex, pictograms } = options;
  const orgName = options.org_name ?? '';

  const linesByBlock = new Map<number, MessageLine>();
  for (const line of schedule.lines) {
    if (line.support_id !== supportId) continue;
    if (line.face_index !== faceIndex) continue;
    linesByBlock.set(line.block_index, line);
  }

  const findings: Finding[] = [];
  const warnings: Finding[] = [];
  const blocks: ResolvedBlock[] = [];

  sortedBlocks(template).forEach((blockDef, blockIndex) => {
    const line = linesByBlock.get(blockIndex);
    if (line === undefined) {
      findings.push({
        code: 'WAYFIND.LINE_MISSING',
        severity: 'blocking',
        entity: { kind: 'support', id: supportId },
        params: { face_index: faceIndex, block_index: blockIndex, block_kind: blockDef.kind },
        ruleRef: 'H2.5',
      });
      return;
    }

    if (line.stale) {
      warnings.push({
        code: 'WAYFIND.SCHEDULE_STALE',
        severity: 'warning',
        entity: { kind: 'message_line', id: line.id },
        params: { support_id: line.support_id },
        ruleRef: 'H2.5',
      });
    }

    blocks.push({
      kind: blockDef.kind,
      ordinal: blockDef.ordinal,
      region: blockDef.region,
      content: contentOfLine(blockDef, line, pictograms, findings, orgName),
    });
  });

  if (findings.length > 0) {
    return { ok: false, findings };
  }

  return {
    ok: true,
    value: {
      template_id: template.id,
      support_type_key: template.support_type_key,
      side: template.side,
      blocks,
    },
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Composition d'une face
// ---------------------------------------------------------------------------

export type ComposeFaceOptions = {
  readonly site: SiteData;
  readonly template: FaceTemplate;
  readonly profile: TravelProfile;
  /** Identifiant du support composé. */
  readonly supportId: string;
  /** Nœud où le support est posé. */
  readonly nodeId: string;
  /** ISO-8601 fourni par l'appelant, jamais lu dans un moteur. */
  readonly generated_at: string;
  /** Tableau déjà généré et validé. Fourni, il est consommé tel quel. */
  readonly schedule?: MessageSchedule | undefined;
  readonly informationLevels?: readonly TypologyInformationLevels[] | undefined;
  readonly rules?: WayfindingRules | undefined;
  readonly version?: number | undefined;
};

/**
 * Compose une face en passant par le tableau des messages.
 *
 * Le contenu ne vient jamais du graphe : il vient de lignes de message,
 * que l'appelant fournit ou que cette fonction fait générer.
 */
export function composeFace(options: ComposeFaceOptions): Outcome<ResolvedFace> {
  const { site, template, profile, supportId, nodeId, generated_at } = options;

  // ---- Tableau fourni : les indices sont ceux de la typologie déclarée ----
  if (options.schedule !== undefined) {
    const supportType = site.support_types.find(t => t.key === template.support_type_key);
    if (supportType === undefined) {
      return {
        ok: false,
        findings: [{
          code: 'WAYFIND.SUPPORT_TYPE_UNKNOWN',
          severity: 'blocking',
          entity: { kind: 'support', id: supportId },
          params: { support_type_key: template.support_type_key },
          ruleRef: 'H2.5',
        }],
      };
    }
    const faceIndex = faceIndexForSide(supportType, template.side);
    if (faceIndex === null) {
      return {
        ok: false,
        findings: [{
          code: 'WAYFIND.FACE_TEMPLATE_MISSING',
          severity: 'blocking',
          entity: { kind: 'support', id: supportId },
          params: { support_type_key: supportType.key, side: template.side },
          ruleRef: 'H2.5',
        }],
      };
    }
    return resolveFaceFromSchedule({
      schedule: options.schedule,
      template,
      supportId,
      faceIndex,
      pictograms: site.pictograms,
      org_name: site.organization.name,
    });
  }

  // ---- Tableau généré à la volée ----
  //
  // La génération porte sur une typologie d'une seule face, bâtie depuis
  // le gabarit composé. Deux raisons :
  //
  //   - une face dont le côté n'est pas déclaré sur la typologie reste
  //     composable, comme avant H2.5. Le catalogue classe ce cas en
  //     avertissement (DATA.SUPPORT_TEMPLATE_SIDE_NOT_FOUND), pas en
  //     refus, et la bascule n'a pas à durcir cette position ;
  //   - le gabarit composé est celui qui sert, et non le premier gabarit
  //     partageant sa typologie et son côté.
  const declaredType = site.support_types.find(t => t.key === template.support_type_key);
  const syntheticType: SupportType = {
    id: declaredType?.id ?? `synthetic-${template.support_type_key}`,
    org_id: declaredType?.org_id ?? site.organization.id,
    key: template.support_type_key,
    name: declaredType?.name ?? template.support_type_key,
    face_count: 1,
    faces: [{ side: template.side, default_width_mm: 0, default_height_mm: 0 }],
  };

  const generated = generateMessageSchedule({
    site: { ...site, support_types: [syntheticType], face_templates: [template] },
    supports: [{ id: supportId, node_id: nodeId, support_type_key: syntheticType.key }],
    profile,
    informationLevels: options.informationLevels ?? [],
    rules: options.rules ?? NO_WAYFINDING_RULES,
    version: options.version ?? 1,
    generated_at,
  });
  if (!generated.ok) return { ok: false, findings: generated.findings };

  // Une résolution en échec remonte ses anomalies dans les
  // avertissements de la génération. Sans ce relais, l'appelant verrait
  // « ligne absente » au lieu de la cause réelle.
  if (generated.value.lines.length === 0) {
    const blocking = generated.warnings.filter(w => w.severity === 'blocking');
    if (blocking.length > 0) return { ok: false, findings: blocking };
  }

  const face = resolveFaceFromSchedule({
    schedule: generated.value,
    template,
    supportId,
    faceIndex: 0,
    pictograms: site.pictograms,
    org_name: site.organization.name,
  });
  if (!face.ok) return face;

  return {
    ok: true,
    value: face.value,
    warnings: [...generated.warnings, ...face.warnings],
  };
}
