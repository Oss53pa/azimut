# Complément au cahier des charges de développement
## Azimut, partie L. Fiches de modules et modèle d'intégration

Éditeur : Atlas Studio

Cette partie complète la partie H, qui décrivait le contenu des modules sans dire qui possède quelle donnée ni comment les modules se parlent. Elle prend le même rang que la partie A dans l'ordre de préséance.

---

## L0. Le cycle de dépendance trouvé, et sa résolution

En établissant la carte d'intégration, un cycle apparaît.

Le module wayfinding produit l'audit de couverture, qui compare les points de décision aux supports implantés. Il lit donc les supports. Le module signalétique produit les supports, et consomme le tableau des messages produit par le wayfinding. Chacun dépend de l'autre.

Un cycle de cette nature ne se contourne pas par une astuce technique. Il révèle une attribution fausse.

**Résolution.** L'implantation d'un support est une décision de wayfinding, pas de signalétique. Où l'on pose un support, de quelle typologie et à quel niveau d'information, relève de la stratégie d'orientation. À quoi il ressemble et comment il se fabrique relève de la production.

Le modèle de données se scinde en conséquence :

| Donnée | Module propriétaire |
| --- | --- |
| `support` : nœud, azimut, typologie, niveau d'information, distance de lecture | Wayfinding |
| `support_face`, `content_block`, `support_version`, `proof`, `approval` | Signalétique |
| `support` : cotes, substrat, fixation | Signalétique |

C'est aussi le découpage professionnel correct, et il supprime le cycle : le wayfinding ne lit plus la signalétique, il possède ce dont il a besoin.

Cette correction modifie la partie A, section A5.6. Elle est prioritaire sur elle.

---

## L1. Les quatre règles d'intégration

**R1. Propriété unique.** Chaque entité appartient à exactement un module. Lui seul l'écrit. Une entité sans propriétaire déclaré ne peut pas être créée.

**R2. Lecture sans écriture.** Tout module lit ce dont il a besoin dans les autres, aucun n'y écrit. Une fonctionnalité qui exige d'écrire chez le voisin est le signe d'une attribution fausse, comme au chapitre L0. Elle relève de la procédure d'arrêt et de demande.

**R3. Dépendance descendante.** Les modules sont rangés en couches. Une couche lit les couches inférieures, jamais les supérieures. Un cycle est une erreur de conception, jamais un cas à gérer.

**R4. Dégradation déclarée.** Chaque module dit ce qu'il devient quand un module dont il dépend n'est pas souscrit. Le comportement dégradé est spécifié, jamais improvisé, et jamais silencieux.

---

## L2. Couches

| Couche | Modules | Lit |
| --- | --- | --- |
| 0. Socle | 01 Socle du site | rien |
| 1. Stratégie | 02 Wayfinding, 03 Parcours clients | couche 0 |
| 2. Production et commerce | 04 Signalétique, 05 Régie, 06 Enseignes locataires | couches 0 et 1 |
| 3. Aval | 07 Chantier, 08 Exploitation, 09 Budget | couches 0 à 2 |
| 4. Transverse | 10 Portefeuille, 11 Fonctions transverses | toutes |
| Surface | 12 Atelier de dessin | sert les couches 0 à 2, ne possède aucune donnée métier |

L'atelier n'est pas une couche. C'est la surface d'édition commune. Il possède ses propres données de travail, esquisses et calques, et aucune donnée métier.

---

## L3. Fiches de modules

### 01. Socle du site

**Rôle.** Porter la réalité physique du site. Tout le reste s'y appuie.

**Possède.** `site`, `building`, `level`, `zone`, `plan_source`, `plan_calibration`, `footprint`, `volume`, `opening`, `node`, `edge`, `vertical_link`, `building_link`, `destination`, `destination_name`, `category`, `decoration_layer`, `decoration_shape`, `annotation`, `imported_asset`, `layout_composition`.

**Lit.** Rien.

**Produit.** Le graphe validé, l'annuaire, la scène géométrique.

**Consommé par.** Tous.

**Moteurs.** `engine-graph` pour la validation de complétude, `engine-iso` pour la scène.

**Si absent.** Impossible. Aucun module ne fonctionne sans lui, il n'est pas optionnel et n'entre pas dans le modèle de droits.

---

### 02. Wayfinding

**Rôle.** Décider ce que l'on dit, où, et dans quel ordre.

**Possède.** `orientation_zone`, `naming_rule`, `information_level`, `wayfinding_sequence`, `message_schedule`, `message_line`, et les attributs d'implantation de `support` selon L0.

**Lit.** Graphe, annuaire, zones du socle. Profils et points de décision du module 03.

**Produit.** Le plan de jalonnement, le **tableau des messages**, l'audit de couverture.

**Consommé par.** 04 Signalétique, qui compose depuis `message_line`. 09 Budget, pour le quantitatif prévisionnel.

**Moteurs.** `engine-graph`.

**Si absent.** La signalétique ne peut pas composer. Le tableau des messages est le seul producteur de contenu de face. Le module 02 est donc un préalable dur de la production, et non une option commerciale. À traiter comme le socle dans le modèle de droits.

