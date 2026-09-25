import type { SiteData } from '@azimut/core-model';

/**
 * Les noms que les registres affichent pour les objets du site. Une
 * destination se nomme dans la langue active, puis par son occupant ; un nœud
 * par son libellé. À défaut, l'identifiant : un objet n'est jamais anonyme.
 */
export function siteLabels(site: SiteData, lang: string): {
  readonly node: (id: string) => string;
  readonly nodeLevel: (id: string) => string | null;
  readonly level: (id: string) => string;
  readonly destination: (id: string) => string;
} {
  const nodes = new Map(site.graph.nodes.map(n => [n.id, n]));
  const levels = new Map(site.levels.map(l => [l.id, l.name]));
  const names = new Map<string, string>();
  for (const n of site.destination_names) {
    if (n.lang === lang) names.set(n.destination_id, n.value);
  }
  const occupants = new Map(site.destinations.map(d => [d.id, d.occupant_name]));
  return {
    node: id => nodes.get(id)?.label ?? id,
    nodeLevel: id => nodes.get(id)?.level_id ?? null,
    level: id => levels.get(id) ?? id,
    destination: id => names.get(id) ?? occupants.get(id) ?? id,
  };
}
