import type { Finding, Outcome } from '@azimut/core-model';
import { codePointCompare } from '@azimut/core-model';

/**
 * H2.2 — A site is oriented first by how it is named. Naming rules are declared
 * and checked; uniqueness among them. On multi-building sites two doors "A"
 * frequently coexist, which is a naming collision. This guard detects two
 * entities carrying the same orientation name within the same scope and raises
 * a blocking WAYFIND.NAMING_COLLISION.
 *
 * Names are compared case-insensitively on trimmed, whitespace-collapsed text —
 * "Porte A" and "porte  a" collide — because a panel reader does not tell them
 * apart. The scope key (e.g. a building id, or "" for a site-wide namespace) is
 * declared by the caller so uniqueness is checked within the intended namespace.
 */
export type NamedEntity = {
  readonly id: string;
  readonly kind: string;
  /** Orientation name (H2.2), never free panel text. */
  readonly name: string;
  /** Namespace within which the name must be unique. */
  readonly scope: string;
};

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Guard orientation-name uniqueness. Every group of two or more entities that
 * share a normalized name within one scope yields one blocking
 * WAYFIND.NAMING_COLLISION per colliding entity, sorted by entity id; the
 * finding names the colliding entities and the offending name.
 */
export function guardNamingCollisions(
  entities: readonly NamedEntity[],
): Outcome<null> {
  // group key: scope + normalized name. Deterministic assembly.
  const groups = new Map<string, NamedEntity[]>();
  for (const entity of entities) {
    const key = `${entity.scope}\u0000${normalizeName(entity.name)}`;
    const list = groups.get(key) ?? [];
    list.push(entity);
    groups.set(key, list);
  }

  const findings: Finding[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const sortedMembers = [...members].sort((a, b) => codePointCompare(a.id, b.id));
    const collidingIds = sortedMembers.map((m) => m.id).join(',');
    for (const entity of sortedMembers) {
      findings.push({
        code: 'WAYFIND.NAMING_COLLISION',
        severity: 'blocking',
        entity: { kind: entity.kind, id: entity.id },
        params: {
          name: entity.name,
          scope: entity.scope,
          colliding_ids: collidingIds,
        },
        ruleRef: 'H2.2',
      });
    }
  }

  findings.sort((a, b) => codePointCompare(a.entity?.id ?? '', b.entity?.id ?? ''));

  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, value: null, warnings: [] };
}
