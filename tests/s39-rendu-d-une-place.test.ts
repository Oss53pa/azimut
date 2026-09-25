import { describe, it, expect } from 'vitest';
import { refMultilevel } from '@azimut/testkit';
import { renderFloorPlan, renderOrientedPlan, renderEvacuationPlan } from '@azimut/engine-layout';
import type {
  FloorPlanTheme, FloorPlanOptions,
  OrientedPlanTheme, OrientedPlanOptions,
  EvacuationTheme, EvacuationPlanOptions,
} from '@azimut/engine-layout';
import { renderIsoView } from '@azimut/engine-iso';
import type { IsoTheme, IsoOptions } from '@azimut/engine-iso';
import type { Pictogram, SiteData, Volume } from '@azimut/core-model';

/**
 * S-39 — « Rendu d'une place de stationnement, dans toutes les vues :
 *
 * - Plan de niveau et plan orienté : contour léger, sans libellé. Une place ne
 *   porte ni occupant ni catégorie, et ne doit pas concurrencer visuellement
 *   les cellules commerciales.
 * - Place accessible : elle porte le pictogramme normalisé du registre de
 *   sécurité, jamais un symbole maison, section A1.2, invariant 3.
 * - Vue isométrique : la place reste au sol, sans volume.
 * - Plan d'évacuation : elle n'y apparaît pas, sauf si elle porte un
 *   cheminement d'évacuation. »
 *
 * Quatre vues, une règle. L'essai est ici, et non dans chaque moteur, parce
 * que c'est la cohérence des quatre qui fait la règle : trois vues conformes
 * et une quatrième qui dresse un parking en relief laisseraient la règle
 * violée sans qu'aucun essai de moteur ne le voie.
 *
 * `refMultilevel` porte quatre places au RDC, dont une accessible, `fp-ml-a3`.
 */

const RDC = 'lvl-ml-rdc';
const PLACES = ['fp-ml-a1', 'fp-ml-a2', 'fp-ml-a3', 'fp-ml-b1'];
const ACCESSIBLE = 'fp-ml-a3';

/** Le tracé sert de marqueur : il n'a pas à ressembler au vrai pictogramme. */
const TRACE = 'M4 4 L26 4 L26 26 L4 26 Z';

const pictoSecurite: Pictogram = {
  id: 'picto-pmr',
  org_id: 'org-test-001',
  category_id: 'cat-secu',
  source: 'rules_pack',
  standard_ref: 'à renseigner par l’expert normatif',
  svg_path: TRACE,
  registry: 'safety',
};

const floorTheme: FloorPlanTheme = {
  background: 'tok-bg',
  footprint_fill: 'tok-fp-fill', footprint_stroke: 'tok-fp-stroke',
  parking_fill: 'tok-park-fill', parking_stroke: 'tok-park-stroke',
  uncovered_fill: 'tok-unc-fill', uncovered_stroke: 'tok-unc-stroke',
  edge_stroke: 'tok-edge', edge_evacuation_stroke: 'tok-evac',
  node_fill: 'tok-node', node_stroke: 'tok-node-stroke',
  node_safety_fill: 'tok-safety',
  text_primary: 'tok-txt', text_secondary: 'tok-txt2',
};

const floorOpts: FloorPlanOptions = {
  width_px: 800, height_px: 600, theme: floorTheme, font_family: 'Helvetica',
  show_destinations: true, show_edges: true, padding_px: 20,
};

const orientedTheme: OrientedPlanTheme = {
  background: 'tok-bg',
  parking_fill: 'tok-park-fill', parking_stroke: 'tok-park-stroke',
  footprint_fill: 'tok-fp-fill', footprint_stroke: 'tok-fp-stroke',
  edge_stroke: 'tok-edge', edge_evacuation_stroke: 'tok-evac',
  node_fill: 'tok-node', node_stroke: 'tok-node-stroke',
  node_safety_fill: 'tok-safety',
  text_primary: 'tok-txt', text_secondary: 'tok-txt2',
  marker_fill: 'tok-marker', marker_stroke: 'tok-marker-stroke',
};

const orientedOpts: OrientedPlanOptions = {
  width_px: 800, height_px: 600, theme: orientedTheme, font_family: 'Helvetica',
  orientation_deg: 0, viewer_position: { x_m: 0, y_m: 0 },
  show_destinations: true, show_edges: true, show_north_arrow: true, padding_px: 20,
};

function svgOf(outcome: { ok: boolean }): string {
  expect(outcome.ok, 'rendu refusé').toBe(true);
  return (outcome as { ok: true; value: string }).value;
}

/** Les attributs d'un `<polygon>` dont le remplissage porte ce jeton. */
function polygonsWith(svg: string, jeton: string): string[] {
  return [...svg.matchAll(/<polygon[^>]*\/>/g)]
    .map(m => m[0])
    .filter(tag => tag.includes(`fill="${jeton}"`));
}

