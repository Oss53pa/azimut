# Validation par schéma des colonnes `jsonb`

Note de travail, ouverte le 24 novembre 2026. Elle ne fait pas foi : le
cahier des charges consolidé (`docs/cahier-des-charges.md`) seul fait foi.

## Le constat

Le poste écrit toutes les tables du schéma par `apply_commands` (0026) et
`apply_journaled_commands` (0078), qu'il appelle directement par PostgREST.
Aucun contrôle serveur ne s'intercale : la base est le seul endroit où une
entrée peut être validée par schéma avant écriture (règle de sécurité
permanente d'Oss53pa ; la validation du poste ne compte pas).

Relevé du catalogue, base d'essai à jour de 0081 : 40 colonnes `jsonb` dans
le schéma `azimut`, dont 26 sans aucune contrainte.

Le lecteur ne valide pas non plus : `packages/db/src/mapping/assemble-site-data.ts`
force le type de `node.position` sans le contrôler. Une position mal formée
entrait donc dans le modèle sans coordonnées.

## Décisions d'Oss53pa

| Question | Décision |
| --- | --- |
| Q15 | `node.position` et `opening.position` : objet `{x_m, y_m}` à deux nombres, toute autre clé refusée. Contrainte posée NOT VALID : les lignes existantes ne sont ni lues ni transformées, une requête de relevé les liste. Les décors d'essai fautifs sont corrigés. Fait par 0082 |
| Q16 | Les autres colonnes sont traitées dans un lot dédié, après S6.4 : forme tirée du cahier ou du code, question à Oss53pa là où A5 ne dit rien, contraintes NOT VALID |
| Q17 | `message_line.content` : le cahier (N2.2, R5) attend une valeur par langue, le code écrit `{block_kind, entries[…]}` avec le texte par langue imbriqué. L'écart est signalé à l'éditeur ; la base contraint la forme que le code écrit, pour fermer l'entrée libre sans casser le tableau des messages |
| Q18 | `footprint.geometry` : A5.2 s'applique, contrairement au choix de 0057. Contrainte en base : `{vertices: [{x_m, y_m}…]}`, au moins 3 sommets, fermeture implicite (premier sommet non répété, comme le code), aucun côté qui en croise un autre. NOT VALID, avec relevé |
| Q19 | Les colonnes sans forme ni au cahier ni au code reçoivent le type de leur contenant et une borne de taille ; le contenu se fixe au lot qui les emploiera. Chacune est signalée à l'éditeur |
| Q21 | `footprint.geometry` : 1 000 sommets au plus. Le test d'auto-intersection coûte de l'ordre de n² ; mesuré en local, 81 ms à 500 sommets, 296 ms à 1 000, 1,2 s à 2 000, 2,6 s à 3 000. Sans borne, une écriture de 1 Mio occuperait la base plusieurs minutes. Constante de forme, sans origine normative, signalée à l'éditeur |
| Q20 | `support_content_block.config`, colonne héritée que rien ne lit ni n'écrit : figée à NULL (NOT VALID), sans destruction ; son retrait se décidera après relevé |

Appliqué par analogie, sans question nouvelle, et signalé à Oss53pa : les
colonnes dont seul le code fixe la forme reçoivent le traitement de Q19
(contenant et taille), comme celles qui n'en ont aucune ; seules les formes
fixées par le cahier, ou tranchées par Q17 et Q18, reçoivent une contrainte
de contenu. La borne de taille est celle du transport des commandes
(`MAX_WIRE_COMMAND_LENGTH`, 1 048 576), et non une valeur nouvelle.

## Inventaire, 24 novembre 2026

Établi colonne par colonne, cahier contre code (verdict entre parenthèses) :

- fixée par le cahier : `support_content_block.free_text` (N4.2),
  `orientation_zone.footprint_ids` (N2.2), `rules_pack_rule.params` (D3.3),
  `graph_validation.findings` (A7, rattachement inféré) ;
- contradiction cahier-code : `message_line.content` (Q17),
  `footprint.geometry` (Q18) ;
- fixée par le code seul : `building.opening_hours`, `support_face.langs`,
  `job.payload`, `job.result`, `route_cache.path`,
  `travel_profile.excluded_edge_kinds` (dont les valeurs sont des natures de
  nœud, ce que le nom ne dit pas), deux natures sur sept de
  `charter_rule.params` ;
- sans forme : `edge.availability`, `travel_profile.weights`,
  `legal_entity.address`, `kiosk.hardware_profile`,
  `kiosk_telemetry.payload`, `work_order.scope`, `divergence.detail`,
  `support_content_block.binding` ;
- ouverte par conception : `audit_log.before`, `audit_log.after` ;
- héritée : `support_content_block.config` (Q20).

## 0082, fait le 24 novembre 2026

`azimut.point_m_valid(jsonb)`, contraintes `node_position_point` et
`opening_position_point`, NOT VALID. Éprouvé par
`packages/db/src/__tests__/a5-positions-point.db.test.ts`. Le relevé, sur les
bases locales, trouvait 17 nœuds mal formés sur la base d'essai (décors
d'essai qui écrivaient `{x, y}`, corrigés) et 2 sur la base du banc
d'authentification (écrits à la main). Une contrainte validée aurait fait
échouer la migration.

## Inventaire des 26 colonnes sans contrainte, pour le lot dédié

Relevé du catalogue, avant 0082. La forme attendue et le chemin d'écriture
restent à établir colonne par colonne.

```
audit_log.after                     audit_log.before
building.opening_hours              charter_rule.params
divergence.detail                   edge.availability
footprint.geometry                  graph_validation.findings
job.payload                         job.result
kiosk.hardware_profile              kiosk_telemetry.payload
legal_entity.address                message_line.content
node.position (0082)                opening.position (0082)
orientation_zone.footprint_ids      route_cache.path
rules_pack_rule.params              support_content_block.binding
support_content_block.config        support_content_block.free_text
support_face.langs                  travel_profile.excluded_edge_kinds
travel_profile.weights              work_order.scope
```

Restent 24 après 0082. Le lot dédié doit aussi relire le lecteur
(`assemble-site-data.ts`) : une ligne antérieure à une contrainte NOT VALID
peut encore être mal formée.

## 0084, fait le 24 novembre 2026

Les 24 colonnes portent une contrainte, posée NOT VALID :

- contenu, selon le cahier ou une décision : `footprint.geometry`
  (polygone simple, 3 à 1 000 sommets, sans côté nul ni croisement),
  `message_line.content` (Q17), `support_content_block.free_text` (une valeur
  non vide par langue, `fr` ou `en`), `orientation_zone.footprint_ids`
  (identifiants), `graph_validation.findings` (code et gravité de A7),
  `rules_pack_rule.params` (textes, nombres, booléens) ;
- `support_content_block.config` ne prend plus que sa valeur par défaut
  `'{}'`. Q20 disait « figée à NULL » ; la colonne est NOT NULL, de valeur par
  défaut `'{}'`, et aucune ligne n'en porte d'autre : la contrainte tient
  l'intention de Q20 (plus rien ne s'y écrit, rien n'est détruit) sans retirer
  le NOT NULL. Lecture confirmée par Oss53pa le 25 novembre 2026 : aucune
  migration de schéma pour une colonne que son retrait, après relevé,
  rendra sans objet ;
- contenant et taille pour les autres.

Le relevé, sur la base d'essai, ne trouve aucune ligne existante qui
échouerait à l'une des contraintes de 0084 ; seule `node_position_point`
(0082) reste à reprendre, sur d'anciens décors d'essai.

Éprouvé par `packages/db/src/__tests__/a5-jsonb-validation.db.test.ts`, dont
une garde de catalogue : aucune colonne `jsonb` du schéma sans contrainte.
L'essai mord : sans la contrainte des empreintes, deux essais tombent.

## Le lecteur, fait le 24 novembre 2026

`assemble-site-data.ts` relit `node.position` et `footprint.geometry` au lieu
de les transtyper (`packages/db/src/mapping/stored-shapes.ts`). Une ligne mal
formée, antérieure aux contraintes NOT VALID, fait refuser la construction du
site : la ligne 626 du cahier exclut tout résultat partiel, et le précédent de
`DATA.VOCABULARY_UNREADABLE`, retiré par l'éditeur, range une donnée illisible
parmi les défaillances de dépôt (F7). Aucun code nouveau au catalogue.

Le dépôt du studio la présente comme telle : la défaillance `unreadable`, qui
mène à l'état d'erreur de F7, avec son propre texte (« Le site contient une
donnée enregistrée illisible ») et, à l'ouverture, la table et l'identifiant de
la ligne à reprendre, jamais son contenu. La première version passait par
`request_failed`, et l'écran disait « Le dépôt n'a pas répondu. Vérifiez la
connexion » : faux, et de nature à faire chercher une panne réseau. Vu dans un
navigateur, corrigé.

Effet à connaître : un site qui porte une seule ligne illisible ne s'ouvre
plus. Le relevé de 0084 n'en trouve aucune hors d'anciens décors d'essai.

Reste : le contrôle porte sur la forme des deux colonnes que le lecteur
transtypait ; la simplicité du polygone relève du moteur géométrique. Le `zod`
en application que demande A5.2 n'est pas posé en tant que tel : le relecteur
en tient le rôle à la lecture, et la base à l'écriture.
