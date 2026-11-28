import type { SiteData } from '@azimut/core-model';
import { empreinte } from '@azimut/core-model';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  organization, site, rulesPack, siteRulesBinding, building, level, planSource, planCalibration,
  footprint, volume, zone, parkingSpace, node, edge, verticalLink, buildingLink, category, pictogram,
  destination, destinationName, travelProfile, supportTypology, supportTypologyFace, support,
} from './schema/index.js';

/**
 * T-0.10 — « chaque site de référence se charge en base et en mémoire, avec
 * empreinte stable ».
 *
 * Écrit un site de référence en base, table par table, dans l'ordre de
 * dépendance. C'est l'inverse exact de `assembleSiteData` : chaque champ du
 * modèle va à la colonne que l'assemblage relit, rien n'est complété.
 *
 * Les identifiants des sites de référence sont des noms (« bldg-001 ») ; la
 * base veut des uuid. `referenceUuid` en tire un, déterministe, de la clé du
 * site et de l'identifiant : deux chargements donnent les mêmes lignes, et
 * deux sites ne partagent aucune ligne, organisation comprise.
 *
 * Les paquets de règles rattachés sont des tables globales que le site ne
 * porte pas : une ligne de paquet minimale est posée pour chacun, sous une clé
 * propre au site.
 *
 * C'est un décor d'essai : il s'écrit sous le rôle de décor du banc
 * (`fixture-role.ts`), dans une transaction que l'appelant annule.
 */
type Writer = Pick<PostgresJsDatabase, 'insert'>;