---

### 03. Parcours clients

**Rôle.** Analyser les flux et l'exposition. Acteur : direction commerciale.

**Possède.** `travel_profile`, `flow_hypothesis`, `flow_result`, `cell_exposure`, `route_cache`, `decision_point`.

**Lit.** Graphe et annuaire du socle. Surfaces et loyers du module 09 si souscrit.

**Produit.** Parcours calculés, points de décision, indice d'exposition par cellule, comparaison de scénarios.

**Consommé par.** 02 Wayfinding, pour les points de décision. 05 Régie, pour l'exposition d'un emplacement. 09 Budget, pour le chiffrage d'une recomposition.

**Moteurs.** `engine-graph`.

**Si absent.** Le wayfinding calcule ses points de décision avec un profil par défaut unique, non paramétrable, et le signale. La régie perd la tarification indexée sur l'exposition et retombe sur une grille saisie à la main.

**Règle propre.** Un résultat de flux ne s'exporte jamais sans les hypothèses qui l'ont produit. Anomalie bloquante.

---

### 04. Signalétique

**Rôle.** Produire les supports fabricables.

**Possède.** `support_typology`, `support_face`, `content_block`, `support_version`, `proof`, `approval`, `font_asset`, `pictogram`, `pictogram_family`, et les attributs de fabrication de `support` selon L0.

**Lit.** `message_line` du module 02. Scène et annuaire du socle. Charte et paquet de règles.

**Produit.** Exécutions PDF, plans muraux orientés, plans d'évacuation, quantitatif, bons à tirer.

**Consommé par.** 07 Chantier, 08 Exploitation, 09 Budget.

**Moteurs.** `engine-layout`, `engine-iso`, `engine-artwork`.

**Si absent.** Le wayfinding reste utilisable seul et se vend comme prestation d'audit et de stratégie. C'est d'ailleurs le premier livrable vendable du produit.

---

### 05. Régie publicitaire

**Rôle.** Commercialiser les emplacements publicitaires.

**Possède.** `ad_placement`, `ad_placement_state`, `advertiser`, `ad_contract`, `ad_rate_card`, `ad_creative`, `ad_invoice`.

**Lit.** Géométrie et scène du socle. `cell_exposure` du module 03. Paquet de règles publicitaires.

**Produit.** Fiches techniques, planning d'occupation, factures, rendu en situation, états de vente exportables.

**Consommé par.** 09 Budget, 10 Portefeuille.

**Si absent.** Sans effet sur les autres modules.

**Limite ferme.** Azimut émet les factures et les données de vente. Il n'est jamais le livre comptable. Il exporte vers la comptabilité du client.

---

### 06. Enseignes locataires

**Rôle.** Instruire les projets de devanture au regard du règlement d'enseigne.

**Possède.** `tenant_signage_rule`, `tenant_signage_case`, `tenant_signage_doc`.

**Lit.** `destination` et géométrie du socle.

**Produit.** Avis, réserves, accords, constats de conformité.

**Consommé par.** 08 Exploitation, pour l'historique par cellule.

**Si absent.** Sans effet sur les autres modules.

**Frontière.** Une enseigne locataire appartient au locataire. Elle est instruite et suivie, jamais conçue par le produit. Elle n'est pas un support Azimut et n'entre dans aucun quantitatif.

---

### 07. Chantier et pose

**Rôle.** Conduire la fabrication et la pose, de l'approbation au constat.

**Possède.** `fabrication_lot`, `fabrication_order`, `installation_record`.

**Lit.** `support_version` approuvées et exécutions du module 04.

**Produit.** `installed_support`, qui bascule automatiquement au constat de pose.

**Consommé par.** 08 Exploitation, 09 Budget.

**Si absent.** Les supports posés se saisissent à la main dans le module 08. La divergence est alors détectée sans que son origine soit connue, ce qui est précisément le vide que ce module comble.

---

### 08. Exploitation et maintenance

**Rôle.** Maintenir le parc en condition.

**Possède.** `installed_support`, `divergence`, `work_order`, `inspection_round`, `inspection_finding`.

**Lit.** `support_version` et empreintes de contenu du module 04. `installation_record` du module 07.

**Produit.** Divergences, ordres de travaux, indicateurs de parc.

**Consommé par.** 09 Budget, 10 Portefeuille.

**Si absent.** Le produit perd sa raison d'abonnement. Il redevient un outil de conception vendu au projet.

---

### 09. Budget et estimation

**Rôle.** Chiffrer et suivre.

**Possède.** `cost_reference`, `budget_line`.

**Lit.** Quantitatif du module 04, lots du module 07, ordres de travaux du module 08, contrats du module 05.

**Produit.** Estimations, comparaisons estimé et réalisé, coût de reprise sur mutation.

**Si absent.** Le quantitatif reste produit, sans valorisation.

---

### 10. Portefeuille

**Rôle.** Vue et consolidation multi-sites.

