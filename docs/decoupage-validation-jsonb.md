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
