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
  'GRAPH.DESTINATION_UNREACHABLE':          { severity: 'blocking', description: 'Destination inatteignable depuis une entrée' },
  'GRAPH.LEVEL_NO_VERTICAL_LINK':           { severity: 'blocking', description: 'Niveau sans liaison verticale' },
  'GRAPH.LEVEL_NO_ACCESSIBLE_LINK':         { severity: 'blocking', description: 'Niveau sans liaison verticale accessible' },
  'GRAPH.EDGE_ZERO_LENGTH':                 { severity: 'blocking', description: 'Arête de longueur inférieure à la tolérance' },
  'GRAPH.EDGE_SELF_LOOP':                   { severity: 'blocking', description: 'Arête reliant un nœud à lui-même' },
  'GRAPH.DISCONNECTED':                     { severity: 'blocking', description: 'Graphe non connexe' },
  'GRAPH.DEAD_END_UNJUSTIFIED':             { severity: 'warning',  description: 'Impasse sans destination ni justification' },
  'GRAPH.VERTICAL_LINK_MISSING':            { severity: 'blocking', description: 'Arête entre niveaux sans liaison verticale' },
  // M4 (partie M), outil « Liaison verticale » : « Relie deux nœuds de
  // niveaux différents. » Deux nœuds d'un même niveau font une arête
  // ordinaire, et la liaison qu'on lui adjoindrait n'est rattrapée par
  // aucun contrôle : le contrôle d'alignement écarte les liaisons dont les
  // deux nœuds partagent un niveau.
  'GRAPH.VERTICAL_LINK_SAME_LEVEL':         { severity: 'blocking', description: 'Liaison verticale entre deux nœuds d’un même niveau' },
  // La liaison ne tombe pas au même point d'un niveau à l'autre. Ascenseurs et
  // escaliers droits seulement : l'escalier mécanique et la rampe gagnent leur
  // hauteur en avançant, leurs têtes ne peuvent pas coïncider.
  'GRAPH.VERTICAL_LINK_MISALIGNED':         { severity: 'blocking', description: 'Liaison verticale non alignée entre deux niveaux, ascenseurs et escaliers droits seulement, tolérance de la section D1.5' },
  // Atteignable depuis une entrée ne vaut pas atteignable depuis toutes, et le
  // sens de circulation y entre. Seules comptent les entrées qu'au moins un
  // profil emprunte.
  'GRAPH.DESTINATION_ENTRANCE_COVERAGE':    { severity: 'warning',  description: 'Destination non atteinte depuis toutes les entrées empruntées par un profil' },
  'GRAPH.BUILDING_ISOLATED':                { severity: 'warning',  description: 'Bâtiment sans liaison ni accès indépendant' },
  // M01.S10 : « Toute arête dont les deux extrémités appartiennent à des
  // bâtiments différents porte une ligne `building_link`, qui déclare si le
  // passage est couvert. » Règle symétrique de celle des liaisons
  // verticales : la connectivité est portée par l’arête, l’attribut de
  // passage par la liaison. Limite que la règle déclare elle-même : aucun
  // calcul ne lit encore `sheltered`.
  'GRAPH.BUILDING_LINK_MISSING':            { severity: 'blocking', description: 'Arête entre deux bâtiments sans ligne `building_link`' },
  // T-1.5 : « Un bâtiment à accès indépendant sans liaison est signalé,
  // pas refusé. » Distinct de `BUILDING_ISOLATED`, qui vise le bâtiment
  // sans liaison *et* sans accès propre : celui-ci a une porte, il n'est
  // pas inatteignable, et le signaler bloquant refuserait un site
  // parfaitement réel.
  'GRAPH.BUILDING_ACCESS_INDEPENDENT_ONLY': { severity: 'warning',  description: 'Bâtiment relié au reste du site par son seul accès indépendant. Ne se lève que sur un site à plusieurs bâtiments' },
  'GRAPH.NO_ENTRANCE':                      { severity: 'blocking', description: 'Site sans aucune entrée' },
  'GRAPH.NOT_VALIDATED':                    { severity: 'blocking', description: 'Audit demandé avant validation de complétude' },
  'GRAPH.PROFILE_NOT_ACCESSIBLE':           { severity: 'blocking', description: 'Audit d’accessibilité lancé sur un profil non accessible' },
  'GRAPH.DESTINATION_NAME_MISSING':         { severity: 'warning',  description: 'Destination sans dénomination' },
  'GRAPH.DESTINATION_NAME_DUPLICATE':       { severity: 'warning',  description: 'Deux destinations de même dénomination' },
  'GRAPH.DESTINATION_LANG_INCOMPLETE':      { severity: 'warning',  description: 'Destination non dénommée dans toutes les langues actives' },
  'GRAPH.CATEGORY_ALL_VACANT':              { severity: 'warning',  description: 'Catégorie dont toutes les destinations sont vacantes' },
  'GRAPH.DESTINATION_NODE_WRONG_KIND':      { severity: 'warning',  description: 'Nœud d’accès d’un type inattendu, règle M01.S4' },
  'GRAPH.DESTINATION_FOOTPRINT_NOT_FOUND':  { severity: 'blocking', description: 'Empreinte d’une destination inexistante' },
  'GRAPH.DESTINATION_DUPLICATE_ON_NODE':    { severity: 'warning',  description: 'Plusieurs destinations sur un même nœud d’accès' },
  'GRAPH.DIRECTORY_NAME_MISSING':           { severity: 'warning',  description: 'Dénomination absente dans une langue active' },
  'GRAPH.DIRECTORY_NAME_EMPTY':             { severity: 'blocking', description: 'Dénomination vide dans l’annuaire' },
  'GRAPH.DIRECTORY_NAME_ORPHAN':            { severity: 'warning',  description: 'Dénomination rattachée à une destination inexistante' },
  'GRAPH.RESOLVE_NODE_NOT_FOUND':           { severity: 'blocking', description: 'Nœud inexistant passé à la résolution de contenu' },
  'GRAPH.ROUTE_NODE_NOT_FOUND':             { severity: 'blocking', description: 'Nœud inexistant passé au calcul de parcours' },
  'GRAPH.ROUTE_UNREACHABLE':                { severity: 'blocking', description: 'Aucun chemin entre les deux nœuds demandés' },
  'GRAPH.QUANTITY_NODE_NOT_FOUND':          { severity: 'warning',  description: 'Support rattaché à un nœud inexistant' },
  'GRAPH.QUANTITY_CROSS_CHECK_FAILED':      { severity: 'blocking', description: 'Quantitatif ne recoupant pas la nomenclature, écart non nul' },
  // Partie N, module 02 (N2.4) : audit de couverture.
  'GRAPH.DECISION_POINT_UNCOVERED':         { severity: 'blocking', description: 'Point de décision non couvert par un support' },
  'GRAPH.SUPPORT_UNUSED':                   { severity: 'warning',  description: 'Support ne servant aucun parcours' },

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
  'LAYOUT.STROKE_RATIO_OUT_OF_BOUNDS':     { severity: 'blocking', description: 'Rapport épaisseur de trait sur hauteur hors des bornes du paquet de règles' },
  'LAYOUT.MOUNTING_OUT_OF_RANGE':          { severity: 'blocking', description: 'Hauteur d’implantation hors de la plage du paquet de règles' },
  'LAYOUT.CONTENT_OVERFLOW':               { severity: 'blocking', description: 'Contenu ne tenant pas dans le format' },
  'LAYOUT.DIMENSIONS_OVERRIDDEN_NONCONFORM': { severity: 'blocking', description: 'Format saisi manuellement et non conforme' },
  'LAYOUT.TEMPLATE_INVALID':                { severity: 'blocking', description: 'Gabarit non conforme à son schéma, section D8.1' },
  'LAYOUT.TEMPLATE_BINDING_UNSUPPORTED':    { severity: 'blocking', description: 'Liaison de bloc non prévue par le schéma de gabarit, section D8.2' },
  'LAYOUT.DESTINATION_NOT_FOUND':           { severity: 'blocking', description: 'Destination affichée inexistante' },
  'LAYOUT.DESTINATION_UNREACHABLE':         { severity: 'blocking', description: 'Destination affichée non atteignable' },
  'LAYOUT.LANG_VARIANT_MISSING':            { severity: 'warning',  description: 'Dénomination absente dans une langue active' },
  'LAYOUT.LANG_VARIANT_LONGER':             { severity: 'info',     description: 'La variante non primaire est plus longue' },
  'LAYOUT.LEXICON_FORBIDDEN_TERM':          { severity: 'blocking', description: 'Terme interdit par la charte' },
  // A5.8, `charter_rule` de nature `forbidden_character`.
  'LAYOUT.FORBIDDEN_CHARACTER':             { severity: 'blocking', description: 'Caractère interdit par la charte dans un texte de livrable' },
  // A5.8, `charter_rule` de nature `max_sentence_words`.
  'LAYOUT.SENTENCE_TOO_LONG':               { severity: 'warning',  description: 'Phrase plus longue que la limite portée par la charte' },
  'LAYOUT.LEXICON_DISCOURAGED_TERM':        { severity: 'warning',  description: 'Terme déconseillé par la charte' },
  // A5.11, règle M01.S11 : un texte qui contredit un fait déclaré du site.
  'LAYOUT.FACT_CONTRADICTED':               { severity: 'blocking', description: 'Texte de livrable contredisant un fait déclaré du site, règle M01.S11' },
  // A5.11, règle M01.S11 : deux sources donnent des valeurs différentes.
  'LAYOUT.SOURCE_DISCREPANCY_OPEN':         { severity: 'warning',  description: 'Écart entre deux sources resté ouvert, règle M01.S11' },

  // ── PARK (A5.11, règle M01.S11) ───────────────────────────
  'PARK.CAPACITY_UNEXPLAINED':              { severity: 'blocking', description: 'Écart entre places numérisées et capacité déclarée, sans explication' },
  'PARK.CAPACITY_EXCEEDED':                 { severity: 'blocking', description: 'Places numérisées au-delà de la capacité déclarée' },
  'PARK.SOURCE_MISSING':                    { severity: 'blocking', description: 'Fait du site sans source déclarée, règle M01.S11' },
  'PARK.PROPOSAL_AS_EXISTING':              { severity: 'blocking', description: 'Objet de statut proposition affiché comme existant, règle M01.S11' },
  // S-37 : le motif est un fait valide au regard du type, même vide ; son
  // absence se signale sans bloquer.
  'PARK.UNDIGITIZED_REASON_MISSING':        { severity: 'warning',  description: 'Surface non numérisée dont le motif manque ou est vide. Déclarer des places sans dire pourquoi elles ne sont pas numérisées contredit la règle M01.S11' },

  // ── DOC (A5.11, règle M01.S11) ────────────────────────────
  'DOC.BINDING_UNKNOWN':                    { severity: 'blocking', description: 'Champ lié inconnu dans un texte de livrable' },
  'DOC.BINDING_UNRESOLVED':                 { severity: 'blocking', description: 'Champ lié non résolu au rendu' },
  'DOC.LITERAL_NUMBER':                     { severity: 'warning',  description: 'Nombre écrit en littéral dans un livrable, au lieu d’un champ lié' },
  'LAYOUT.CHROMATIC_ADJACENCY':             { severity: 'blocking', description: 'Adjacence chromatique interdite' },
  'LAYOUT.LOGO_BELOW_MIN_WIDTH':            { severity: 'blocking', description: 'Logo sous la largeur minimale' },
  'LAYOUT.ISO_LEVEL_NOT_FOUND':             { severity: 'blocking', description: 'Niveau inexistant passé à la vue isométrique' },
  'LAYOUT.ISO_EMPTY_LEVELS':                { severity: 'warning',  description: 'Vue isométrique sans aucun niveau' },
  'LAYOUT.EVAC_LEVEL_NOT_FOUND':            { severity: 'blocking', description: 'Niveau inexistant passé au plan d’évacuation' },
  'LAYOUT.EVAC_EMPTY_LEVEL':                { severity: 'warning',  description: 'Plan d’évacuation d’un niveau sans contenu' },
  'LAYOUT.EVAC_NO_ROUTES':                  { severity: 'warning',  description: 'Plan d’évacuation sans aucun cheminement' },
  'LAYOUT.EVAC_NO_EXITS':                   { severity: 'warning',  description: 'Plan d’évacuation sans aucune sortie' },
  'LAYOUT.FLOOR_PLAN_LEVEL_NOT_FOUND':      { severity: 'blocking', description: 'Niveau inexistant passé au plan de niveau' },
  'LAYOUT.FLOOR_PLAN_EMPTY_LEVEL':          { severity: 'warning',  description: 'Plan de niveau sans contenu' },
  'LAYOUT.ORIENTED_PLAN_LEVEL_NOT_FOUND':   { severity: 'blocking', description: 'Niveau inexistant passé au plan orienté' },
  'LAYOUT.ORIENTED_PLAN_EMPTY_LEVEL':       { severity: 'warning',  description: 'Plan orienté d’un niveau sans contenu' },

  // ── RULES ─────────────────────────────────────────────────
  'RULES.PACK_NOT_BOUND':                   { severity: 'blocking', description: 'Opération exigeant des règles sur un site sans paquet de règles rattaché' },
  'RULES.RULE_NOT_FOUND':                   { severity: 'blocking', description: 'Règle attendue absente du paquet' },
  'RULES.SOURCE_REF_MISSING':              { severity: 'blocking', description: 'Règle sans référence documentaire' },
  'RULES.PACK_CHECKSUM_MISMATCH':          { severity: 'blocking', description: 'Paquet altéré' },
  'RULES.INVALID_JSON':                     { severity: 'blocking', description: 'Fichier de règles illisible' },
  'RULES.VALIDATION_ERROR':                { severity: 'blocking', description: 'Paquet de règles non conforme à son schéma, sections D3.3 et D3.4' },
  'RULES.SCOPE_AMBIGUOUS':                 { severity: 'blocking', description: 'Deux règles de même code et de même spécificité' },
  'RULES.OVERLAY_LESS_RESTRICTIVE':        { severity: 'blocking', description: 'Règle pays moins contraignante que le socle, section D3.6' },
  'RULES.OVERLAY_NOT_COMPARABLE':          { severity: 'blocking', description: 'Règle pays non comparable au socle : le durcissement ne peut pas être établi' },
  'RULES.FILE_NOT_LISTED':                 { severity: 'blocking', description: 'Fichier de règles présent et non listé au manifeste' },
  'RULES.FILE_MISSING':                    { severity: 'blocking', description: 'Fichier de règles annoncé par le manifeste et introuvable' },
  'RULES.TEST_PACK_OUTSIDE_TEST_ENV':      { severity: 'blocking', description: 'Paquet de juridiction TEST chargé hors environnement de test' },

  // ── SECURITY ──────────────────────────────────────────────
  'SECURITY.REGISTRY_WRITE_DENIED':         { severity: 'blocking', description: 'Tentative de modification du registre de sécurité' },
  'SECURITY.CHARTER_OVERRIDE_DENIED':       { severity: 'blocking', description: 'Tentative d’application d’une charte au registre de sécurité' },

  // ── IMPORT ────────────────────────────────────────────────
  'IMPORT.COLUMN_MISSING':                  { severity: 'blocking', description: 'Colonne obligatoire absente' },
  'IMPORT.ROW_INVALID':                     { severity: 'warning',  description: 'Ligne rejetée, import poursuivi' },
  'IMPORT.NODE_NOT_FOUND':                  { severity: 'warning',  description: 'Nœud référencé inexistant' },
  'IMPORT.DUPLICATE_KEY':                   { severity: 'warning',  description: 'Clé en double' },
  'IMPORT.UNIT_AMBIGUOUS':                  { severity: 'blocking', description: 'Unité du fichier source indéterminable' },
  'IMPORT.FILE_TOO_LARGE':                  { severity: 'blocking', description: 'Fichier au-delà de la taille maximale' },
  'IMPORT.FORMAT_UNSUPPORTED':              { severity: 'blocking', description: 'Format de fichier non pris en charge' },
  'IMPORT.PAGE_REQUIRED':                   { severity: 'blocking', description: 'Page à choisir dans un document multipage' },
  'IMPORT.ENCODING_UNSUPPORTED':            { severity: 'blocking', description: 'Encodage non reconnu' },
  'IMPORT.EMPTY_FILE':                      { severity: 'blocking', description: 'Fichier d’import sans aucune ligne' },
  'IMPORT.RASTER_PRECISION_LIMITED':       { severity: 'warning',  description: 'Plan sans contenu vectoriel exploitable : image en mode point, ou PDF sans tracés. Le calage et la numérisation restent possibles, avec une précision moindre' },
  'IMPORT.VECTOR_AS_REFERENCE_ONLY':        { severity: 'info',     description: 'Fichier importé en référence de fond, sans exploitation' },

  // ── PACKAGE ───────────────────────────────────────────────
  'PACKAGE.NETWORK_DEPENDENCY':             { severity: 'blocking', description: 'Le paquet de borne émet une requête sortante' },
  'PACKAGE.CHECKSUM_MISMATCH':             { severity: 'blocking', description: 'Intégrité du paquet non vérifiée' },
  'PACKAGE.NON_DETERMINISTIC':             { severity: 'blocking', description: 'Deux compilations divergent' },
  'PACKAGE.EMPTY_ARTIFACT':                { severity: 'blocking', description: 'Artefact vide dans un paquet' },
  'PACKAGE.DUPLICATE_ID':                  { severity: 'blocking', description: 'Deux artefacts de même identifiant dans un paquet' },
  'PACKAGE.DUPLICATE_PATH':                { severity: 'blocking', description: 'Deux fichiers de même chemin dans un paquet' },
  'PACKAGE.FILE_MISSING':                  { severity: 'blocking', description: 'Fichier requis absent du paquet de borne, section D10.1' },
  'PACKAGE.ABSOLUTE_PATH':                 { severity: 'blocking', description: 'Chemin absolu dans un paquet, section D10.1' },
  'PACKAGE.INTEGRITY_MISMATCH':            { severity: 'blocking', description: 'Fichier non conforme au manifeste, section D10.4' },

  // ── DATA ──────────────────────────────────────────────────
  'DATA.CATEGORY_PARENT_NOT_FOUND':         { severity: 'blocking', description: 'Catégorie parente inexistante' },
  'DATA.CATEGORY_CYCLE':                    { severity: 'blocking', description: 'Cycle dans la hiérarchie des catégories' },
  'DATA.PICTOGRAM_CATEGORY_NOT_FOUND':      { severity: 'blocking', description: 'Catégorie d’un pictogramme inexistante' },
  'DATA.DEST_CATEGORY_NOT_FOUND':           { severity: 'warning',  description: 'Catégorie d’une destination inexistante' },
  'DATA.EMPTY_SVG_PATH':                    { severity: 'blocking', description: 'Pictogramme sans tracé' },
  'DATA.PROOF_STATUS_WITHOUT_APPROVAL':     { severity: 'blocking', description: 'Version approuvée sans ligne d’approbation' },
  'DATA.PROOF_PENDING_WITH_APPROVAL':       { severity: 'warning',  description: 'Version restée en revue alors qu’une approbation existe' },
  'DATA.PROOF_DUPLICATE_VERSION':           { severity: 'blocking', description: 'Deux épreuves pour un même numéro de version' },
  'DATA.SUPPORT_DUPLICATE_TYPE_KEY':        { severity: 'blocking', description: 'Clé de typologie de support en double' },
  'DATA.SUPPORT_FACE_COUNT_MISMATCH':       { severity: 'blocking', description: 'Nombre de faces différent de celui de la typologie' },
  'DATA.SUPPORT_TEMPLATE_TYPE_NOT_FOUND':   { severity: 'blocking', description: 'Gabarit d’une typologie inexistant' },
  'DATA.SUPPORT_TEMPLATE_SIDE_NOT_FOUND':   { severity: 'warning',  description: 'Face de gabarit sans face correspondante dans la typologie' },
  'DATA.SUPPORT_BLOCK_REGION_INVALID':      { severity: 'blocking', description: 'Bloc débordant de la grille du gabarit, section D8.2' },
  'DATA.KIOSK_CONFIG_INVALID':              { severity: 'blocking', description: 'Configuration locale de borne invalide, section D10.3' },
  'DATA.FACE_DIMENSIONS_INVALID':           { severity: 'blocking', description: 'Dimensions de face nulles ou négatives' },
  'DATA.SUPPORT_VERSION_TRANSITION_FORBIDDEN': { severity: 'blocking', description: 'Transition d’état non prévue par la section D9.1' },
  'DATA.SUPPORT_VERSION_REJECT_MOTIF_REQUIRED': { severity: 'blocking', description: 'Rejet d’une version sans motif, section D9.1' },
  // N4.3 — règle M04.G7 : une version approuvée est immuable, une correction crée
  // une nouvelle version.
  'DATA.APPROVED_VERSION_NOT_IMMUTABLE': { severity: 'blocking', description: 'Tentative de modification d’une version approuvée, règle M04.G7' },
  'DATA.FACE_CONTENT_UNSERIALIZABLE':       { severity: 'blocking', description: 'Contenu de face non sérialisable en forme canonique, section D7.2' },
  'DATA.HASH_INPUT_INVALID':               { severity: 'blocking', description: 'Valeur non hachable soumise à un calcul d’empreinte : nombre non fini, objet non simple. Le calcul refuse au lieu d’écrire une valeur nulle' },

  // Partie N, module 01 (N1.4) : code de cellule (règle M01.S3).
  'DATA.UNIT_CODE_REQUIRED':                { severity: 'blocking', description: 'Cellule sans code' },
  'DATA.NAME_REQUIRED':                     { severity: 'blocking', description: 'Nom requis' },
  'DATA.NAME_DUPLICATE':                    { severity: 'blocking', description: 'Nom déjà utilisé dans l’organisation' },
  'DATA.COUNTRY_REQUIRED':                  { severity: 'blocking', description: 'Pays requis' },
  'DATA.LANG_REQUIRED':                     { severity: 'blocking', description: 'Au moins une langue active requise' },
  'DATA.CODE_DUPLICATE':                    { severity: 'blocking', description: 'Code de cellule déjà utilisé sur le niveau' },
  // Le libellé est celui du catalogue. Le contrôle refuse en outre une
  // capacité fractionnaire, que « non positive » ne couvre pas : la colonne
  // est entière (migration 0004), et 2,5 personnes n’est pas une capacité.
  'DATA.CAPACITY_INVALID':                  { severity: 'blocking', description: 'Capacité d’une liaison verticale absente ou non positive' },
  // M1bis (partie M), champs d'un niveau : le rang est « unique par
  // bâtiment », et la suppression d'un niveau est « refusée s'il porte des
  // empreintes ou des nœuds ».
  'DATA.LEVEL_ORDINAL_DUPLICATE':           { severity: 'blocking', description: 'Deux niveaux de même rang dans un bâtiment' },
  'DATA.LEVEL_NOT_EMPTY':                   { severity: 'blocking', description: 'Suppression d’un niveau portant des empreintes ou des nœuds' },
  // S10, et calculable depuis la version 17 seulement : A5.2 ne donnait à
  // `zone` ni géométrie ni liste d’empreintes, donc l’appartenance d’une place
  // à un parking n’était pas exprimable. `footprint_ids` la porte désormais.
  'DATA.PARKING_SPACE_WITHOUT_ZONE':        { severity: 'warning', description: 'Place de stationnement hors de toute zone de nature `parking`' },
  // Levé depuis l’origine par le formulaire de création de M1 (partie M) et
  // absent du catalogue : l’écran affichait donc le code brut, faute d’entrée
  // de dictionnaire. Le sens qui manquait au garde de
  // `tests/error-code-reachability.test.ts` est ajouté avec lui.
  'DATA.TIMEZONE_REQUIRED':                 { severity: 'blocking', description: 'Site sans fuseau horaire' },
  // Même défaut, même commit : la lecture du vocabulaire d’un site la lève
  // pour l’état d’écran de F7, et l’écran n’avait rien à afficher.

  // ── WAYFIND (H12) ─────────────────────────────────────────
  'WAYFIND.NAMING_COLLISION':               { severity: 'blocking', description: 'Deux entités portent le même nom d’orientation' },
  'WAYFIND.CONTINUITY_BROKEN':              { severity: 'blocking', description: 'Destination annoncée puis abandonnée avant d’être atteinte' },
  'WAYFIND.NO_INFORMATION_LEVEL':           { severity: 'blocking', description: 'Support rattaché à aucun niveau d’information' },
  'WAYFIND.TOO_MANY_DESTINATIONS':          { severity: 'blocking', description: 'Nombre de destinations par face dépassé' },
  'WAYFIND.SCHEDULE_STALE':                 { severity: 'warning',  description: 'Tableau des messages périmé' },
  'WAYFIND.LINE_MISSING':                   { severity: 'blocking', description: 'Aucune ligne du tableau des messages pour ce bloc, section H2.5' },
  'WAYFIND.LINE_MALFORMED':                 { severity: 'blocking', description: 'Ligne du tableau des messages incomplète, section H2.5' },
  'WAYFIND.SUPPORT_TYPE_UNKNOWN':           { severity: 'blocking', description: 'Typologie de support inexistante' },
  'WAYFIND.FACE_TEMPLATE_MISSING':          { severity: 'blocking', description: 'Face de typologie sans gabarit' },
  // Partie N, module 02 (N2.4) : justification d'une ligne (règle M02.W4).
  'WAYFIND.LINE_UNJUSTIFIED':               { severity: 'blocking', description: 'Ligne du tableau des messages sans point de décision' },

  // ── CALIB (D4 / tranche M) ────────────────────────────────
  'CALIB.DISTANCE_INVALID':                 { severity: 'blocking', description: 'Distance réelle absente ou non positive' },
  'CALIB.POINT_REQUIRED':                   { severity: 'blocking', description: 'Point de calage manquant' },
  'CALIB.AZIMUTH_INVALID':                  { severity: 'blocking', description: 'Azimut du nord hors plage' },
  'CALIB.POINTS_TOO_CLOSE':                 { severity: 'blocking', description: 'Points de calage trop rapprochés' },
  'CALIB.SCALE_IMPLAUSIBLE':                { severity: 'warning',  description: 'Échelle hors de la plage vraisemblable' },
  // Partie N, module 01 (N1.4) : niveau sans plan calé.
  'CALIB.LEVEL_NOT_CALIBRATED':             { severity: 'blocking', description: 'Niveau sans plan calé' },
  // Section M2 (partie M) : calage à n points, avec son résidu mesuré.
  'CALIB.CONTROL_POINTS_INSUFFICIENT':      { severity: 'blocking', description: 'Points de calage en nombre insuffisant' },
  'CALIB.CONTROL_POINTS_COLLINEAR':         { severity: 'blocking', description: 'Points de calage colinéaires, l’ajustement est impossible' },
  'CALIB.RESIDUAL_NOT_MEASURED':            { severity: 'warning',  description: 'Résidu non mesurable, trop peu de points homologues' },
  'CALIB.RESIDUAL_MEAN_EXCEEDED':           { severity: 'blocking', description: 'Résidu moyen de calage au-dessus du seuil' },
  'CALIB.RESIDUAL_POINT_EXCEEDED':          { severity: 'blocking', description: 'Résidu d’un point de calage au-dessus du seuil' },
  // A5.8 — « une règle déclarée et cassée bloque, parce qu'elle a été voulue ».
  'CHARTER.RULE_MALFORMED':                 { severity: 'blocking', description: 'Règle de charte déclarée dont les paramètres sont illisibles ou ne correspondent pas à sa nature. À distinguer d’une règle absente, qui ne s’exécute pas et le signale, section A5.8 : une règle déclarée et cassée bloque, parce qu’elle a été voulue' },
  // N1.3 — règle M01.S1 : le repère site est fixé au premier calage.
  'CALIB.ORIGIN_LOCKED':                    { severity: 'blocking', description: 'Tentative de modification de l’origine du repère site, règle M01.S1' },
  'CALIB.ORIGIN_MISMATCH':                  { severity: 'blocking', description: 'Origine du repère incohérente entre deux niveaux d’un même site' },


  // ── EDIT (E17) ────────────────────────────────────────────
  'EDIT.CONTEXT_VIOLATION':                 { severity: 'blocking', description: 'Opération interdite dans ce contexte d’édition' },
  'EDIT.BOOLEAN_RESULT_INVALID':            { severity: 'blocking', description: 'Opération booléenne produisant une géométrie invalide' },
  'EDIT.CROSS_ORG_PASTE_DENIED':            { severity: 'blocking', description: 'Collage entre organisations refusé' },
  'EDIT.UNDO_AFTER_SYNC':                   { severity: 'warning',  description: 'Annulation demandée sur une modification déjà synchronisée' },
  'EDIT.TEMPLATE_BLOCK_OVERFLOW':           { severity: 'blocking', description: 'Bloc débordant de la grille du gabarit' },
  'EDIT.OBJECT_LOCKED':                     { severity: 'warning',  description: 'Objet verrouillé par un autre utilisateur' },
  'EDIT.LOCK_OVERRIDDEN':                   { severity: 'info',     description: 'Verrou forcé, journalisé' },
  'EDIT.TOUCH_TOOL_UNAVAILABLE':            { severity: 'info',     description: 'Outil de tracé indisponible au doigt' },
  'EDIT.TABLE_NOT_OWNED':                   { severity: 'blocking', description: 'Écriture directe dans une table dont l’atelier n’est pas propriétaire, règle M12.A2' },
  'EDIT.COMMAND_SHAPE_INVALID':             { severity: 'blocking', description: 'Commande d’édition mal formée, section E5.1' },
  'EDIT.TIMESTAMP_REQUIRED':                { severity: 'blocking', description: 'Commande sans horodatage fourni par l’appelant' },
  'EDIT.WRITE_REFUSED':                     { severity: 'blocking', description: 'Écriture refusée par le cloisonnement, section A6.1' },

  // ── ASSET (E17) ───────────────────────────────────────────
  'ASSET.SANITIZATION_FAILED':              { severity: 'blocking', description: 'Actif importé non assainissable' },
  'ASSET.RASTER_IN_LOGO':                   { severity: 'blocking', description: 'Image en mode point dans un logo' },
  'ASSET.FONT_MISSING_GLYPHS':              { severity: 'blocking', description: 'Police sans les caractères requis' },

  // ── TYPO (E17) ────────────────────────────────────────────
  'TYPO.TEXT_OVERFLOW':                      { severity: 'blocking', description: 'Débordement de texte calculé' },

  // ── RENDER (G8, budget de rendu adaptatif) ────────────────
  'RENDER.BUDGET_EXCEEDED':                  { severity: 'info',     description: 'Bascule en mode de rendu allégé' },

  // ── FONT (G8, registre des polices) ───────────────────────
  'FONT.NOT_EMBEDDABLE':                     { severity: 'blocking', description: 'Police non incorporable dans un livrable distribué' },
  'FONT.METRICS_MISSING':                    { severity: 'blocking', description: 'Table de métriques absente ou altérée' },
  'FONT.LICENCE_UNKNOWN':                    { severity: 'warning',  description: 'Licence non déclarée' },

  // ── COLOR (E17, G8) ───────────────────────────────────────
  'COLOR.PROFILE_MISSING':                   { severity: 'warning',  description: 'Profil de sortie absent pour ce substrat' },
  'COLOR.DELTA_NOT_COMPUTABLE':              { severity: 'info',     description: 'Écart non calculable, valeurs mesurées absentes' },
  'COLOR.REFERENCE_UNVERIFIABLE':            { severity: 'info',     description: 'Référence de nuancier sans valeurs fournies' },

  // ── ASSIST / MODULE / FLOW / AD / SURVEY (partie I, I6) ────
  'ASSIST.PROPOSAL_REJECTED':                { severity: 'info',     description: 'Proposition d’assistance refusée, non redemandée' },
  'ASSIST.EXTRACTION_BELOW_THRESHOLD':       { severity: 'warning',  description: 'Taux d’extraction insuffisant, calage manuel recommandé' },
  'MODULE.NOT_ENTITLED':                     { severity: 'blocking', description: 'Module non souscrit' },
  'FLOW.WEIGHTS_UNDECLARED':                 { severity: 'blocking', description: 'Calcul d’exposition sans pondérations déclarées' },
  'FLOW.HYPOTHESIS_MISSING':                 { severity: 'blocking', description: 'Export d’un résultat de flux sans ses hypothèses' },
  // Partie N, module 03 (N3.3) : normalisation et corrélation.
  'FLOW.WEIGHTS_NOT_NORMALIZED':             { severity: 'blocking', description: 'Somme des parts différente de 100 %' },
  // I5.3 : une pondération négative ou non finie n'est pas une pondération.
  'FLOW.WEIGHT_INVALID':                     { severity: 'blocking', description: 'Pondération de profil négative ou non numérique' },
  'FLOW.CORRELATION_TOO_LOW':                { severity: 'blocking', description: 'Corrélation insuffisante pour produire un montant' },
  'AD.RULES_PACK_MISSING':                   { severity: 'blocking', description: 'Aucun paquet de règles publicitaires rattaché' },
  'AD.PLACEMENT_DOUBLE_BOOKED':              { severity: 'blocking', description: 'Conflit de réservation' },
  'AD.CREATIVE_SPEC_MISMATCH':               { severity: 'blocking', description: 'Visuel non conforme à la fiche technique' },
  'AD.OPTION_EXPIRED':                       { severity: 'info',     description: 'Option arrivée à échéance' },
  'SURVEY.SYNC_PENDING':                     { severity: 'info',     description: 'Relevé de tournée non synchronisé' },

  // ── TENANT / INSTALL / COST (H12, modules 6/7/9) ──────────
  'TENANT.RULE_VIOLATION':                   { severity: 'blocking', description: 'Projet d’enseigne non conforme au règlement' },
  'INSTALL.RESERVATION_OPEN':                { severity: 'warning',  description: 'Réserve de pose non levée' },
  'COST.REFERENCE_MISSING':                  { severity: 'warning',  description: 'Aucun coût de référence pour cette typologie' },

  // ── INK / SKETCH / REVIEW / PICTO / LIBRARY (partie J) ─────
  'INK.SHAPE_NOT_RECOGNIZED':                { severity: 'info',     description: 'Aucune forme candidate, tracé conservé en esquisse' },
  'SKETCH.IN_DELIVERABLE':                   { severity: 'blocking', description: 'Couche d’esquisse présente dans un export destiné à un tiers' },
  'REVIEW.ANNOTATION_OPEN':                  { severity: 'blocking', description: 'Annotation de révision non traitée à la clôture' },
  'PICTO.SAFETY_EDIT_DENIED':                { severity: 'blocking', description: 'Modification d’un pictogramme du registre de sécurité' },
  'PICTO.UNTESTED':                          { severity: 'info',     description: 'Pictogramme d’orientation non soumis à essai de compréhension' },
  'PICTO.FUNCTION_NOT_DESIGNATED':           { severity: 'warning',  description: 'Aucun pictogramme ne porte la fonction demandée. Le rendu omet la marque et le signale, il n’en dessine jamais une autre' },
  'PICTO.FUNCTION_AMBIGUOUS':                { severity: 'blocking', description: 'Deux pictogrammes d’un même registre portent la même fonction sur un site' },
  'PICTO.RASTER_CONTENT':                    { severity: 'blocking', description: 'Image en mode point dans un pictogramme' },
  'PICTO.FAMILY_INCONSISTENT':               { severity: 'warning',  description: 'Épaisseur ou grille incohérente avec la famille' },
  'LIBRARY.DUPLICATE_ON_IMPORT':             { severity: 'warning',  description: 'Symbole déjà présent dans la bibliothèque' },
} as const satisfies Record<string, { severity: 'blocking' | 'warning' | 'info'; description: string }>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

