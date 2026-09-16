/**
 * H2.2 / H2.4 — entrées des deux garde-fous de wayfinding, dérivées des
 * données du site et du tableau des messages.
 *
 * Rien n'est saisi ici : la séquence de jalonnement se lit dans le tableau
 * (quelles destinations sont annoncées à quel point de décision) et dans le
 * graphe (à quel point chacune est atteinte). Les noms d'orientation viennent
 * de l'annuaire, cloisonnés par bâtiment comme le veut H2.2.
 */
import type { SiteData } from '@azimut/core-model';
import type { MessageSchedule, JalonnementSequence, JalonnementStep, NamedEntity } from '@azimut/engine-graph';

/** Bâtiment porteur d'un nœud, via son niveau. */
function buildingOfNode(site: SiteData, nodeId: string): string {
  const node = site.graph.nodes.find(n => n.id === nodeId);
  if (node === undefined) return '';
  const level = site.levels.find(l => l.id === node.level_id);
  return level?.building_id ?? '';
}

/**
 * Séquence de jalonnement du site : un pas par point de décision cité par le
 * tableau, dans l'ordre alphabétique des points — le seul ordre stable tant
 * qu'aucun itinéraire n'est choisi.
 *
 * `announced` : les destinations mentionnées par les lignes rattachées au point.
 * `reached` : les destinations dont le nœud EST ce point.
 */
export function jalonnementFromSchedule(
  site: SiteData,
  schedule: MessageSchedule,
): readonly JalonnementSequence[] {
  const announced = new Map<string, Set<string>>();

  for (const line of schedule.lines) {
    // W4 — toute ligne porte son point de décision : le moteur n'en produit
    // aucune qui n'en ait pas.
    const point = line.decision_point_id;
    const set = announced.get(point) ?? new Set<string>();
    for (const entry of line.entries) {
      if (entry.destination_id !== null) set.add(entry.destination_id);
    }
    announced.set(point, set);
  }

  if (announced.size === 0) return [];

  const reachedAt = new Map<string, string[]>();
  for (const destination of site.destinations) {
    const list = reachedAt.get(destination.node_id) ?? [];
    list.push(destination.id);
    reachedAt.set(destination.node_id, list);
  }

  const steps: JalonnementStep[] = [...announced.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((point): JalonnementStep => ({
      point_id: point,
      announced: [...(announced.get(point) ?? new Set<string>())].sort((a, b) => a.localeCompare(b)),
      reached: [...(reachedAt.get(point) ?? [])].sort((a, b) => a.localeCompare(b)),
    }));

  return [{ id: `${schedule.site_id}#v${String(schedule.version)}`, steps }];
}

/**
 * Noms d'orientation de l'annuaire, cloisonnés par bâtiment. Une destination
 * sans nom dans la langue demandée retombe sur le nom d'occupant, qui est ce
 * que la face afficherait.
 */
export function orientationNames(site: SiteData, lang: string): readonly NamedEntity[] {
  return [...site.destinations]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((destination): NamedEntity => {
      const named = site.destination_names.find(
        n => n.destination_id === destination.id && n.lang === lang,
      );
      return {
        id: destination.id,
        kind: 'destination',
        name: named?.value ?? destination.occupant_name,
        scope: buildingOfNode(site, destination.node_id),
      };
    });
}
