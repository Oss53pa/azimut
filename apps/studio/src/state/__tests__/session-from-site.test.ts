import { describe, it, expect } from 'vitest';
import { refMinimal, refMultilevel } from '@azimut/testkit';
import { sessionFromSite, sessionRowsFromSite } from '../session-from-site.js';
import { readSessionGraph } from '../session-graph.js';
import { rowsOf } from '../session-store.js';

/**
 * E5.4 et N1.7 critère 1 — un site enregistré se rouvre tel qu'il est.
 *
 * Le chemin d'écriture était prouvé ; le retour ne l'était pas. Ces essais
 * portent sur le point où il se casse le plus discrètement : le magasin reçoit
 * des lignes de deux origines qui n'encodent pas de la même façon, et une
 * origine mal lue rendrait un graphe amputé plutôt qu'une erreur.
 */
describe('E5.4 — l’atelier repart de l’état du dépôt', () => {
  it('rend une ligne par entité, sous le nom de sa table', () => {
    const rows = sessionRowsFromSite(refMinimal);
    expect(rowsOf({ rows, queued: [], online: true }, 'site')).toHaveLength(1);
    expect(rowsOf({ rows, queued: [], online: true }, 'footprint'))
      .toHaveLength(refMinimal.footprints.length);
    expect(rowsOf({ rows, queued: [], online: true }, 'node'))
      .toHaveLength(refMinimal.graph.nodes.length);
  });

  it('garde l’identifiant de l’entité comme identifiant de ligne', () => {
    const rows = sessionRowsFromSite(refMinimal);
    const nodes = rows.filter(r => r.table === 'node');
    expect(nodes.map(r => r.id).sort())
      .toEqual([...refMinimal.graph.nodes.map(n => n.id)].sort());
  });

  it('n’emporte ni file d’attente ni état hors ligne', () => {
    const state = sessionFromSite(refMinimal);
    expect(state.queued).toEqual([]);
    expect(state.online).toBe(true);
  });

  /**
   * Le point qui se casse en silence : une commande porte la position en JSON,
   * le dépôt la porte déjà analysée. La lecture doit accepter les deux, sans
   * quoi tout nœud rouvert serait illisible et l'empreinte du graphe porterait
   * sur un graphe qui n'existe pas.
   */
  it('rend un graphe entièrement lisible, sans ligne écartée', () => {
    const graph = readSessionGraph(sessionFromSite(refMinimal));
    expect(graph.unreadable).toEqual([]);
    expect(graph.nodes).toHaveLength(refMinimal.graph.nodes.length);
    expect(graph.edges).toHaveLength(refMinimal.graph.edges.length);
  });

  it('rend les liaisons verticales d’un site à plusieurs niveaux', () => {
    const graph = readSessionGraph(sessionFromSite(refMultilevel));
    expect(graph.unreadable).toEqual([]);
    expect(graph.vertical_links).toHaveLength(refMultilevel.graph.vertical_links.length);
  });

  it('rend le graphe à l’identique, attribut par attribut', () => {
    const graph = readSessionGraph(sessionFromSite(refMinimal));
    const expected = [...refMinimal.graph.nodes].sort((a, b) => a.id.localeCompare(b.id));
    const read = [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id));
    expect(read).toEqual(expected);

    const expectedEdges = [...refMinimal.graph.edges].sort((a, b) => a.id.localeCompare(b.id));
    const readEdges = [...graph.edges].sort((a, b) => a.id.localeCompare(b.id));
    expect(readEdges).toEqual(expectedEdges);
  });

  /**
   * A5.8 — le rattachement fait foi en table, et l'atelier le lit dans ses
   * lignes : le bandeau « aucun paquet » de M02.W9 en dépend. La ligne reprend
   * le site et l'organisation, comme en base.
   */
  it('rend le rattachement du site à ses paquets, avec son site', () => {
    const state = sessionFromSite(refMultilevel);
    const bindings = rowsOf(state, 'site_rules_binding');
    expect(bindings.map(r => r.id)).toEqual(refMultilevel.rules_bindings.map(b => b.id));
    expect(bindings[0]?.values).toMatchObject({
      site_id: refMultilevel.site.id,
      org_id: refMultilevel.organization.id,
      role: 'base',
    });
    expect(rowsOf(sessionFromSite(refMinimal), 'site_rules_binding')).toEqual([]);
  });
});
