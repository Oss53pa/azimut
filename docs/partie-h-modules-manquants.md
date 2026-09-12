# Complément au cahier des charges de développement
## Azimut, partie H. Modules manquants et carte complète du produit

Éditeur : Atlas Studio

Cette partie corrige un défaut de découpage des documents précédents et ajoute les modules absents. Elle prend le même rang que la partie A dans l'ordre de préséance.

---

## H0. L'erreur corrigée

Les documents précédents traitaient le produit comme une chaîne unique allant du plan au support fabricable. Ce découpage confond trois métiers qui ont des acteurs, des livrables et des calendriers différents.

**Le wayfinding** est une stratégie d'orientation. Zonage, nomenclature, hiérarchie de l'information, plan de jalonnement. Il répond à la question : que dit-on, où, dans quel ordre. Il précède tout dessin.

**Les parcours clients** relèvent de l'analyse commerciale. Flux réels, exposition des cellules, zones chaudes et froides, incidence sur la commercialisation et sur la valeur locative. L'acteur est la direction commerciale, pas le concepteur.

**La signalétique** est la production. Elle traduit en supports fabricables ce que les deux premiers ont arrêté.

Conséquence de cette confusion : le **tableau des messages**, livrable central de la pratique du wayfinding, n'apparaît nulle part dans les cinq documents précédents. C'est l'omission la plus grave de l'ensemble, et elle est corrigée en H2.

---

## H1. Carte complète des modules

| Module | Acteur principal | Statut |
| --- | --- | --- |
| 1. Socle du site | Concepteur | Spécifié |
| 2. Wayfinding, stratégie d'orientation | Concepteur, maîtrise d'ouvrage | **Manquant** |
| 3. Parcours clients, analyse commerciale | Direction commerciale | **Manquant** |
| 4. Signalétique, production | Concepteur, fabricant | Spécifié |
| 5. Régie publicitaire | Régie, annonceurs | **Manquant** |
| 6. Enseignes locataires | Exploitant, locataires | **Manquant** |
| 7. Chantier et pose | Conducteur de travaux | **Manquant** |
| 8. Exploitation et maintenance | Exploitant | Partiel |
| 9. Budget et estimation | Maîtrise d'ouvrage | **Manquant** |
| 10. Portefeuille multi-sites | Direction | **Manquant** |
| 11. Fonctions transverses | Tous | Partiel |

Sept modules manquants sur onze. C'est l'ampleur réelle de l'écart, et il faut la voir avant de décider quoi construire.

---

## H2. Module 2, wayfinding

### H2.1 Objet

Établir la stratégie d'orientation avant toute conception de support. C'est le module qui manquait, et c'est celui qui fait la différence entre un logiciel de dessin et un outil de wayfinding.

### H2.2 Zonage et nomenclature

Un site s'orien­te d'abord par la façon dont on le nomme. Le module porte :

- Découpage en zones d'orientation, distinctes des zones techniques du socle.
- Nomenclature des niveaux, des zones, des accès, des noyaux verticaux, des portes.
- Règles de nommage déclarées et vérifiées : cohérence entre bâtiments, unicité, longueur maximale compatible avec les supports, prononçabilité dans les deux langues.
- Détection des collisions de nommage, cas fréquent sur les sites multibâtiments où deux portes A coexistent.

Le nommage est une donnée du wayfinding, jamais une saisie libre au moment de composer un panneau.

### H2.3 Hiérarchie de l'information

Quatre niveaux d'information, déclarés par site et appliqués par le moteur de composition :

1. Identification : où suis-je.
2. Orientation : que trouve-t-on, dans quelle direction.
3. Direction : par où aller.
4. Confirmation : je suis arrivé.

Chaque typologie de support est rattachée à un ou plusieurs niveaux d'information. Un support qui n'en porte aucun est une anomalie : il existe sans raison.

### H2.4 Plan de jalonnement

Le jalonnement est la traduction spatiale de la hiérarchie. Le module produit, pour chaque parcours et chaque profil :

- La séquence des points de décision, dans l'ordre de rencontre.
- Le niveau d'information attendu à chaque point.
- La continuité du message : une destination annoncée à un point doit être reprise ou confirmée au point suivant. La rupture de continuité est l'erreur de wayfinding la plus fréquente et la moins visible.

Contrôle automatisé : détecter toute destination annoncée puis abandonnée avant d'être atteinte.

