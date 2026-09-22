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
  // Complément atelier, QC-12 : la liaison ne tombe pas au même point d'un
  // niveau à l'autre, quand P5 (complément atelier) veut qu'elle y tombe.
  'GRAPH.VERTICAL_LINK_MISALIGNED':         { severity: 'blocking', description: 'Liaison verticale décalée entre deux niveaux' },
  // Complément atelier, QC-10 : atteignable depuis une entrée ne vaut pas
  // atteignable depuis toutes, et le sens de circulation y entre.
  'GRAPH.DESTINATION_ENTRANCE_COVERAGE':    { severity: 'blocking', description: 'Destination que toutes les entrées n’atteignent pas' },
  'GRAPH.BUILDING_ISOLATED':                { severity: 'warning',  description: 'Bâtiment sans liaison ni accès indépendant' },
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
  // Partie N, module 02 (N2.4) : audit de couverture.
  'GRAPH.DECISION_POINT_UNCOVERED':         { severity: 'blocking', description: 'Point de décision qu’aucun support ne couvre' },
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
  'LAYOUT.STROKE_RATIO_OUT_OF_BOUNDS':     { severity: 'blocking', description: 'Rapport épaisseur/hauteur hors des bornes' },
  'LAYOUT.MOUNTING_OUT_OF_RANGE':          { severity: 'blocking', description: 'Hauteur d’implantation hors de la plage' },
  'LAYOUT.CONTENT_OVERFLOW':               { severity: 'blocking', description: 'Contenu ne tenant pas dans le format' },
  'LAYOUT.DIMENSIONS_OVERRIDDEN_NONCONFORM': { severity: 'blocking', description: 'Format saisi manuellement et non conforme' },
  'LAYOUT.TEMPLATE_INVALID':                { severity: 'blocking', description: 'Gabarit non conforme au chargement (grille, liaison ou rôle)' },
  'LAYOUT.TEMPLATE_BINDING_UNSUPPORTED':    { severity: 'blocking', description: 'Liaison de bloc non prise en charge par le compilateur de gabarit' },
  'LAYOUT.DESTINATION_NOT_FOUND':           { severity: 'blocking', description: 'Destination affichée inexistante' },
  'LAYOUT.DESTINATION_UNREACHABLE':         { severity: 'blocking', description: 'Destination affichée non atteignable' },
  'LAYOUT.LANG_VARIANT_MISSING':            { severity: 'warning',  description: 'Dénomination absente dans une langue active' },
  'LAYOUT.LANG_VARIANT_LONGER':             { severity: 'info',     description: 'La variante non primaire est plus longue' },
  'LAYOUT.LEXICON_FORBIDDEN_TERM':          { severity: 'blocking', description: 'Terme interdit par la charte' },
  // Complément atelier, QC-06 : caractère que la rédaction propre bannit.
  'LAYOUT.FORBIDDEN_CHARACTER':             { severity: 'blocking', description: 'Caractère interdit dans un texte de livrable' },
  // Complément atelier, QC-20 : rédaction trop longue dans un texte libre.
  'LAYOUT.SENTENCE_TOO_LONG':               { severity: 'warning',  description: 'Phrase plus longue que la rédaction ne l’admet' },
  'LAYOUT.LEXICON_DISCOURAGED_TERM':        { severity: 'warning',  description: 'Terme déconseillé par la charte' },
  // Complément atelier, M3 et QC-05 : un texte qui contredit un fait du site.
  'LAYOUT.FACT_CONTRADICTED':               { severity: 'blocking', description: 'Texte contraire à un fait du site' },
  // Complément atelier, M16 : deux sources donnent des valeurs différentes.
  'LAYOUT.SOURCE_DISCREPANCY_OPEN':         { severity: 'warning',  description: 'Écart entre sources non arbitré, valeur retenue à confirmer' },

  // ── PARK (complément atelier, M2) ─────────────────────────
  'PARK.CAPACITY_UNEXPLAINED':              { severity: 'blocking', description: 'Places numérisées en deçà de la capacité annoncée, sans zone non couverte déclarée' },
  'PARK.CAPACITY_EXCEEDED':                 { severity: 'blocking', description: 'Places numérisées au-delà de la capacité annoncée' },
  'PARK.SOURCE_MISSING':                    { severity: 'blocking', description: 'Objet de stationnement sans source' },
  'PARK.PROPOSAL_AS_EXISTING':              { severity: 'blocking', description: 'Objet de stationnement non existant porté à un livrable' },

  // ── DOC (complément atelier, M15) ─────────────────────────
  'DOC.BINDING_UNKNOWN':                    { severity: 'blocking', description: 'Champ lié que le modèle n’offre pas : faute du document' },
  'DOC.BINDING_UNRESOLVED':                 { severity: 'blocking', description: 'Champ lié sans valeur : le paragraphe ne se rend pas' },
  'DOC.LITERAL_NUMBER':                     { severity: 'warning',  description: 'Nombre écrit en littéral là où un champ lié est attendu' },
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
  'RULES.OVERLAY_LESS_RESTRICTIVE':        { severity: 'blocking', description: 'Surcouche pays moins contraignante que le socle' },
  'RULES.OVERLAY_NOT_COMPARABLE':          { severity: 'warning',  description: 'Surcouche pays non comparable au socle, règle du socle conservée' },
  'RULES.FILE_NOT_LISTED':                 { severity: 'blocking', description: 'Fichier de règles non listé dans le manifeste' },
  'RULES.FILE_MISSING':                    { severity: 'blocking', description: 'Fichier listé dans le manifeste introuvable' },
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
  'IMPORT.FILE_TOO_LARGE':                  { severity: 'blocking', description: 'Fichier au-delà de la taille acceptée' },
  'IMPORT.FORMAT_UNSUPPORTED':              { severity: 'blocking', description: 'Format de fichier non pris en charge' },
  'IMPORT.PAGE_REQUIRED':                   { severity: 'blocking', description: 'Page requise pour un document multipage' },
  'IMPORT.ENCODING_UNSUPPORTED':            { severity: 'blocking', description: 'Encodage non reconnu' },
  'IMPORT.EMPTY_FILE':                      { severity: 'blocking', description: 'Fichier d’import vide' },
  'IMPORT.VECTOR_AS_REFERENCE_ONLY':        { severity: 'info',     description: 'Fichier importé en référence de fond, sans exploitation' },

  // ── PACKAGE ───────────────────────────────────────────────
  'PACKAGE.NETWORK_DEPENDENCY':             { severity: 'blocking', description: 'Le paquet de borne émet une requête sortante' },
  'PACKAGE.CHECKSUM_MISMATCH':             { severity: 'blocking', description: 'Intégrité du paquet non vérifiée' },
  'PACKAGE.NON_DETERMINISTIC':             { severity: 'blocking', description: 'Deux compilations divergent' },
  'PACKAGE.EMPTY_ARTIFACT':                { severity: 'blocking', description: 'Artefact vide dans le paquet' },
  'PACKAGE.DUPLICATE_ID':                  { severity: 'blocking', description: 'Identifiant en double dans le paquet' },
  'PACKAGE.DUPLICATE_PATH':                { severity: 'blocking', description: 'Chemin en double dans le paquet' },
  'PACKAGE.FILE_MISSING':                  { severity: 'blocking', description: 'Fichier requis absent de l’arborescence du paquet de borne' },
  'PACKAGE.ABSOLUTE_PATH':                 { severity: 'blocking', description: 'Chemin absolu interdit dans le paquet de borne' },
  'PACKAGE.INTEGRITY_MISMATCH':            { severity: 'blocking', description: 'Fichier téléchargé non conforme au manifeste' },

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
  'DATA.KIOSK_CONFIG_INVALID':              { severity: 'blocking', description: 'Configuration locale de borne invalide' },
  'DATA.FACE_DIMENSIONS_INVALID':           { severity: 'blocking', description: 'Dimensions de face nulles ou négatives' },
  'DATA.SUPPORT_VERSION_TRANSITION_FORBIDDEN': { severity: 'blocking', description: 'Transition d’état de version de support interdite' },
  'DATA.SUPPORT_VERSION_REJECT_MOTIF_REQUIRED': { severity: 'blocking', description: 'Rejet de version de support sans motif' },
  // N4.3 — règle M04.G7 : une version approuvée est immuable, une correction crée
  // une nouvelle version.
  'DATA.APPROVED_VERSION_NOT_IMMUTABLE': { severity: 'blocking', description: 'Version approuvée dont l’immuabilité n’est pas tenue' },
  'DATA.FACE_CONTENT_UNSERIALIZABLE':       { severity: 'blocking', description: 'Contenu de face non sérialisable pour l’empreinte' },

  // Partie N, module 01 (N1.4) : code de cellule (règle M01.S3).
  'DATA.UNIT_CODE_REQUIRED':                { severity: 'blocking', description: 'Empreinte de nature cellule sans code d’unité' },
  'DATA.NAME_REQUIRED':                     { severity: 'blocking', description: 'Nom requis' },
  'DATA.NAME_DUPLICATE':                    { severity: 'blocking', description: 'Nom déjà porté par un autre site de l’organisation' },
  'DATA.COUNTRY_REQUIRED':                  { severity: 'blocking', description: 'Pays requis' },
  'DATA.LANG_REQUIRED':                     { severity: 'blocking', description: 'Au moins une langue active requise' },
  'DATA.CODE_DUPLICATE':                    { severity: 'blocking', description: 'Deux cellules portent le même code sur un niveau' },

  // ── WAYFIND (H12) ─────────────────────────────────────────
  'WAYFIND.NAMING_COLLISION':               { severity: 'blocking', description: 'Deux entités portent le même nom d’orientation' },
  'WAYFIND.CONTINUITY_BROKEN':              { severity: 'blocking', description: 'Destination annoncée puis abandonnée avant d’être atteinte' },
  'WAYFIND.NO_INFORMATION_LEVEL':           { severity: 'blocking', description: 'Support rattaché à aucun niveau d’information' },
  'WAYFIND.TOO_MANY_DESTINATIONS':          { severity: 'blocking', description: 'Nombre de destinations par face dépassé' },
  'WAYFIND.SCHEDULE_STALE':                 { severity: 'warning',  description: 'Tableau des messages périmé' },
  'WAYFIND.LINE_MISSING':                   { severity: 'blocking', description: 'Ligne de message absente pour ce bloc de face' },
  'WAYFIND.LINE_MALFORMED':                 { severity: 'blocking', description: 'Ligne de message inexploitable à la composition' },
  'WAYFIND.SUPPORT_TYPE_UNKNOWN':           { severity: 'blocking', description: 'Support rattaché à une typologie inconnue' },
  'WAYFIND.FACE_TEMPLATE_MISSING':          { severity: 'blocking', description: 'Aucun gabarit pour cette face de typologie' },
  // Partie N, module 02 (N2.4) : justification d'une ligne (règle M02.W4).
  'WAYFIND.LINE_UNJUSTIFIED':               { severity: 'blocking', description: 'Ligne de message sans point de décision qui la justifie' },

  // ── CALIB (D4 / tranche M) ────────────────────────────────
  'CALIB.DISTANCE_INVALID':                 { severity: 'blocking', description: 'Distance réelle nulle ou négative entre les deux points de calage' },
  'CALIB.POINT_REQUIRED':                   { severity: 'blocking', description: 'Point de calage non saisi' },
  'CALIB.AZIMUTH_INVALID':                  { severity: 'blocking', description: 'Azimut du nord hors de la plage 0 à 360 exclus' },
  'CALIB.POINTS_TOO_CLOSE':                 { severity: 'blocking', description: 'Points de calage trop proches pour une échelle fiable' },
  'CALIB.SCALE_IMPLAUSIBLE':                { severity: 'warning',  description: 'Résolution du fond de plan hors de la plage de vraisemblance' },
  // Partie N, module 01 (N1.4) : niveau sans plan calé.
  'CALIB.LEVEL_NOT_CALIBRATED':             { severity: 'blocking', description: 'Niveau sans plan de fond calé' },
  // Complément atelier, M1.4 : calage mesuré sur points homologues.
  'CALIB.CONTROL_POINTS_INSUFFICIENT':      { severity: 'blocking', description: 'Moins de trois paires de points homologues pour un calage mesuré' },
  'CALIB.CONTROL_POINTS_COLLINEAR':         { severity: 'blocking', description: 'Points homologues alignés, la transformation affine est indéterminée' },
  'CALIB.RESIDUAL_NOT_MEASURED':            { severity: 'warning',  description: 'Trois points homologues : l’ajustement est exact par construction, le résidu ne mesure rien' },
  'CALIB.RESIDUAL_MEAN_EXCEEDED':           { severity: 'blocking', description: 'Résidu moyen de calage au-dessus de la tolérance' },
  'CALIB.RESIDUAL_POINT_EXCEEDED':          { severity: 'blocking', description: 'Résidu d’un point homologue au-dessus de la tolérance' },
  // N1.3 — règle M01.S1 : le repère site est fixé au premier calage.
  'CALIB.ORIGIN_LOCKED':                    { severity: 'blocking', description: 'Repère site déjà fixé par le premier calage' },
  'CALIB.ORIGIN_MISMATCH':                  { severity: 'blocking', description: 'Repère site différent de celui du premier calage' },


  // ── EDIT (E17) ────────────────────────────────────────────
  'EDIT.CONTEXT_VIOLATION':                 { severity: 'blocking', description: "Opération interdite dans ce contexte d'édition" },
  'EDIT.BOOLEAN_RESULT_INVALID':            { severity: 'blocking', description: 'Opération booléenne produisant une géométrie invalide' },
  'EDIT.CROSS_ORG_PASTE_DENIED':            { severity: 'blocking', description: 'Collage entre organisations refusé' },
  'EDIT.UNDO_AFTER_SYNC':                   { severity: 'warning',  description: "Annulation demandée sur une modification déjà synchronisée" },
  'EDIT.TEMPLATE_BLOCK_OVERFLOW':           { severity: 'blocking', description: 'Bloc débordant de la grille du gabarit' },
  'EDIT.OBJECT_LOCKED':                     { severity: 'warning',  description: 'Objet verrouillé par un autre utilisateur' },
  'EDIT.LOCK_OVERRIDDEN':                   { severity: 'info',     description: 'Verrou forcé, journalisé' },
  'EDIT.TOUCH_TOOL_UNAVAILABLE':            { severity: 'info',     description: 'Outil de tracé indisponible au doigt' },
  'EDIT.TABLE_NOT_OWNED':                   { severity: 'blocking', description: 'Écriture demandée sur une table que le module ne possède pas' },
  'EDIT.COMMAND_SHAPE_INVALID':             { severity: 'blocking', description: 'Commande dont les états avant et après ne s’accordent pas avec l’opération' },
  'EDIT.TIMESTAMP_REQUIRED':                { severity: 'blocking', description: 'Commande sans horodatage fourni par l’appelant' },
  'EDIT.WRITE_REFUSED':                     { severity: 'blocking', description: 'Écriture refusée par la base' },
  'EDIT.NOTHING_TO_UNDO':                   { severity: 'info',     description: 'Aucun geste à annuler' },
  'EDIT.NOTHING_TO_REDO':                   { severity: 'info',     description: 'Aucun geste à rétablir' },

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
  'FLOW.WEIGHTS_NOT_NORMALIZED':             { severity: 'blocking', description: 'Somme des parts de fréquentation différente de 100 %' },
  // I5.3 : une pondération négative ou non finie n'est pas une pondération.
  'FLOW.WEIGHT_INVALID':                     { severity: 'blocking', description: 'Pondération négative ou non finie' },
  'FLOW.CORRELATION_TOO_LOW':                { severity: 'blocking', description: 'Corrélation sous le seuil déclaré pour produire un montant' },
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
  'PICTO.RASTER_CONTENT':                    { severity: 'blocking', description: 'Image en mode point dans un pictogramme' },
  'PICTO.FAMILY_INCONSISTENT':               { severity: 'warning',  description: 'Épaisseur ou grille incohérente avec la famille' },
  'LIBRARY.DUPLICATE_ON_IMPORT':             { severity: 'warning',  description: 'Symbole déjà présent dans la bibliothèque' },
} as const satisfies Record<string, { severity: 'blocking' | 'warning' | 'info'; description: string }>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