/**
 * D2.1 — les domaines d'anomalie autorisés, « et eux seuls ».
 *
 * Cette liste est un sous-ensemble de celle de D2.1, restreint aux domaines que
 * le dépôt emploie réellement. La distinction tient à ce qu'un domaine déclaré
 * et vide n'apporte rien : `CHARTER` l'a été pendant plusieurs versions, sans
 * porter un seul code, et l'éditeur l'a retiré pour cette raison. Un domaine
 * s'ajoute ici avec son premier code, jamais en prévision.
 *
 * Les deux contrôles qui la tiennent sont dans `authorised-domains.test.ts` :
 * aucun domaine hors de D2.1, et aucun domaine sans code.
 */
export const ANOMALY_DOMAINS = [
  'GRAPH', 'GEOM', 'LAYOUT', 'RULES', 'IMPORT',
  'PACKAGE', 'SECURITY', 'DATA', 'EDIT', 'ASSET', 'TYPO', 'COLOR',
  'WAYFIND',
  // Partie G (G8) : budget de rendu, registre des polices.
  'RENDER', 'FONT',
  // Partie H (H12) : règlement d'enseigne, pose, coûts.
  'TENANT', 'INSTALL', 'COST',
  // Partie I (I6) : assistances de l'atelier, droits, exposition, régie, tournées.
  'ASSIST', 'MODULE', 'FLOW', 'AD', 'SURVEY',
  // Partie M, section M2 : calage d'un fond de plan.
  'CALIB',
  // A5.8 et D2.2 : une règle de charte déclarée dont les paramètres ne se
  // lisent pas. Le domaine avait été retiré en version 13, déclaré et vide ;
  // la version 15 le rétablit avec son premier code.
  'CHARTER',
  // A5.11, règle M01.S11 : les faits du site fondent les deux domaines.
  'PARK', 'DOC',
  // Partie J : encre, esquisse, révision, pictogrammes, bibliothèques.
  'INK', 'SKETCH', 'REVIEW', 'PICTO', 'LIBRARY',
] as const;