### H2.5 Tableau des messages

**Le livrable central, absent jusqu'ici.**

Pour chaque face de chaque support : le contenu exact, dans chaque langue, avec le pictogramme associé, la direction indiquée, le niveau d'information et la référence au point de décision qui le justifie.

C'est ce document que valide la maîtrise d'ouvrage, avant tout dessin. C'est aussi lui qui permet de vérifier la cohérence d'ensemble, ce qu'aucune relecture de maquettes ne permet.

Propriétés exigées :

- Généré depuis le graphe et le plan de jalonnement, jamais saisi.
- Exportable en tableur et en document, avec un identifiant stable par ligne.
- Versionné et soumis au même circuit de validation que les bons à tirer.
- Toute modification du graphe ou de l'annuaire marque les lignes concernées comme périmées.
- Le moteur de composition consomme le tableau des messages. Il ne résout pas le contenu directement depuis le graphe.

Cette dernière règle change l'architecture posée en partie A : le tableau des messages s'intercale entre le graphe et la composition. C'est plus juste, parce que la validation porte sur le message et non sur son rendu.

### H2.6 Principes déclarés

Règles de wayfinding paramétrables par site, contrôlées automatiquement : nombre maximal de destinations par face, ordre d'énumération, traitement des destinations à faible fréquentation, règle de rappel des sanitaires et des sorties, distance maximale entre deux supports d'une même séquence.

---

## H3. Module 3, parcours clients

### H3.1 Objet

Analyse commerciale des flux. Acteur : la direction commerciale, pas le concepteur. Ce module se vend séparément et à un autre interlocuteur.

### H3.2 Contenu

- **Flux modélisés** entre les entrées et les destinations, pondérés par des hypothèses de fréquentation déclarées, jamais inventées par l'outil.
- **Exposition d'une cellule** : nombre de parcours passant devant, calculé sur le graphe. C'est une mesure objective et reproductible, ce que les appréciations d'emplacement ne sont pas.
- **Zones chaudes et froides** en découlant, avec représentation sur le plan.
- **Incidence de scénarios** : ouvrir un accès, déplacer une locomotive, fermer une liaison verticale, et comparer l'exposition avant et après.
- **Confrontation aux données réelles** quand elles existent : comptage de personnes, télémétrie des bornes, données de caisse. Importées, jamais produites par Azimut.

### H3.3 Limite à déclarer

Un modèle de flux fondé sur le graphe est une simulation, pas une mesure. L'outil affiche systématiquement les hypothèses retenues avec le résultat, et ne présente jamais un chiffre simulé comme une observation. Cette règle est de niveau bloquant : un rapport de flux sans ses hypothèses ne peut pas être exporté.

---

## H4. Module 5, régie publicitaire

Périmètre retenu : régie complète. Écrans numériques inventoriés et planifiés, sans diffusion de contenu, qui reste confiée à un système tiers.

### H4.1 Inventaire des emplacements

Un emplacement publicitaire est un objet distinct d'un support de signalétique, même s'il partage la géométrie du site.

Attributs : implantation, typologie, format, substrat, éclairage, faces, visibilité mesurée depuis le module parcours, exposition estimée, contraintes de pose, référence photographique en situation.

### H4.2 Fiche technique

Document remis à l'annonceur : cotes utiles, zone de sécurité, résolution requise, profil colorimétrique, délai de livraison des fichiers, contraintes de format. Générée, jamais rédigée à la main.

### H4.3 Planning d'occupation

Calendrier par emplacement, avec états : libre, option, réservé, occupé, en maintenance, retiré. Détection des conflits de réservation. Vue portefeuille du taux d'occupation par période, par typologie et par zone.

### H4.4 Contrats et commercialisation

- Annonceur, agence, contact, conditions commerciales.
- Contrat rattachant un ou plusieurs emplacements à une période et à un prix.
- Grille tarifaire par typologie, par zone d'exposition et par saisonnalité.
- Options avec date d'expiration automatique.
- Renouvellements et avenants tracés.

### H4.5 Facturation, et sa limite

**Azimut émet les factures et les données de vente. Azimut n'est jamais le livre comptable.**

Le module produit les factures, les échéanciers et les états de vente, et les exporte vers la comptabilité du client. Il ne tient ni grand livre, ni déclaration fiscale, ni rapprochement bancaire.

