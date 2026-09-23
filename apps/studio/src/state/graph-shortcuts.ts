/**
 * M4 (partie M) — les quatre outils de la saisie du graphe, et leur touche.
 *
 * | Nœud | `N` | Le type se choisit avant le geste, jamais après |
 * | Arête | `E` | Relie deux nœuds |
 * | Axe de circulation | `X` | Tracé continu produisant nœuds et arêtes |
 * | Liaison verticale | `L` | Relie deux nœuds de niveaux différents |
 *
 * La table est en donnée, comme E16 le demande, et elle vit ici plutôt que
 * dans l'écran : la barre d'outils l'affiche, l'adaptateur la lie au clavier,
 * et une table déclarée dans l'un des deux obligerait l'autre à l'importer
 * d'un composant d'affichage.
 */
import type { UiMessageKey } from '../i18n/messages.js';

export const GRAPH_TOOLS = [
  { tool: 'node', key: 'N', labelKey: 'graph.tool.node' },
  { tool: 'edge', key: 'E', labelKey: 'graph.tool.edge' },
  { tool: 'axis', key: 'X', labelKey: 'graph.tool.axis' },
  { tool: 'vertical_link', key: 'L', labelKey: 'graph.tool.vertical_link' },
] as const satisfies readonly { tool: string; key: string; labelKey: UiMessageKey }[];

export type GraphTool = (typeof GRAPH_TOOLS)[number]['tool'];

/** L'outil qu'une touche nue active, ou `null` si aucune ne le fait. */
export function graphToolForKey(key: string): GraphTool | null {
  return GRAPH_TOOLS.find(t => t.key === key.toUpperCase())?.tool ?? null;
}
