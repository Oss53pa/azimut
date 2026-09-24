import type { SiteData } from '@azimut/core-model';

/**
 * Le graphe du site de référence commercial.
 *
 * Sorti du fichier principal, qu'il ferait franchir les quatre cents lignes
 * qu'A2.4 fixe. Même partage que `ref-multilevel-graph.ts`, pour la même
 * raison.
 *
 * Deux bâtiments, deux entrées propres, cinq niveaux, et entre les deux les
 * seules arêtes qui franchissent une limite de bâtiment : la passerelle
 * couverte du premier étage et le parvis découvert du rez-de-chaussée. Chacune
 * porte sa ligne `building_link` (M01.S10) et sa liaison verticale (A5.3) —
 * deux niveaux de deux bâtiments sont deux niveaux différents, et l'arête qui
 * les relie n'échappe pas à la règle.
 *
 * Les deux sont des rampes, et c'est le relevé, non un artifice : l'annexe est
 * posée soixante centimètres plus haut que la galerie, et le parvis rattrape
 * la différence sur vingt-cinq mètres, à 2,4 %. La passerelle redescend de
 * trente centimètres sur la même portée.
 */
export const REF_RETAIL_GRAPH: SiteData['graph'] = {
  nodes: [
    // — Galerie, rez-de-chaussée —
    {
      id: 'n-rt-g-entree',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-g-rdc',
      kind: 'entrance',
      position: { x_m: 30, y_m: 0 },
      label: 'Entrée Galerie',
    },
    {
      id: 'n-rt-g-lobby',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-g-rdc',
      kind: 'junction',
      // Le lobby commun : les deux bâtiments s'y rejoignent par le parvis.
      position: { x_m: 30, y_m: 10 },
      label: 'Lobby commun',
    },
    {
      id: 'n-rt-g-asc-rdc',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-g-rdc',
      kind: 'elevator',
      position: { x_m: 20, y_m: 10 },
      label: 'Ascenseur Galerie RDC',
    },
    {
      id: 'n-rt-g-esc-rdc',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-g-rdc',
      kind: 'stair',
      position: { x_m: 40, y_m: 10 },
      label: 'Escalier Galerie RDC',
    },
    {
      id: 'n-rt-g-dest-rdc',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-g-rdc',
      kind: 'destination_access',
      position: { x_m: 20, y_m: 20 },
      label: 'Boutique G-001',
    },
    {
      id: 'n-rt-g-parvis',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-g-rdc',
      kind: 'junction',
      position: { x_m: 55, y_m: 10 },
      label: 'Parvis, côté galerie',
    },
    // — Galerie, premier étage —
    {
      id: 'n-rt-g-asc-r1',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-g-r1',
      kind: 'elevator',
      position: { x_m: 20, y_m: 10 },
      label: 'Ascenseur Galerie R+1',
    },
    {
      id: 'n-rt-g-esc-r1',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-g-r1',
      kind: 'stair',
      position: { x_m: 40, y_m: 10 },
      label: 'Escalier Galerie R+1',
    },
    {
      id: 'n-rt-g-hall-r1',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-g-r1',
      kind: 'junction',
      position: { x_m: 30, y_m: 10 },
      label: 'Galerie R+1',
    },
    {
      id: 'n-rt-g-dest-r1',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-g-r1',
      kind: 'destination_access',
      position: { x_m: 20, y_m: 20 },
      label: 'Boutique G-101',
    },
    {
      id: 'n-rt-g-passerelle',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-g-r1',
      kind: 'junction',
      position: { x_m: 55, y_m: 10 },
      label: 'Passerelle, côté galerie',
    },
    // — Galerie, deuxième étage —
    {
      id: 'n-rt-g-asc-r2',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-g-r2',
      kind: 'elevator',
      position: { x_m: 20, y_m: 10 },
      label: 'Ascenseur Galerie R+2',
    },
    {
      id: 'n-rt-g-esc-r2',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-g-r2',
      kind: 'stair',
      position: { x_m: 40, y_m: 10 },
      label: 'Escalier Galerie R+2',
    },
    {
      id: 'n-rt-g-hall-r2',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-g-r2',
      kind: 'junction',
      position: { x_m: 30, y_m: 10 },
      label: 'Galerie R+2',
    },
    {
      id: 'n-rt-g-dest-r2',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-g-r2',
      kind: 'destination_access',
      position: { x_m: 20, y_m: 20 },
      label: 'Boutique G-201',
    },
    // — Annexe, rez-de-chaussée —
    {
      id: 'n-rt-a-entree',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-a-rdc',
      kind: 'entrance',
      position: { x_m: 95, y_m: 0 },
      label: 'Entrée Annexe',
    },
    {
      id: 'n-rt-a-lobby',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-a-rdc',
      kind: 'junction',
      position: { x_m: 95, y_m: 10 },
      label: 'Hall Annexe',
    },
    {
      id: 'n-rt-a-asc-rdc',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-a-rdc',
      kind: 'elevator',
      position: { x_m: 88, y_m: 10 },
      label: 'Ascenseur Annexe RDC',
    },
    {
      id: 'n-rt-a-esc-rdc',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-a-rdc',
      kind: 'stair',
      position: { x_m: 102, y_m: 10 },
      label: 'Escalier Annexe RDC',
    },
    {
      id: 'n-rt-a-dest-rdc',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-a-rdc',
      kind: 'destination_access',
      position: { x_m: 88, y_m: 20 },
      label: 'Boutique A-001',
    },
    {
      id: 'n-rt-a-parvis',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-a-rdc',
      kind: 'junction',
      position: { x_m: 80, y_m: 10 },
      label: 'Parvis, côté annexe',
    },
    // — Annexe, premier étage —
    {
      id: 'n-rt-a-asc-r1',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-a-r1',
      kind: 'elevator',
      position: { x_m: 88, y_m: 10 },
      label: 'Ascenseur Annexe R+1',
    },
    {
      id: 'n-rt-a-esc-r1',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-a-r1',
      kind: 'stair',
      position: { x_m: 102, y_m: 10 },
      label: 'Escalier Annexe R+1',
    },
    {
      id: 'n-rt-a-hall-r1',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-a-r1',
      kind: 'junction',
      position: { x_m: 95, y_m: 10 },
      label: 'Annexe R+1',
    },
    {
      id: 'n-rt-a-dest-r1',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-a-r1',
      kind: 'destination_access',
      position: { x_m: 88, y_m: 20 },
      label: 'Boutique A-101',
    },
    {
      id: 'n-rt-a-passerelle',
      org_id: 'org-test-001',
      level_id: 'lvl-rt-a-r1',
      kind: 'junction',
      position: { x_m: 80, y_m: 10 },
      label: 'Passerelle, côté annexe',
    },
  ],
  edges: [
    // — Galerie, rez-de-chaussée —
    edge('e-rt-g-entree-lobby', 'n-rt-g-entree', 'n-rt-g-lobby', 2.4, 10),
    edge('e-rt-g-lobby-asc', 'n-rt-g-lobby', 'n-rt-g-asc-rdc', 2.4, 10),
    edge('e-rt-g-lobby-esc', 'n-rt-g-lobby', 'n-rt-g-esc-rdc', 1.6, 10),
    edge('e-rt-g-lobby-dest', 'n-rt-g-lobby', 'n-rt-g-dest-rdc', 2.4, 14.142),
    edge('e-rt-g-lobby-parvis', 'n-rt-g-lobby', 'n-rt-g-parvis', 2.4, 25),
    // — Galerie, cage d'ascenseur et cage d'escalier —
    edge('e-rt-g-asc-rdc-r1', 'n-rt-g-asc-rdc', 'n-rt-g-asc-r1', 1.8, 4.5),
    edge('e-rt-g-asc-r1-r2', 'n-rt-g-asc-r1', 'n-rt-g-asc-r2', 1.8, 4.5),
    edge('e-rt-g-esc-rdc-r1', 'n-rt-g-esc-rdc', 'n-rt-g-esc-r1', 1.6, 4.5, {
      accessible: false, evacuation_route: true,
    }),
    edge('e-rt-g-esc-r1-r2', 'n-rt-g-esc-r1', 'n-rt-g-esc-r2', 1.6, 4.5, {
      accessible: false, evacuation_route: true,
    }),
    // — Galerie, premier étage —
    edge('e-rt-g-asc-r1-hall', 'n-rt-g-asc-r1', 'n-rt-g-hall-r1', 2.4, 10),
    edge('e-rt-g-esc-r1-hall', 'n-rt-g-esc-r1', 'n-rt-g-hall-r1', 1.6, 10),
    edge('e-rt-g-hall-r1-dest', 'n-rt-g-hall-r1', 'n-rt-g-dest-r1', 2.4, 14.142),
    edge('e-rt-g-hall-r1-passerelle', 'n-rt-g-hall-r1', 'n-rt-g-passerelle', 2.4, 25),
    // — Galerie, deuxième étage —
    edge('e-rt-g-asc-r2-hall', 'n-rt-g-asc-r2', 'n-rt-g-hall-r2', 2.4, 10),
    edge('e-rt-g-esc-r2-hall', 'n-rt-g-esc-r2', 'n-rt-g-hall-r2', 1.6, 10),
    edge('e-rt-g-hall-r2-dest', 'n-rt-g-hall-r2', 'n-rt-g-dest-r2', 2.4, 14.142),
    // — Annexe, rez-de-chaussée —
    edge('e-rt-a-entree-lobby', 'n-rt-a-entree', 'n-rt-a-lobby', 1.1, 10),
    edge('e-rt-a-lobby-asc', 'n-rt-a-lobby', 'n-rt-a-asc-rdc', 1.1, 7),
    edge('e-rt-a-lobby-esc', 'n-rt-a-lobby', 'n-rt-a-esc-rdc', 1.1, 7),
    edge('e-rt-a-lobby-dest', 'n-rt-a-lobby', 'n-rt-a-dest-rdc', 1.1, 12.207),
    edge('e-rt-a-lobby-parvis', 'n-rt-a-lobby', 'n-rt-a-parvis', 1.1, 15),
    // — Annexe, cage d'ascenseur et cage d'escalier —
    edge('e-rt-a-asc-rdc-r1', 'n-rt-a-asc-rdc', 'n-rt-a-asc-r1', 1.1, 3.6),
    edge('e-rt-a-esc-rdc-r1', 'n-rt-a-esc-rdc', 'n-rt-a-esc-r1', 1.1, 3.6, {
      accessible: false, evacuation_route: true,
    }),
    // — Annexe, premier étage —
    edge('e-rt-a-asc-r1-hall', 'n-rt-a-asc-r1', 'n-rt-a-hall-r1', 1.1, 7),
    edge('e-rt-a-esc-r1-hall', 'n-rt-a-esc-r1', 'n-rt-a-hall-r1', 1.1, 7),
    edge('e-rt-a-hall-r1-dest', 'n-rt-a-hall-r1', 'n-rt-a-dest-r1', 1.1, 12.207),
    edge('e-rt-a-hall-r1-passerelle', 'n-rt-a-hall-r1', 'n-rt-a-passerelle', 1.1, 15),
    // — Les deux seules arêtes entre bâtiments —
    //
    // La passerelle couverte descend de trente centimètres sur vingt-cinq
    // mètres, la galerie étant posée plus haut que l'annexe.
    edge('e-rt-passerelle', 'n-rt-g-passerelle', 'n-rt-a-passerelle', 2, 25.002, {
      slope_pct: -1.2,
    }),
    // Le parvis découvert remonte les soixante centimètres qui séparent les
    // deux rez-de-chaussée, à 2,4 %.
    edge('e-rt-parvis', 'n-rt-g-parvis', 'n-rt-a-parvis', 3, 25.007, {
      slope_pct: 2.4,
    }),
  ],
  vertical_links: [
    link('vl-rt-g-asc-rdc-r1', 'e-rt-g-asc-rdc-r1', 'elevator', 8, true),
    link('vl-rt-g-asc-r1-r2', 'e-rt-g-asc-r1-r2', 'elevator', 8, true),
    link('vl-rt-g-esc-rdc-r1', 'e-rt-g-esc-rdc-r1', 'stair', 60, false),
    link('vl-rt-g-esc-r1-r2', 'e-rt-g-esc-r1-r2', 'stair', 60, false),
    link('vl-rt-a-asc-rdc-r1', 'e-rt-a-asc-rdc-r1', 'elevator', 6, true),
    link('vl-rt-a-esc-rdc-r1', 'e-rt-a-esc-rdc-r1', 'stair', 40, false),
    // A5.3 — les deux arêtes entre bâtiments relient elles aussi deux niveaux
    // différents, et portent donc leur liaison. Ce sont des rampes : elles
    // gagnent leur dénivelée en avançant.
    link('vl-rt-passerelle', 'e-rt-passerelle', 'ramp', 40, true),
    link('vl-rt-parvis', 'e-rt-parvis', 'ramp', 60, true),
  ],
  /**
   * M01.S10 — une couverte, une non couverte, comme C1 le demande de ce site.
   *
   * Le contre-exemple n'est pas ici : c'est `ref-broken` qui porte l'arête
   * entre bâtiments à laquelle la ligne manque, et sur laquelle
   * `GRAPH.BUILDING_LINK_MISSING` se lève.
   */
  building_links: [
    {
      id: 'bl-rt-passerelle',
      org_id: 'org-test-001',
      edge_id: 'e-rt-passerelle',
      from_building_id: 'bldg-rt-galerie',
      to_building_id: 'bldg-rt-annexe',
      sheltered: true,
    },
    {
      id: 'bl-rt-parvis',
      org_id: 'org-test-001',
      edge_id: 'e-rt-parvis',
      from_building_id: 'bldg-rt-galerie',
      to_building_id: 'bldg-rt-annexe',
      sheltered: false,
    },
  ],
};