Motif : franchir cette ligne obligerait à suivre les réglementations fiscales de chaque pays de vente, qui diffèrent et évoluent. C'est un métier entier, et il n'est pas le vôtre. La limite figure au contrat.

### H4.6 Réception et contrôle des visuels

- Dépôt du fichier par l'annonceur ou son agence.
- Assainissement obligatoire, selon les règles déjà posées pour les actifs importés.
- Contrôles automatiques : format, résolution, zone de sécurité, profil colorimétrique, poids.
- Contrôles déclaratifs à valider par un humain : conformité au règlement intérieur du site, absence de contenu interdit, mentions légales.
- Circuit d'approbation, avec refus motivé et demande de nouveau fichier.

### H4.7 Rendu en situation

Le visuel reçu est composé sur la photographie ou sur la vue du plan, à l'emplacement réel et à l'échelle. C'est l'argument commercial le plus efficace face à un annonceur, et il est presque gratuit puisque la géométrie existe déjà.

### H4.8 Espace annonceur

Accès restreint permettant de consulter ses emplacements, déposer ses visuels, suivre ses validations et ses échéances. Aucun accès aux données du site ni aux autres annonceurs.

---

## H5. Module 6, enseignes locataires

### H5.1 Objet

Instruire et valider les projets de devanture des locataires au regard du règlement d'enseigne du site. Besoin quotidien d'un exploitant de centre, entièrement absent des documents précédents.

### H5.2 Contenu

- Règlement d'enseigne du site, exprimé en règles contrôlables : hauteurs, débords, matériaux, éclairage, plages horaires, interdits.
- Dépôt du dossier par le locataire : élévation, coupe, matériaux, visuel.
- Contrôles automatiques sur ce qui est mesurable, avis humain sur le reste.
- Circuit d'instruction avec avis, réserves, accord, refus motivé.
- Constat de conformité après pose, avec photographie.
- Historique par cellule, conservé au-delà du changement de locataire.

### H5.3 Articulation

Une enseigne locataire n'est pas un support Azimut : elle appartient au locataire. Elle est instruite et suivie, jamais conçue par l'outil. La distinction doit être nette dans le modèle de données comme dans l'interface.

---

## H6. Module 7, chantier et pose

### H6.1 Le vide comblé

Entre le bon à tirer approuvé et le support posé, les documents précédents ne prévoyaient rien. Or c'est la phase où se produisent les écarts que la couche de divergence détecte ensuite sans savoir d'où ils viennent.

### H6.2 Contenu

- Allotissement : répartition des supports en lots, rattachement à un fabricant.
- Ordre de fabrication, avec le carnet, les exécutions et le quantitatif du lot.
- Suivi de fabrication : commandé, en production, livré.
- Réception en usine ou sur site, avec réserves.
- Planning de pose, par zone et par date, avec contraintes d'exploitation.
- Procès-verbal de pose, par support, avec photographie et constat.
- Levée des réserves, tracée.
- Bascule automatique en support posé une fois la pose constatée, ce qui alimente la couche de divergence avec une origine connue.

---

## H7. Module 8, exploitation et maintenance

Le socle existe par la couche de divergence. Ce qui manque est l'espace de travail.

- Tournées d'inspection planifiées, avec relevé mobile hors ligne.
- Signalement d'incident sur un support, avec photographie et géolocalisation dans le plan.
- Nettoyage, remplacement de source lumineuse, reprise de fixation.
- Pièces de rechange et stock de supports de remplacement.
- Ordres de travaux, déjà prévus, reliés ici à leur origine.
- Indicateurs : taux de conformité du parc, âge moyen, coût de maintien par support.

---

## H8. Module 9, budget et estimation

- Coût unitaire par typologie, par substrat et par fabricant, historisé.
- Estimation automatique d'un carnet, depuis le quantitatif.
- Comparaison entre l'estimation, le devis reçu et le réalisé.
- Budget par phase et par lot, avec suivi de consommation.
- Coût de reprise chiffré lors d'une mutation d'occupant. Cette fonction, déjà évoquée pour l'état locatif, n'avait pas de modèle de coût derrière elle.

Multi-devises, conformément aux contraintes de marché déjà posées.

---

## H9. Module 10, portefeuille multi-sites

Un groupe gérant plusieurs sites n'a aujourd'hui aucune vue d'ensemble dans le produit.