**Possède.** Bibliothèques partagées, chartes et règlements de groupe, règles d'héritage.

**Lit.** Tous les modules de tous les sites de l'organisation.

**Si absent.** Chaque site vit isolément, les bibliothèques se dupliquent.

---

### 11. Fonctions transverses

**Rôle.** Ce dont tous les modules ont besoin.

**Possède.** `attachment`, `notification`, tâches, journal d'activité, recherche.

**Lit.** Tout, en respectant le cloisonnement par organisation et les droits de rôle.

**Règle propre.** La recherche globale n'expose jamais une entité d'un module non souscrit ni d'une organisation tierce. Test dédié.

---

### 12. Atelier de dessin

**Rôle.** Surface d'édition commune.

**Possède.** `sketch_layer`, `sketch_stroke`, préférences d'outils, tables de raccourcis.

**Lit et écrit.** Les entités des modules 01, 02, 04 et 05, **par leur intermédiaire et jamais directement en base**. L'atelier appelle les commandes du module propriétaire. C'est ce qui empêche la règle R2 d'être contournée par l'interface.

**Si absent.** Sans objet. L'atelier n'est pas optionnel.

---

## L4. Chaîne de propagation

C'est le mécanisme qui porte la valeur du produit. Il traverse cinq modules et doit être implémenté comme une chaîne explicite, pas comme une série d'effets de bord.

**Un occupant change dans l'annuaire.**

1. Socle : `destination` est modifiée.
2. Wayfinding : les `message_line` qui citent cette destination passent à `stale`. Le tableau des messages est marqué périmé.
3. Signalétique : les faces dont le `content_hash` diffère de la dernière version approuvée deviennent périmées. Les autres ne bougent pas.
4. Budget : le coût de reprise des seuls supports périmés est estimé.
5. Exploitation : un ordre de travaux est proposé, jamais créé automatiquement.

**Règle de précision.** À chaque étape, le nombre d'entités touchées doit être exactement celui attendu. Une propagation trop large marque tout comme périmé et rend le mécanisme inutile. Une propagation trop étroite laisse des supports faux sur le terrain. Un test de bout en bout vérifie ce compte sur un site de référence.

**Autres chaînes à implémenter de la même manière :**

| Déclencheur | Propagation |
| --- | --- |
| Une arête du graphe change | Cache de parcours invalidé, points de décision recalculés, couverture réévaluée, tableau des messages marqué périmé |
| La charte change de version | Faces périmées, exécutions à régénérer |
| Le paquet de règles change de version | Contrôles rejoués sur tout le site, anomalies nouvelles remontées |
| Un support est posé | `installed_support` créé, divergence évaluée, ligne budgétaire consommée |
| Un contrat publicitaire expire | Emplacement libéré au planning, notification à la régie |

---

## L5. Événements

Chaque chaîne de L4 se déclenche par un événement nommé, émis par le module propriétaire et consommé par les autres.

Règles :

- Un événement porte l'identifiant de l'entité, le type de changement et la version. Jamais l'état complet.
- Un consommateur ne modifie jamais les données du module émetteur en réaction. Il modifie les siennes.
- Le traitement est idempotent. Rejouer un événement ne produit ni doublon ni effet supplémentaire.
- L'ordre de traitement entre consommateurs n'est jamais supposé.
- Aucun événement ne crée d'ordre de travaux, de facture ou de commande. Ces objets naissent d'une décision humaine, toujours.

---

## L6. Dégradation par module non souscrit

Récapitulatif, pour que le comportement ne s'improvise pas.

| Module absent | Effet déclaré |
| --- | --- |
| 03 Parcours clients | Profil unique par défaut pour le wayfinding, tarification publicitaire manuelle |
| 04 Signalétique | Le wayfinding se vend seul comme audit et stratégie |
| 05 Régie | Aucun effet |
| 06 Enseignes locataires | Aucun effet |
| 07 Chantier | Saisie manuelle des poses, origine des divergences inconnue |
| 08 Exploitation | Perte de la logique d'abonnement, retour au projet |
| 09 Budget | Quantitatif sans valorisation |
| 10 Portefeuille | Bibliothèques dupliquées par site |

Les modules 01, 02, 11 et 12 ne sont pas optionnels et n'entrent pas dans le modèle de droits. Le module 02 en particulier : sans tableau des messages, la signalétique n'a aucun producteur de contenu.

---

## L7. Ce que cette partie ne couvre pas

1. **Les écrans, en détail.** Inventoriés et rattachés à trois familles de mise en page. Chacun sera spécifié en entrant dans son incrément.
2. **Le mécanisme technique des événements.** File en base, notification interne ou autre. Relève de la procédure d'arrêt et de demande, avec deux contraintes fermes : idempotence et fonctionnement hors ligne.
3. **Les droits de rôle module par module.** Les six rôles sont définis, leur déclinaison fine par module reste à faire au moment de construire chaque module.
4. **L'effet de cette partie sur le chiffrage.** La scission de propriété de `support` touche une migration déjà prévue. L'ampleur n'est pas estimée.