/**
 * D2.1 — the only anomaly domains allowed, and them alone. The nine domains
 * authorized by the complement (partie D, §D2.1): GRAPH, GEOM, LAYOUT, RULES,
 * CHARTER, IMPORT, PACKAGE, SECURITY, DATA — plus the four introduced by the
 * vector-editing addendum (partie E, E17): EDIT, ASSET, TYPO, COLOR — plus
 * WAYFIND, introduced by the missing-modules addendum (partie H, H12) for the
 * message schedule. These extensions are deliberate amendments reconciling
 * parties D, E and H; any code whose domain is not in this list is rejected by
 * the catalog test. A domain is added here in the same commit as the first code
 * that uses it, never in advance.
 */
export const ANOMALY_DOMAINS = [
  'GRAPH', 'GEOM', 'LAYOUT', 'RULES', 'CHARTER', 'IMPORT',
  'PACKAGE', 'SECURITY', 'DATA', 'EDIT', 'ASSET', 'TYPO', 'COLOR',
  'WAYFIND',
  // Partie G (G8): adaptive render budget, font registry (metrics and licences).
  'RENDER', 'FONT',
  // Partie H (H12): tenant sign regulation, installation, and cost modules.
  'TENANT', 'INSTALL', 'COST',
  // Partie I (I6): drawing-workshop assistance, entitlement, exposure, ads, survey.
  'ASSIST', 'MODULE', 'FLOW', 'AD', 'SURVEY',
  // Partie M : calage d'un fond de plan.
  'CALIB',
  // Complément atelier (M2) : stationnement.
  'PARK',
  // Complément atelier (M15) : document de stratégie et texte lié.
  'DOC',
  // Partie J: ink, sketch layer, revision, pictogram editor, libraries.
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
};
