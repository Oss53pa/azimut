/**
 * M4 (partie M), outil « Liaison verticale » : « Relie deux nœuds de niveaux
 * différents. »
 *
 * T-1.5 le demande et A5.3 le contraint : « Une arête entre deux niveaux
 * différents doit avoir une ligne `vertical_link`. » Les deux écritures vont
 * donc ensemble ou pas du tout, et c'est ce module qui les tient ensemble :
 * il rend l'arête et la liaison d'un seul tenant, ou il refuse.
 *
 * Il n'écrit rien. `graphCommands` s'en charge, et il sait déjà poser les
 * trois tables dans l'ordre de leurs dépendances.
 *
 * Ce qu'il ne refait pas : la boucle sur soi et la longueur sous tolérance
 * sont jugées par `acceptEdge`, qu'il appelle. Les réécrire ici donnerait deux
 * définitions de la même règle, et celle que l'écran applique finirait par
 * s'écarter de celle que la validation applique.
 */
import type { Finding, Outcome, Point } from '@azimut/core-model';
import { acceptEdge } from './graph-input.js';
import type { AcceptedEdge, EdgeDirection, VerticalLinkKind } from './graph-input.js';

/**
 * Une extrémité de la liaison : un nœud qui existe déjà, sur son niveau.
 *
 * L'outil ne pose pas de nœud. Une liaison verticale relie un lieu réel d'un
 * niveau au lieu qui lui correspond à l'étage : les deux sont des nœuds du
 * relevé, et en inventer un placerait une cage d'ascenseur là où personne ne
 * l'a vue.
 */
export type LinkEnd = {
  readonly nodeId: string;
  readonly levelId: string;
  readonly position: Point;
  /** Altitude du niveau, relative à `site.reference_elevation_m` (N1.2). */
  readonly elevationM: number;
};

export type VerticalLinkDraft = {
  readonly from: LinkEnd;
  readonly to: LinkEnd;
  readonly kind: VerticalLinkKind;
  readonly accessible: boolean;
  /**
   * A5.3, `capacity int`. Requise : la colonne est `NOT NULL DEFAULT 1`
   * (migration 0004) et le modèle la porte en `number`. Une capacité absente
   * n'est donc pas représentable, et l'écran la propose à la valeur par
   * défaut de la colonne plutôt qu'à une valeur choisie ici.
   */
  readonly capacity: number;
  readonly widthM: number;
  readonly direction: EdgeDirection;
};

export type AcceptedVerticalLink = {
  readonly edge: AcceptedEdge;
  readonly kind: VerticalLinkKind;
  readonly accessible: boolean;
  readonly capacity: number;
};

/** Une capacité compte des personnes : entière et au moins un. */
export const CAPACITY_MIN = 1;

export function acceptVerticalLink(
  draft: VerticalLinkDraft,
): Outcome<AcceptedVerticalLink> {
  const findings: Finding[] = [];

  // M4 (partie M) : « Relie deux nœuds de niveaux différents. » Deux nœuds
  // d'un même niveau font une arête ordinaire ; lui adjoindre une liaison
  // verticale écrirait une liaison qu'aucun contrôle ne rattraperait —
  // `verticalLinkMisalignedFindings` écarte justement les liaisons dont les
  // deux nœuds partagent un niveau.
  if (draft.from.levelId === draft.to.levelId) {
    findings.push(finding('GRAPH.VERTICAL_LINK_SAME_LEVEL', {
      level: draft.from.levelId,
    }));
  }

  if (!Number.isInteger(draft.capacity) || draft.capacity < CAPACITY_MIN) {
    findings.push(finding('DATA.CAPACITY_INVALID', {
      capacity: draft.capacity, minimum: CAPACITY_MIN,
    }));
  }

  if (findings.length > 0) return { ok: false, findings };

  const edge = acceptEdge({
    from: {
      nodeId: draft.from.nodeId,
      levelId: draft.from.levelId,
      position: draft.from.position,
      elevation_m: draft.from.elevationM,
    },
    to: {
      nodeId: draft.to.nodeId,
      levelId: draft.to.levelId,
      position: draft.to.position,
      elevation_m: draft.to.elevationM,
    },
    widthM: draft.widthM,
    slopePct: 0,
    accessible: draft.accessible,
    direction: draft.direction,
    evacuationRoute: false,
    // Ce que l'outil promet, et que l'appelant tient en écrivant la liaison
    // dans le même groupe que l'arête.
    hasVerticalLink: true,
  });
  if (!edge.ok) return { ok: false, findings: edge.findings };

  return {
    ok: true,
    value: {
      edge: edge.value,
      kind: draft.kind,
      accessible: draft.accessible,
      capacity: draft.capacity,
    },
    warnings: edge.warnings,
  };
}

function finding(code: string, params: Record<string, string | number>): Finding {
  return {
    code,
    severity: 'blocking',
    entity: null,
    params,
    ruleRef: 'partieM-M4 (partie M)',
  };
}