/** Un uuid de version 8, tiré de l'empreinte de la clé du site et de l'identifiant. */
export function referenceUuid(siteKey: string, id: string): string {
  const hex = empreinte({ reference_site: siteKey, id }).slice('sha256:'.length, 'sha256:'.length + 32).split('');
  hex[12] = '8';
  hex[16] = ((parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Une valeur `numeric`, telle que le pilote l'attend. */
const n = (value: number): string => String(value);
const nOrNull = (value: number | null | undefined): string | null => (value === undefined || value === null ? null : n(value));

export async function writeReferenceSite(db: Writer, siteKey: string, data: SiteData): Promise<void> {
  // Ce que le décor ne sait pas encore écrire est refusé, et non omis : un
  // chargement qui écarterait des lignes en silence passerait pour fidèle.
  if (data.support_faces.length + data.content_blocks.length + data.support_versions.length > 0) {
    throw new Error(`T-0.10 ${siteKey} : faces, blocs ou versions de support non pris en charge par le décor`);
  }
  const id = (raw: string): string => referenceUuid(siteKey, raw);
  const idOrNull = (raw: string | null | undefined): string | null => (raw === undefined || raw === null ? null : id(raw));
  const org = id(data.organization.id);

  await db.insert(organization).values({ id: org, name: data.organization.name, slug: data.organization.slug });
  const s = data.site;
  await db.insert(site).values({
    id: id(s.id), org_id: org, name: s.name, country_code: s.country_code, timezone: s.timezone,
    legal_entity_id: idOrNull(s.legal_entity_id),
    origin_x_m: nOrNull(s.origin_x_m), origin_y_m: nOrNull(s.origin_y_m),
    active_langs: [...s.active_langs], reference_elevation_m: nOrNull(s.reference_elevation_m),
  });

  for (const packId of [...new Set(data.rules_bindings.map(b => b.rules_pack_id))]) {
    await db.insert(rulesPack).values({
      id: id(packId), key: `${siteKey}:${packId}`, version: '0.0.0', jurisdiction: 'XX',
      effective_from: '2026-01-01', source_ref: 'T-0.10, paquet de décor', checksum: 'decor',
    });
  }
  if (data.rules_bindings.length > 0) {
    await db.insert(siteRulesBinding).values(data.rules_bindings.map(b => ({
      id: id(b.id), org_id: org, site_id: id(s.id), rules_pack_id: id(b.rules_pack_id), role: b.role,
    })));
  }

  if (data.buildings.length > 0) {
    await db.insert(building).values(data.buildings.map(b => ({
      id: id(b.id), org_id: org, site_id: id(b.site_id), name: b.name, independent_access: b.independent_access,
      opening_hours: b.opening_hours ?? null, default_edge_width_m: nOrNull(b.default_edge_width_m),
    })));
  }
  if (data.levels.length > 0) {
    await db.insert(level).values(data.levels.map(l => ({
      id: id(l.id), org_id: org, building_id: id(l.building_id), name: l.name, ordinal: l.ordinal, elevation_m: n(l.elevation_m),
    })));
  }
  if (data.plan_sources.length > 0) {
    await db.insert(planSource).values(data.plan_sources.map(p => ({
      id: id(p.id), org_id: org, level_id: id(p.level_id), storage_path: p.storage_path, media_type: p.media_type,
      content_kind: p.content_kind, uploaded_at: new Date(p.uploaded_at),
    })));
  }
  if (data.plan_calibrations.length > 0) {
    await db.insert(planCalibration).values(data.plan_calibrations.map(c => ({
      id: id(c.id), org_id: org, plan_source_id: id(c.plan_source_id), scale_m_per_px: n(c.scale_m_per_px),
      origin_x_px: nOrNull(c.origin_x_px), origin_y_px: nOrNull(c.origin_y_px),
      reference_distance_m: nOrNull(c.reference_distance_m), rotation_deg: n(c.rotation_deg),
      calibrated_at: c.calibrated_at === undefined ? null : new Date(c.calibrated_at),
    })));
  }
  if (data.footprints.length > 0) {
    await db.insert(footprint).values(data.footprints.map(f => ({
      id: id(f.id), org_id: org, level_id: id(f.level_id), geometry: f.geometry, kind: f.kind, unit_code: f.unit_code ?? null,
    })));
  }
  if (data.volumes.length > 0) {
    await db.insert(volume).values(data.volumes.map(v => ({
      id: id(v.id), org_id: org, footprint_id: id(v.footprint_id), base_elevation_m: n(v.base_elevation_m),
      height_m: n(v.height_m), material_key: v.material_key, render_order: v.render_order ?? null,
    })));
  }
  const zones = data.zones ?? [];
  if (zones.length > 0) {
    await db.insert(zone).values(zones.map(z => ({
      id: id(z.id), org_id: org, level_id: id(z.level_id), name: z.name, kind: z.kind, footprint_ids: z.footprint_ids.map(id),
    })));
  }
  if (data.parking_spaces.length > 0) {
    await db.insert(parkingSpace).values(data.parking_spaces.map(p => ({
      id: id(p.id), org_id: org, footprint_id: id(p.footprint_id), space_kind: p.space_kind, row_label: p.row_label,
    })));
  }

  const graph = data.graph;
  if (graph.nodes.length > 0) {
    await db.insert(node).values(graph.nodes.map(x => ({
      id: id(x.id), org_id: org, level_id: id(x.level_id), kind: x.kind, position: x.position, label: x.label,
    })));
  }
  if (graph.edges.length > 0) {
    await db.insert(edge).values(graph.edges.map(e => ({
      id: id(e.id), org_id: org, from_node_id: id(e.from_node_id), to_node_id: id(e.to_node_id),
      width_m: n(e.width_m), slope_pct: n(e.slope_pct), accessible: e.accessible, direction: e.direction,
      evacuation_route: e.evacuation_route, length_m: n(e.length_m),
    })));
  }
  if (graph.vertical_links.length > 0) {
    await db.insert(verticalLink).values(graph.vertical_links.map(v => ({
      id: id(v.id), org_id: org, edge_id: id(v.edge_id), kind: v.kind, capacity: v.capacity, accessible: v.accessible,
    })));
  }
  if (graph.building_links.length > 0) {
    await db.insert(buildingLink).values(graph.building_links.map(b => ({
      id: id(b.id), org_id: org, edge_id: id(b.edge_id), from_building_id: id(b.from_building_id),
      to_building_id: id(b.to_building_id), sheltered: b.sheltered,
    })));
  }

  // Une catégorie peut avoir pour parent une autre catégorie du site : les
  // racines d'abord, puis chaque génération.
  const pending = [...data.categories];
  const placed = new Set<string>();
  while (pending.length > 0) {
    const ready = pending.filter(c => c.parent_id === null || placed.has(c.parent_id));
    if (ready.length === 0) throw new Error(`T-0.10 ${siteKey} : catégories en cycle ou parent absent`);
    await db.insert(category).values(ready.map(c => ({
      id: id(c.id), org_id: org, sector_key: c.sector_key, code: c.code, parent_id: idOrNull(c.parent_id),
    })));
    for (const c of ready) { placed.add(c.id); pending.splice(pending.indexOf(c), 1); }
  }
  if (data.pictograms.length > 0) {
    await db.insert(pictogram).values(data.pictograms.map(p => ({
      id: id(p.id), org_id: org, category_id: id(p.category_id), source: p.source, standard_ref: p.standard_ref,
      svg_path: p.svg_path, registry: p.registry, function_key: p.function_key, rules_pack_id: idOrNull(p.rules_pack_id),
    })));
  }
  if (data.destinations.length > 0) {
    await db.insert(destination).values(data.destinations.map(d => ({
      id: id(d.id), org_id: org, footprint_id: id(d.footprint_id), node_id: id(d.node_id), category_id: id(d.category_id),
      occupant_name: d.occupant_name, occupancy_status: d.occupancy_status, display_priority: d.display_priority,
      valid_from: d.valid_from ?? null, valid_to: d.valid_to ?? null,
    })));
  }
  if (data.destination_names.length > 0) {
    await db.insert(destinationName).values(data.destination_names.map(x => ({
      id: id(x.id), org_id: org, destination_id: id(x.destination_id), lang: x.lang, value: x.value,
    })));
  }
  if (data.travel_profiles.length > 0) {
    await db.insert(travelProfile).values(data.travel_profiles.map(p => ({
      id: id(p.id), org_id: org, site_id: id(p.site_id), key: p.key, name: p.name,
      excluded_edge_kinds: [...p.excluded_edge_kinds], require_accessible: p.require_accessible, honor_hours: p.honor_hours,
    })));
  }

  if (data.support_types.length > 0) {
    await db.insert(supportTypology).values(data.support_types.map(t => ({
      id: id(t.id), org_id: org, key: t.key, name: t.name, face_count: t.face_count, template_key: t.template_key ?? null,
    })));
  }
  const faces = data.support_types.flatMap(t => t.faces.map(f => ({ typology: t.id, ...f })));
  if (faces.length > 0) {
    await db.insert(supportTypologyFace).values(faces.map(f => ({
      id: id(`${f.typology}#face:${f.side}`), org_id: org, typology_id: id(f.typology), side: f.side,
      default_width_mm: f.default_width_mm, default_height_mm: f.default_height_mm,
    })));
  }
  if (data.supports.length > 0) {
    await db.insert(support).values(data.supports.map(x => ({
      id: id(x.id), org_id: org, site_id: id(x.site_id), code: x.code ?? null, node_id: id(x.node_id),
      registry: x.registry, context: x.context, reading_distance_m: n(x.reading_distance_m), azimuth_deg: n(x.azimuth_deg),
      width_mm: x.width_mm ?? null, height_mm: x.height_mm ?? null, dimensions_source: x.dimensions_source ?? null,
      typology_id: idOrNull(x.typology_id),
    })));
  }
}