export type AnomalyDomain = (typeof ANOMALY_DOMAINS)[number];

/**
 * D2.1 — « Un code est stable à vie. Il n'est jamais renommé, jamais traduit,
 * jamais réutilisé pour un autre sens. Un code retiré est marqué obsolète et
 * sa valeur reste réservée. »
 *
 * Ces valeurs ont existé dans le dépôt et n'y sont plus. Elles restent
 * réservées : aucune ne peut être réemployée pour un autre sens. Un contrôle
 * échoue si l'une d'elles reparaît au catalogue.
 */
export const RETIRED_CODES: Readonly<Record<string, string>> = {
  'NET.REQUEST_FAILED':
    'Le domaine `NET` n’était autorisé par aucun des quatorze documents, et D2.2 réserve le catalogue aux anomalies produites par un moteur — or un moteur n’a pas de réseau (A4.1). Remplacé par un genre de défaillance de dépôt, qui appelle un état d’écran de F7.',
  'NET.UNAUTHORIZED': 'Même motif que `NET.REQUEST_FAILED`.',
  'NET.FORBIDDEN': 'Même motif que `NET.REQUEST_FAILED`.',
  'NET.NOT_FOUND': 'Même motif que `NET.REQUEST_FAILED`.',
  'NET.OFFLINE': 'Même motif que `NET.REQUEST_FAILED`. F7 en fait un état d’écran, pas une anomalie.',
  'CALIB.NORTH_MISSING':
    'Inventé. M2 (partie M) nomme `CALIB.AZIMUTH_INVALID` pour l’azimut et `CALIB.POINT_REQUIRED` pour un point manquant. Les deux sont désormais au catalogue.',
  'DATA.VOCABULARY_UNREADABLE':
    'Retiré par l’éditeur : c’est un état d’écran de F7, non une anomalie produite par un moteur. Le vocabulaire illisible reste un genre de défaillance de dépôt, que l’écran présente comme tel.',
  'EDIT.NOTHING_TO_UNDO':
    'Retiré par l’éditeur : une pile d’annulation vide est un état d’écran de F7, non une anomalie de moteur. Même motif que le retrait de `NET.OFFLINE`.',
  'EDIT.NOTHING_TO_REDO':
    'Retiré par l’éditeur, même motif que `EDIT.NOTHING_TO_UNDO` : la pile est un état d’écran, pas un registre d’anomalies.',
};