describe('S-39 — plan de niveau : contour léger, sans libellé', () => {
  const svg = svgOf(renderFloorPlan(refMultilevel, RDC, floorOpts));

  it('dessine les quatre places avec le jeton des places, non celui du bâti', () => {
    expect(polygonsWith(svg, 'tok-park-fill')).toHaveLength(4);
  });

  it('leur donne un trait plus fin que celui d’une empreinte de bâti', () => {
    // « Contour léger » : une place est un marquage au sol, elle ne doit pas
    // concurrencer une cellule commerciale sur le même plan.
    for (const tag of polygonsWith(svg, 'tok-park-fill')) {
      expect(tag).toContain('stroke-width="0.5"');
    }
    for (const tag of polygonsWith(svg, 'tok-fp-fill')) {
      expect(tag).toContain('stroke-width="1"');
    }
  });

  it('ne pose aucun libellé sur une place', () => {
    // Structurellement garanti : un libellé vient d'une destination, et S-40
    // dit qu'une place n'en est pas une. L'essai le tient quand même, parce
    // que c'est la règle qui compte, pas le chemin par lequel elle est tenue.
    const libelles = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1]);
    for (const place of PLACES) {
      expect(libelles).not.toContain(place);
    }
    expect(libelles).not.toContain('Parking Ouest');
  });
});

describe('S-39 — plan orienté : le même traitement', () => {
  const svg = svgOf(renderOrientedPlan(refMultilevel, RDC, orientedOpts));

  it('dessine les places avec leur jeton et leur trait léger', () => {
    const places = polygonsWith(svg, 'tok-park-fill');
    expect(places).toHaveLength(4);
    for (const tag of places) expect(tag).toContain('stroke-width="0.5"');
  });

  it('ne les confond pas avec le bâti', () => {
    expect(polygonsWith(svg, 'tok-fp-fill').length).toBeGreaterThan(0);
  });
});

describe('S-39 — la marque d’une place accessible', () => {
  const avec = { accessible_space_pictogram: pictoSecurite };

  it('pose le pictogramme fourni sur la seule place accessible', () => {
    const svg = svgOf(renderFloorPlan(refMultilevel, RDC, floorOpts, avec));
    const tracés = [...svg.matchAll(new RegExp(`<path d="${TRACE}"`, 'g'))];
    expect(tracés).toHaveLength(1);
  });

  it('le pose aussi au plan orienté', () => {
    const svg = svgOf(renderOrientedPlan(refMultilevel, RDC, orientedOpts, avec));
    expect(svg).toContain(`<path d="${TRACE}"`);
  });

  it('ne dessine rien quand aucun pictogramme n’est fourni', () => {
    // « Jamais un symbole maison » : s'abstenir est le seul repli que la règle
    // laisse. Un moteur qui dessinerait ici une silhouette de son cru
    // violerait l'invariant 3 aussi sûrement qu'en redessinant le vrai.
    const svg = svgOf(renderFloorPlan(refMultilevel, RDC, floorOpts));
    expect(svg).not.toContain('<path d=');
  });

  it('refuse un pictogramme qui n’est pas du registre de sécurité', () => {
    // Un pictogramme d'orientation, fût-il bien dessiné, n'est pas celui que
    // la règle demande. INV-3 cloisonne, S-39 y renvoie.
    const maison: Pictogram = { ...pictoSecurite, registry: 'wayfinding' };
    const svg = svgOf(renderFloorPlan(
      refMultilevel, RDC, floorOpts, { accessible_space_pictogram: maison },
    ));
    expect(svg).not.toContain(`<path d="${TRACE}"`);
  });

  it('ne marque pas une place dont l’extension ne dit pas qu’elle est accessible', () => {
    const sansExtension: SiteData = { ...refMultilevel, parking_spaces: [] };
    const svg = svgOf(renderFloorPlan(sansExtension, RDC, floorOpts, avec));
    expect(svg).not.toContain(`<path d="${TRACE}"`);
  });
});