- Vue de tous les sites d'une organisation, avec leur état de conformité, leurs anomalies bloquantes, leur taux d'occupation publicitaire.
- Comparaison entre sites sur des indicateurs communs.
- Chartes et règlements partagés, avec héritage et dérogation par site.
- Bibliothèques de gabarits et de symboles partagées.
- Consolidation budgétaire.

---

## H10. Module 11, fonctions transverses

Absentes ou implicites jusqu'ici, toutes nécessaires.

- **Documents et pièces jointes** rattachés à toute entité : cahier des charges, contrat, procès-verbal, photographie, avec versionnage.
- **Recherche globale** sur les destinations, les supports, les emplacements, les documents, respectant le cloisonnement par organisation.
- **Notifications** : anomalie bloquante nouvelle, validation attendue, échéance de contrat, réserve non levée, paquet de borne non déployé. Par courriel et dans l'application, avec réglage par utilisateur.
- **Journal d'activité visible** par l'utilisateur, distinct du journal d'audit technique.
- **Tâches et affectations** entre membres, rattachées à une entité.
- **Tableau de bord** par rôle, montrant ce qui attend l'utilisateur, jamais une collection d'indicateurs décoratifs.

---

## H11. Ajouts au modèle de données

```sql
orientation_zone     (id, org_id, site_id, code, name_fr, name_en, kind)
naming_rule          (id, org_id, site_id, target, pattern, max_length, params jsonb)
information_level    (id, org_id, typology_id, level int)
wayfinding_sequence  (id, org_id, site_id, profile_id, ordinal int, node_id,
                      information_level int)
message_schedule     (id, org_id, site_id, version int, state, generated_at, inputs_hash)
message_line         (id, org_id, schedule_id, support_id, face_index, block_index,
                      content jsonb, pictogram_id, direction, information_level,
                      decision_point_id, stale boolean)

flow_hypothesis      (id, org_id, site_id, name, params jsonb, declared_by, declared_at)
flow_result          (id, org_id, site_id, hypothesis_id, computed_at, results jsonb)
cell_exposure        (id, org_id, destination_id, hypothesis_id, score numeric)

ad_placement         (id, org_id, site_id, node_id, typology, format jsonb,
                      substrate, lit boolean, faces int, photo_path)
ad_placement_state   (id, org_id, placement_id, state, from_date, to_date, contract_id)
advertiser           (id, org_id, name, agency, contact jsonb)
ad_contract          (id, org_id, advertiser_id, reference, currency,
                      amount_minor bigint, from_date, to_date, state)
ad_rate_card         (id, org_id, site_id, typology, zone_tier, season, amount_minor bigint)
ad_creative          (id, org_id, contract_id, placement_id, storage_path,
                      sanitized boolean, checks jsonb, state, submitted_at)
ad_invoice           (id, org_id, contract_id, reference, issued_at, due_at,
                      amount_minor bigint, state, exported_at)

tenant_signage_rule  (id, org_id, site_id, kind, params jsonb)
tenant_signage_case  (id, org_id, destination_id, state, submitted_at, decided_at)
tenant_signage_doc   (id, org_id, case_id, kind, storage_path)

fabrication_lot      (id, org_id, site_id, reference, vendor_id, state)
fabrication_order    (id, org_id, lot_id, issued_at, expected_at, state)
installation_record  (id, org_id, support_id, lot_id, installed_at, installer,
                      photo_path, reservations jsonb, cleared_at)

inspection_round     (id, org_id, site_id, scheduled_for, performed_at, performed_by)
inspection_finding   (id, org_id, round_id, support_id, kind, photo_path, severity)

cost_reference       (id, org_id, typology, substrate, vendor_id,
                      unit_cost_minor bigint, currency, valid_from)
budget_line          (id, org_id, site_id, phase, planned_minor bigint,
                      committed_minor bigint, actual_minor bigint, currency)

attachment           (id, org_id, entity_kind, entity_id, storage_path,
                      kind, version int, uploaded_by, uploaded_at)
notification         (id, org_id, user_id, kind, entity_kind, entity_id,
                      created_at, read_at)
```

Toutes ces tables portent `org_id` et arrivent avec leur politique de cloisonnement dans la même migration, conformément à la règle déjà posée.

---

## H12. Ajouts au catalogue des codes d'anomalie

