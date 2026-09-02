/**
 * D2.2 — Error code catalog.
 *
 * Every finding code produced by any engine is listed here.
 * Adding a code requires an entry in this catalog in the same commit.
 * A code is stable for life: never renamed, never reused.
 */

export const ERROR_CATALOG = {
  // ── GRAPH ─────────────────────────────────────────────────
  'GRAPH.NODE_ORPHAN':                      { severity: 'blocking', description: 'Nœud relié à aucune arête' },
  'GRAPH.ZONE_UNREACHABLE':                 { severity: 'blocking', description: 'Zone non atteignable depuis une entrée' },
  'GRAPH.DESTINATION_UNLINKED':             { severity: 'blocking', description: 'Destination sans nœud d’accès' },
  'GRAPH.DESTINATION_UNREACHABLE':          { severity: 'blocking', description: 'Destination non atteignable depuis une entrée' },
  'GRAPH.LEVEL_NO_VERTICAL_LINK':           { severity: 'blocking', description: 'Niveau sans liaison verticale' },
  'GRAPH.LEVEL_NO_ACCESSIBLE_LINK':         { severity: 'blocking', description: 'Niveau sans liaison verticale accessible' },
  'GRAPH.EDGE_ZERO_LENGTH':                 { severity: 'blocking', description: 'Arête de longueur inférieure à la tolérance' },
  'GRAPH.EDGE_SELF_LOOP':                   { severity: 'blocking', description: 'Arête reliant un nœud à lui-même' },
  'GRAPH.DISCONNECTED':                     { severity: 'blocking', description: 'Graphe non connexe' },
  'GRAPH.DEAD_END_UNJUSTIFIED':             { severity: 'warning',  description: 'Impasse sans destination ni justification' },
  'GRAPH.VERTICAL_LINK_MISSING':            { severity: 'blocking', description: 'Arête entre niveaux sans liaison verticale' },
  'GRAPH.NO_ENTRANCE':                      { severity: 'blocking', description: 'Aucune entrée dans le graphe' },
  'GRAPH.NOT_VALIDATED':                    { severity: 'blocking', description: 'Audit demandé avant validation de complétude' },
  'GRAPH.PROFILE_NOT_ACCESSIBLE':           { severity: 'blocking', description: 'Profil non accessible pour audit d’accessibilité' },
  'GRAPH.DESTINATION_NAME_MISSING':         { severity: 'warning',  description: 'Destination sans dénomination dans une langue active' },
  'GRAPH.DESTINATION_NAME_DUPLICATE':       { severity: 'warning',  description: 'Dénominations identiques pour des destinations différentes' },
  'GRAPH.DESTINATION_LANG_INCOMPLETE':      { severity: 'warning',  description: 'Destination incomplète en couverture linguistique' },
  'GRAPH.CATEGORY_ALL_VACANT':              { severity: 'warning',  description: 'Catégorie dont toutes les destinations sont vacantes' },
  'GRAPH.DESTINATION_NODE_WRONG_KIND':      { severity: 'warning',  description: 'Destination rattachée à un nœud de type incorrect' },
  'GRAPH.DESTINATION_FOOTPRINT_NOT_FOUND':  { severity: 'blocking', description: 'Empreinte référencée par une destination introuvable' },
  'GRAPH.DESTINATION_DUPLICATE_ON_NODE':    { severity: 'warning',  description: 'Plusieurs destinations rattachées au même nœud' },
  'GRAPH.DIRECTORY_NAME_MISSING':           { severity: 'warning',  description: 'Entrée de dénomination absente dans l’annuaire' },
  'GRAPH.DIRECTORY_NAME_EMPTY':             { severity: 'blocking', description: 'Dénomination vide dans l’annuaire' },
  'GRAPH.DIRECTORY_NAME_ORPHAN':            { severity: 'warning',  description: 'Dénomination sans destination associée' },
  'GRAPH.RESOLVE_NODE_NOT_FOUND':           { severity: 'blocking', description: 'Nœud introuvable lors de la résolution de contenu' },
  'GRAPH.ROUTE_NODE_NOT_FOUND':             { severity: 'blocking', description: 'Nœud introuvable lors du calcul d’itinéraire' },
  'GRAPH.ROUTE_UNREACHABLE':                { severity: 'blocking', description: 'Destination non joignable depuis le nœud de départ' },
  'GRAPH.QUANTITY_NODE_NOT_FOUND':          { severity: 'warning',  description: 'Support positionné sur un nœud introuvable' },
  'GRAPH.QUANTITY_CROSS_CHECK_FAILED':      { severity: 'blocking', description: 'Recoupement des quantités incohérent' },

  // ── GEOM ──────────────────────────────────────────────────
  'GEOM.POLYGON_SELF_INTERSECTING':         { severity: 'blocking', description: 'Polygone auto-intersectant' },
  'GEOM.POLYGON_NOT_CLOSED':               { severity: 'blocking', description: 'Polygone non fermé' },
  'GEOM.POLYGON_TOO_FEW_VERTICES':         { severity: 'blocking', description: 'Moins de 3 sommets' },
  'GEOM.POLYGON_DEGENERATE':               { severity: 'blocking', description: 'Surface sous tolérance' },
  'GEOM.VOLUME_NO_HEIGHT':                  { severity: 'blocking', description: 'Volume sans hauteur' },
  'GEOM.FOOTPRINTS_OVERLAP':               { severity: 'warning',  description: 'Empreintes superposées sur un même niveau' },

  // ── LAYOUT ────────────────────────────────────────────────
  'LAYOUT.CHAR_HEIGHT_BELOW_MIN':           { severity: 'blocking', description: 'Hauteur de caractère sous le minimum normatif' },
  'LAYOUT.CONTRAST_BELOW_MIN':             { severity: 'blocking', description: 'Contraste de luminance insuffisant' },
  'LAYOUT.CONTENT_OVERFLOW':               { severity: 'blocking', description: 'Contenu ne tenant pas dans le format' },
  'LAYOUT.DIMENSIONS_OVERRIDDEN_NONCONFORM': { severity: 'blocking', description: 'Format saisi manuellement et non conforme' },
  'LAYOUT.DESTINATION_NOT_FOUND':           { severity: 'blocking', description: 'Destination affichée inexistante' },
  'LAYOUT.DESTINATION_UNREACHABLE':         { severity: 'blocking', description: 'Destination affichée non atteignable' },
  'LAYOUT.LANG_VARIANT_MISSING':            { severity: 'warning',  description: 'Dénomination absente dans une langue active' },
  'LAYOUT.LANG_VARIANT_LONGER':             { severity: 'info',     description: 'La variante non primaire est plus longue' },
  'LAYOUT.LEXICON_FORBIDDEN_TERM':          { severity: 'blocking', description: 'Terme interdit par la charte' },
  'LAYOUT.LEXICON_DISCOURAGED_TERM':        { severity: 'warning',  description: 'Terme déconseillé par la charte' },
  'LAYOUT.CHROMATIC_ADJACENCY':             { severity: 'blocking', description: 'Adjacence chromatique interdite' },
  'LAYOUT.LOGO_BELOW_MIN_WIDTH':            { severity: 'blocking', description: 'Logo sous la largeur minimale' },
  'LAYOUT.ISO_LEVEL_NOT_FOUND':             { severity: 'blocking', description: 'Niveau introuvable pour vue isométrique' },
  'LAYOUT.ISO_EMPTY_LEVELS':                { severity: 'warning',  description: 'Niveaux vides pour vue isométrique' },
  'LAYOUT.EVAC_LEVEL_NOT_FOUND':            { severity: 'blocking', description: 'Niveau introuvable pour plan d’évacuation' },
  'LAYOUT.EVAC_EMPTY_LEVEL':                { severity: 'warning',  description: 'Niveau vide pour plan d’évacuation' },
  'LAYOUT.EVAC_NO_ROUTES':                  { severity: 'warning',  description: 'Aucun parcours d’évacuation sur le niveau' },
  'LAYOUT.EVAC_NO_EXITS':                   { severity: 'warning',  description: 'Aucune sortie de secours sur le niveau' },
  'LAYOUT.FLOOR_PLAN_LEVEL_NOT_FOUND':      { severity: 'blocking', description: 'Niveau introuvable pour plan de sol' },
  'LAYOUT.FLOOR_PLAN_EMPTY_LEVEL':          { severity: 'warning',  description: 'Niveau vide pour plan de sol' },
  'LAYOUT.ORIENTED_PLAN_LEVEL_NOT_FOUND':   { severity: 'blocking', description: 'Niveau introuvable pour plan orienté' },
  'LAYOUT.ORIENTED_PLAN_EMPTY_LEVEL':       { severity: 'warning',  description: 'Niveau vide pour plan orienté' },

  // ── RULES ─────────────────────────────────────────────────
  'RULES.PACK_NOT_BOUND':                   { severity: 'blocking', description: 'Aucun paquet de règles rattaché au site' },
  'RULES.RULE_NOT_FOUND':                   { severity: 'blocking', description: 'Règle attendue absente du paquet' },
  'RULES.SOURCE_REF_MISSING':              { severity: 'blocking', description: 'Règle sans référence documentaire' },
  'RULES.PACK_CHECKSUM_MISMATCH':          { severity: 'blocking', description: 'Paquet altéré' },
  'RULES.INVALID_JSON':                     { severity: 'blocking', description: 'JSON du paquet de règles invalide' },
  'RULES.VALIDATION_ERROR':                { severity: 'blocking', description: 'Paquet de règles non conforme au schéma' },
  'RULES.SCOPE_AMBIGUOUS':                 { severity: 'blocking', description: 'Règles de même code et même spécificité de portée' },

  // ── SECURITY ──────────────────────────────────────────────
  'SECURITY.REGISTRY_WRITE_DENIED':         { severity: 'blocking', description: 'Tentative de modification du registre de sécurité' },
  'SECURITY.CHARTER_OVERRIDE_DENIED':       { severity: 'blocking', description: 'Tentative d’application d’une charte au registre de sécurité' },

  // ── IMPORT ────────────────────────────────────────────────
  'IMPORT.COLUMN_MISSING':                  { severity: 'blocking', description: 'Colonne obligatoire absente' },
  'IMPORT.ROW_INVALID':                     { severity: 'warning',  description: 'Ligne rejetée, import poursuivi' },
  'IMPORT.NODE_NOT_FOUND':                  { severity: 'warning',  description: 'Nœud référencé inexistant' },
  'IMPORT.DUPLICATE_KEY':                   { severity: 'warning',  description: 'Clé en double' },
  'IMPORT.UNIT_AMBIGUOUS':                  { severity: 'blocking', description: 'Unité du fichier source indéterminable' },
  'IMPORT.ENCODING_UNSUPPORTED':            { severity: 'blocking', description: 'Encodage non reconnu' },
  'IMPORT.EMPTY_FILE':                      { severity: 'blocking', description: 'Fichier d’import vide' },

  // ── PACKAGE ───────────────────────────────────────────────
  'PACKAGE.NETWORK_DEPENDENCY':             { severity: 'blocking', description: 'Le paquet de borne émet une requête sortante' },
  'PACKAGE.CHECKSUM_MISMATCH':             { severity: 'blocking', description: 'Intégrité du paquet non vérifiée' },
  'PACKAGE.NON_DETERMINISTIC':             { severity: 'blocking', description: 'Deux compilations divergent' },
  'PACKAGE.EMPTY_ARTIFACT':                { severity: 'blocking', description: 'Artefact vide dans le paquet' },
  'PACKAGE.DUPLICATE_ID':                  { severity: 'blocking', description: 'Identifiant en double dans le paquet' },
  'PACKAGE.DUPLICATE_PATH':                { severity: 'blocking', description: 'Chemin en double dans le paquet' },

  // ── DATA ──────────────────────────────────────────────────
  'DATA.CATEGORY_PARENT_NOT_FOUND':         { severity: 'blocking', description: 'Catégorie parente introuvable' },
  'DATA.CATEGORY_CYCLE':                    { severity: 'blocking', description: 'Cycle détecté dans la hiérarchie des catégories' },
  'DATA.PICTOGRAM_CATEGORY_NOT_FOUND':      { severity: 'blocking', description: 'Catégorie du pictogramme introuvable' },
  'DATA.DEST_CATEGORY_NOT_FOUND':           { severity: 'warning',  description: 'Catégorie de la destination introuvable' },
  'DATA.EMPTY_SVG_PATH':                    { severity: 'blocking', description: 'Chemin SVG du pictogramme vide' },
  'DATA.PROOF_STATUS_WITHOUT_APPROVAL':     { severity: 'blocking', description: 'Épreuve approuvée/rejetée sans approbation' },
  'DATA.PROOF_PENDING_WITH_APPROVAL':       { severity: 'warning',  description: 'Épreuve en attente avec des approbations' },
  'DATA.PROOF_DUPLICATE_VERSION':           { severity: 'blocking', description: 'Numéros de version d’épreuve en double' },
  'DATA.SUPPORT_DUPLICATE_TYPE_KEY':        { severity: 'blocking', description: 'Clé de type de support en double' },
  'DATA.SUPPORT_FACE_COUNT_MISMATCH':       { severity: 'blocking', description: 'Nombre de faces déclaré incohérent' },
  'DATA.SUPPORT_TEMPLATE_TYPE_NOT_FOUND':   { severity: 'blocking', description: 'Type de support du gabarit introuvable' },
  'DATA.SUPPORT_TEMPLATE_SIDE_NOT_FOUND':   { severity: 'warning',  description: 'Face du gabarit absente du type de support' },
  'DATA.SUPPORT_BLOCK_REGION_INVALID':      { severity: 'blocking', description: 'Région de bloc hors limites' },
} as const satisfies Record<string, { severity: 'blocking' | 'warning' | 'info'; description: string }>;

export type ErrorCode = keyof typeof ERROR_CATALOG;