/**
 * Une arête du site, sous ses valeurs courantes.
 *
 * Vingt-neuf arêtes écrites en toutes lettres tiendraient trois cents lignes
 * où seuls quatre champs varient. Ce qui varie reste écrit, ce qui ne varie
 * pas est nommé une fois.
 *
 * `length_m` est donnée et non calculée : M01.S6 veut la longueur calculée
 * dans l'application, et `edge-length.test.ts` vérifie que celle écrite ici
 * est bien celle que mesurent les nœuds. La calculer ici ferait disparaître ce
 * contrôle.
 */
function edge(
  id: string,
  from: string,
  to: string,
  widthM: number,
  lengthM: number,
  over: {
    readonly slope_pct?: number;
    readonly accessible?: boolean;
    readonly evacuation_route?: boolean;
  } = {},
): SiteData['graph']['edges'][number] {
  return {
    id,
    org_id: 'org-test-001',
    from_node_id: from,
    to_node_id: to,
    width_m: widthM,
    slope_pct: over.slope_pct ?? 0,
    accessible: over.accessible ?? true,
    direction: 'both',
    evacuation_route: over.evacuation_route ?? false,
    length_m: lengthM,
  };
}

function link(
  id: string,
  edgeId: string,
  kind: SiteData['graph']['vertical_links'][number]['kind'],
  capacity: number,
  accessible: boolean,
): SiteData['graph']['vertical_links'][number] {
  return { id, org_id: 'org-test-001', edge_id: edgeId, kind, capacity, accessible };
}