describe('S-39 — vue isométrique : la place reste au sol, sans volume', () => {
  const isoTheme: IsoTheme = {
    background: 'tok-bg',
    floor_top: 'tok-top', floor_stroke: 'tok-stroke',
    wall_front: 'tok-wall-front', wall_side: 'tok-wall-side',
    wall_stroke: 'tok-wall-stroke',
    node_fill: 'tok-node', node_stroke: 'tok-node-stroke',
    text_primary: 'tok-txt',
  };
  const isoOpts: IsoOptions = {
    width_px: 800, height_px: 600, theme: isoTheme, font_family: 'Helvetica',
    padding_px: 20, show_nodes: false, mode: { kind: 'all' },
  };

  /** Un volume posé sur la place accessible, que la vue doit ignorer. */
  const volumeSurPlace: Volume = {
    id: 'vol-sur-place',
    org_id: 'org-test-001',
    footprint_id: ACCESSIBLE,
    base_elevation_m: 0,
    height_m: 3,
    material_key: 'concrete',
  };

  function murs(site: SiteData): number {
    const r = renderIsoView(site, [RDC], isoOpts);
    expect(r.ok).toBe(true);
    if (!r.ok) return -1;
    // Un volume élevé dessine ses faces latérales en plus de sa face
    // supérieure. Les compter suffit à dire si la place a été dressée.
    return polygonsWith(r.value.svg, 'tok-wall-front').length
      + polygonsWith(r.value.svg, 'tok-wall-side').length;
  }

  it('n’élève pas une place à laquelle un volume serait rattaché', () => {
    const avecVolume: SiteData = {
      ...refMultilevel,
      volumes: [...refMultilevel.volumes, volumeSurPlace],
    };
    expect(murs(avecVolume)).toBe(murs(refMultilevel));
  });

  it('la dessine tout de même, à plat', () => {
    const r = renderIsoView(refMultilevel, [RDC], isoOpts);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Quatre places et l'empreinte du bâti : cinq faces supérieures au moins.
    expect(polygonsWith(r.value.svg, 'tok-top').length).toBeGreaterThanOrEqual(5);
  });
});

describe('S-39 — plan d’évacuation : absente, sauf cheminement', () => {
  const evacTheme: EvacuationTheme = {
    background: 'tok-bg',
    footprint_fill: 'tok-fp-fill', footprint_stroke: 'tok-fp-stroke',
    route_stroke: 'tok-route', route_arrow: 'tok-arrow',
    non_route_stroke: 'tok-non-route',
    exit_fill: 'tok-exit', exit_stroke: 'tok-exit-stroke',
    assembly_fill: 'tok-assembly', assembly_stroke: 'tok-assembly-stroke',
    node_fill: 'tok-node', node_stroke: 'tok-node-stroke',
    marker_fill: 'tok-marker', marker_stroke: 'tok-marker-stroke',
    text_primary: 'tok-txt', text_secondary: 'tok-txt2',
  };
  const evacOpts: EvacuationPlanOptions = {
    width_px: 800, height_px: 600, theme: evacTheme, font_family: 'Helvetica',
    padding_px: 20, viewer_position: null, show_non_evacuation: false,
  };

  /** Le plan d'évacuation rend un couple, le tracé et ses compteurs. */
  function evacSvg(site: SiteData): string {
    const r = renderEvacuationPlan(site, RDC, evacOpts);
    expect(r.ok, 'rendu refusé').toBe(true);
    return r.ok ? r.value.svg : '';
  }

  it('n’y fait apparaître aucune place', () => {
    const svg = evacSvg(refMultilevel);
    // Le bâti seul. Un parking dessiné place par place encombrerait le plan de
    // rectangles qui ne disent rien de la sortie.
    expect(polygonsWith(svg, 'tok-fp-fill')).toHaveLength(1);
  });

  it('fait apparaître celle qui porte un cheminement d’évacuation', () => {
    // Un nœud d'une arête d'évacuation posé dans le tracé de la place. C'est
    // le seul rattachement que le modèle permet.
    const place = refMultilevel.footprints.find(f => f.id === ACCESSIBLE);
    const sommet = place?.geometry.vertices[0];
    expect(sommet).toBeDefined();
    if (sommet === undefined) return;

    const site: SiteData = {
      ...refMultilevel,
      graph: {
        ...refMultilevel.graph,
        nodes: [
          ...refMultilevel.graph.nodes,
          {
            id: 'n-evac-a', org_id: 'org-test-001', level_id: RDC,
            kind: 'junction' as const,
            position: { x_m: sommet.x_m + 1, y_m: sommet.y_m + 1 },
            label: 'Essai',
          },
          {
            id: 'n-evac-b', org_id: 'org-test-001', level_id: RDC,
            kind: 'emergency_exit' as const,
            position: { x_m: sommet.x_m + 1, y_m: sommet.y_m + 20 },
            label: 'Essai',
          },
        ],
        edges: [
          ...refMultilevel.graph.edges,
          {
            id: 'e-evac', org_id: 'org-test-001',
            from_node_id: 'n-evac-a', to_node_id: 'n-evac-b',
            width_m: 2, slope_pct: 0, accessible: true,
            direction: 'both' as const,
            evacuation_route: true, length_m: 19,
          },
        ],
      },
    };
    expect(polygonsWith(evacSvg(site), 'tok-fp-fill')).toHaveLength(2);
  });
});