| Code | Gravité | Sens |
| --- | --- | --- |
| `WAYFIND.NAMING_COLLISION` | bloquant | Deux entités portent le même nom d'orientation |
| `WAYFIND.CONTINUITY_BROKEN` | bloquant | Destination annoncée puis abandonnée avant d'être atteinte |
| `WAYFIND.NO_INFORMATION_LEVEL` | bloquant | Support rattaché à aucun niveau d'information |
| `WAYFIND.SCHEDULE_STALE` | avertissement | Tableau des messages périmé |
| `WAYFIND.TOO_MANY_DESTINATIONS` | bloquant | Nombre de destinations par face dépassé |
| `FLOW.HYPOTHESIS_MISSING` | bloquant | Export d'un résultat de flux sans ses hypothèses |
| `AD.PLACEMENT_DOUBLE_BOOKED` | bloquant | Conflit de réservation |
| `AD.CREATIVE_SPEC_MISMATCH` | bloquant | Visuel non conforme à la fiche technique |
| `AD.OPTION_EXPIRED` | information | Option arrivée à échéance |
| `TENANT.RULE_VIOLATION` | bloquant | Projet d'enseigne non conforme au règlement |
| `INSTALL.RESERVATION_OPEN` | avertissement | Réserve de pose non levée |
| `COST.REFERENCE_MISSING` | avertissement | Aucun coût de référence pour cette typologie |

---

## H13. Effet sur le périmètre et le phasage

Il faut regarder ce que cette partie fait au projet, sans l'atténuer.

**Le produit double de taille.** Sept modules manquants sur onze. Tout construire avant de vendre est impossible et serait une erreur.

**Ce qui doit entrer tôt, parce que le reste en dépend :** le module wayfinding, et en particulier le tableau des messages, qui s'intercale entre le graphe et la composition. L'ajouter après obligerait à reprendre le moteur de composition.

Proposition de rattachement :

| Module | Rattachement |
| --- | --- |
| Wayfinding, zonage, nomenclature, jalonnement | Incrément 1, ajout |
| Tableau des messages | Incrément 1, ajout, préalable à l'incrément 2 |
| Chantier et pose | Incrément 3, ajout |
| Exploitation, tournées et incidents | Incrément 3, ajout |
| Budget et estimation | Incrément 4 |
| Parcours clients, analyse commerciale | Incrément 5, module vendu séparément |
| Régie publicitaire | Incrément 5, module vendu séparément |
| Enseignes locataires | Incrément 5, module vendu séparément |
| Portefeuille multi-sites | Incrément 5 |
| Fonctions transverses | Réparties, documents et notifications dès l'incrément 2 |

Les trois modules d'incrément 5 s'adressent à des acheteurs différents du concepteur. C'est une bonne nouvelle commerciale, et une complication de mise en marché : trois offres, trois discours, trois cycles de vente.

**Conséquence à assumer.** Le chiffrage précédent devient caduc. La décomposition en lots de la partie G doit être reprise avec ces modules avant tout calibrage, sans quoi la mesure porterait sur un périmètre qui n'est plus le bon.

---

## H14. Ce que cette partie ne couvre pas

1. **Le nouveau chiffrage.** La décomposition de la partie G est à reprendre. Aucune durée ne doit être citée d'ici là.
2. **La question de l'offre.** Un produit unique à onze modules ou plusieurs produits vendus séparément est une décision commerciale, pas technique. Elle a des conséquences sur la facturation et sur les droits d'accès, et elle n'est pas tranchée.
3. **Les règles de calcul d'exposition.** Le principe est posé, la pondération d'un parcours par une hypothèse de fréquentation demande une méthode qui reste à établir, de préférence avec un professionnel de la commercialisation.
4. **Les obligations légales de la régie.** Mentions obligatoires, affichage des tarifs, règles de publicité applicables par pays. Non étudiées, et à traiter avec le corpus réglementaire déjà en attente.
5. **La diffusion sur écrans numériques.** Volontairement exclue. Inventaire et planning seulement, la diffusion restant confiée à un système tiers.
6. **Le relevé mobile hors ligne des tournées.** Le besoin est posé, l'application mobile qui le porterait n'est pas spécifiée et relève d'une décision de périmètre.
7. **Les essais sur usagers.** Toujours pas menés, et ils portent maintenant sur un produit deux fois plus large.
