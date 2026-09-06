# Complément au cahier des charges de développement
## Azimut, partie E. Édition, capacités vectorielles et habillage
Éditeur : Atlas Studio
Cette partie complète le cahier des charges principal et la partie D. Elle prend le même rang que la partie A dans l'ordre de préséance.
Elle répond à une demande simple à énoncer et dangereuse à mettre en œuvre : disposer des capacités d'un éditeur vectoriel professionnel, en mieux et en plus simple.
---
## E0. Le cadrage, avant les fonctionnalités
### E0.1 La contradiction à lever
« Les mêmes fonctionnalités qu'un éditeur vectoriel » contredit frontalement l'invariant 2 : un panneau est une vue, pas un dessin.
Un éditeur vectoriel permet de placer n'importe quoi n'importe où. C'est exactement ce qu'Azimut doit refuser sur les faces de supports, et ce refus est toute sa valeur. Si un concepteur peut déplacer librement un texte sur une face, le contenu n'est plus résolu depuis le graphe, la régénération après changement d'enseigne cesse de fonctionner, la couche de divergence perd son objet, et la promesse d'abonnement s'effondre. Le produit serait alors un éditeur vectoriel de plus, en moins complet, avec deux ans de retard.
### E0.2 La réponse
L'édition libre n'est pas interdite. Elle est **cantonnée**, et la ligne de partage est le sujet principal de cette partie.
Trois contextes d'édition coexistent, avec des règles opposées. Les confondre est la faute la plus coûteuse que ce document cherche à prévenir.
### E0.3 En quoi le produit est meilleur, concrètement
Un éditeur vectoriel généraliste ignore ce qu'est un mur, une cellule, une circulation, une distance de lecture et une norme. Les avantages d'Azimut sont donc réels et vérifiables, mais ils ne portent pas sur la richesse de l'outillage de dessin :
1. **Le contenu ne peut pas mentir.** Une destination fermée disparaît de tous les plans. Un éditeur vectoriel laisse un plan afficher une boutique partie depuis six mois.
2. **Les dimensions sont calculées, pas dessinées.** La hauteur de caractère découle de la distance de lecture et d'une règle référencée. Un éditeur vectoriel laisse composer un panneau illisible sans rien signaler.
3. **La régénération est massive.** Vingt plans muraux se refont en une compilation, chacun orienté selon son implantation. Un éditeur vectoriel impose vingt fichiers et vingt retouches.
4. **Le registre de sécurité est verrouillé.** Aucune charte ne peut altérer un pictogramme normalisé. Un éditeur vectoriel n'a aucune notion de ce cloisonnement.
5. **Les zones cliquables sont dérivées.** Un changement d'occupant ne demande aucun redécoupage.
6. **Les contrôles sont permanents.** Contraste, lexique, adjacence chromatique, atteignabilité, vérifiés à chaque modification et non à la relecture finale.
Ces six points sont opposables commercialement. « Nous faisons tout ce que fait un éditeur vectoriel » ne l'est pas, et serait faux.
---
## E1. Les trois contextes d'édition
### E1.1 Contexte 1, géométrie et habillage du site
Édition libre et complète. C'est ici que l'outillage vectoriel doit être meilleur que celui d'un généraliste, parce qu'il connaît le métier.
Objets concernés : empreintes, volumes, ouvertures, nœuds, arêtes, liaisons, formes d'habillage, annotations, actifs importés, composition de page.
### E1.2 Contexte 2, gabarits
Édition visuelle autorisée, mais elle produit une donnée de gabarit conforme à la section D8, jamais un dessin.
Règle : **on dessine le modèle, jamais l'instance**. Modifier un gabarit se répercute sur toutes les faces qui l'utilisent. L'écran d'édition de gabarit affiche donc en permanence le nombre de faces impactées.
### E1.3 Contexte 3, faces de supports
Aucune édition libre. Le contenu est résolu depuis le graphe et l'annuaire. Le concepteur voit, contrôle et valide. Il ne déplace pas.
Trois libertés seulement : choisir le gabarit, saisir le contenu des blocs explicitement typés `free`, et déclarer une dérogation de format, laquelle bascule `dimensions_source` en `overridden` et déclenche un contrôle bloquant si le format devient non conforme.
### E1.4 Tableau de partage
| Opération | Contexte 1 | Contexte 2 | Contexte 3 |
| --- | --- | --- | --- |
| Dessiner une forme | oui | non | non |
| Déplacer un objet | oui | blocs du gabarit | non |
| Redimensionner | oui | zones du gabarit | non |
| Saisir du texte libre | oui | non | blocs `free` seulement |
| Choisir une couleur | rôles de charte | rôles de charte | non |
| Ajouter une image | oui | non | non |
| Modifier le contenu résolu | sans objet | non | non |
Toute demande d'assouplissement de la colonne « contexte 3 » relève de la procédure d'arrêt et de demande. Elle n'est jamais tranchée dans une tâche.
---
## E2. Corrections d'affirmations erronées
Consignées ici parce qu'elles ont déjà été formulées et qu'elles se reformuleront.
**E2.1.** Il a été affirmé que le cahier des charges interdit les dépendances à une plateforme d'hébergement mais pas les bibliothèques ouvertes, et qu'une bibliothèque de dessin, de diagramme ou de gestion d'état globale serait donc recevable.
C'est faux. La section A3.3 interdit explicitement toute bibliothèque de dessin ou de diagramme, toute bibliothèque de gestion d'état globale, toute bibliothèque de composants d'interface prête à l'emploi, et toute bibliothèque de calcul géométrique tant que le besoin n'est pas démontré par un test. La section A3.4 traite d'un sujet différent, la réversibilité d'hébergement.
**E2.2.** Le motif de cette interdiction n'est pas idéologique. Une bibliothèque de dessin tierce apporte son propre modèle de scène, son propre ordonnancement et ses propres arrondis. Elle rend l'invariant 4 sur le déterminisme invérifiable, parce que son comportement change entre deux versions mineures.
**E2.3.** La gestion d'état de l'application d'édition est écrite dans le dépôt, avec le motif de commande de la section E5. Elle n'est pas déléguée à une bibliothèque.
**E2.4.** Une bibliothèque de gestes de pointage peut être proposée, mais elle passe par la procédure d'arrêt et de demande, et ne touche jamais au calcul de coordonnées métier.
**E2.5.** Ce type de reformulation d'une règle gênante dans un sens permissif est précisément ce que la procédure d'arrêt et de demande sert à empêcher. Une règle qui gêne se signale, elle ne se réinterprète pas.
---
## E3. Modèle de vue
### E3.1 Deux repères, une seule transformation
Le repère métier est défini en D1.1 : mètres, X vers l'est, Y vers le nord, axe vertical d'affichage inversé à la sérialisation seulement.
Le repère de vue est en pixels, origine en haut à gauche, axe vertical vers le bas.
Une transformation unique, exportée par un module dédié, convertit dans les deux sens. **Aucun composant d'interface ne calcule sa propre conversion.** C'est la règle la plus facile à enfreindre et la plus coûteuse à corriger plus tard.
### E3.2 État de vue
```
{ centerX_m, centerY_m, scale_px_per_m, rotationDeg }
```
`rotationDeg` sert exclusivement à l'aperçu d'un plan orienté selon la section D6. Il ne modifie jamais les données.
### E3.3 Contraintes
- Échelle bornée, de 0,05 à 500 pixels par mètre. Hors bornes, l'outil refuse au lieu de dégénérer.
- Le facteur de zoom par cran est une constante nommée, pas une valeur dispersée.
- Le déplacement de vue ne modifie aucune donnée et n'entre jamais dans l'historique d'annulation.
- La position de vue est mémorisée par niveau et par utilisateur, hors du modèle métier.
### E3.4 Technologie de rendu
Rendu en SVG dans le document, chaque objet étant un élément du document, ce qui donne la détection de clic et l'accessibilité sans code spécifique.
Bascule obligatoire vers un rendu en mode point au-delà d'un seuil d'objets visibles, déclaré en E15, avec conservation de la détection de clic par calcul géométrique. Le seuil est mesuré, pas supposé.
---
## E4. Déterminisme des opérations d'édition
Un glisser-déposer produit des coordonnées à décimales illimitées. Sans règle, l'invariant 4 tombe dès le premier déplacement à la souris.
### E4.1 Quantification
- Toute opération d'édition quantifie ses coordonnées **à la validation de l'opération**, jamais pendant le geste.
- Pas de quantification pendant le geste : elle rend le déplacement saccadé et fausse le retour visuel.
- Pas au moment du rendu : la donnée serait alors différente de ce qui est affiché.
- Pas de quantification implicite lors d'une lecture ultérieure.
### E4.2 Pas de quantification
Le pas est de 0,001 m, soit le millimètre, cohérent avec la précision de sérialisation de D1.4. Il est constant et n'est pas fonction du niveau de zoom, sans quoi une même opération donnerait deux résultats selon l'échelle d'affichage au moment du geste.
### E4.3 Angles
Toute rotation quantifie à 0,01 degré, dans la convention compas de D1.3, avec normalisation dans [0, 360[.
### E4.4 Test obligatoire
Rejouer une séquence enregistrée d'opérations d'édition sur un site de référence, deux fois, et vérifier l'égalité stricte de l'état final et des empreintes de rendu.
---
## E5. Modèle de commande, annulation et hors ligne
### E5.1 Commande
Toute modification de donnée passe par une commande, objet sérialisable comportant : un type, une cible, les valeurs avant et après, et un horodatage fourni par l'appelant, jamais lu par la commande elle-même, conformément à l'interdiction de lire l'horloge dans un moteur.
Une commande est réversible. Une commande non réversible est refusée en revue.
### E5.2 Pile d'annulation
- Portée : le site en cours d'édition, par utilisateur.
- Regroupement des commandes d'un même geste continu en une seule entrée annulable.
- Profondeur : 200 entrées, constante nommée.
- Le déplacement de vue, le changement de sélection et le changement de niveau actif n'y entrent pas.
### E5.3 Articulation avec le travail hors ligne
C'est le point le plus délicat de cette partie, et celui qui dépassera sa charge s'il est traité tard.
Le lot 4.4 pose une concurrence optimiste au niveau de l'objet. Combiner un historique local et une fusion par objet crée un cas ingérable si l'on n'y prend garde : annuler localement une opération déjà fusionnée avec la version distante.
Règles retenues :
1. La pile d'annulation est **vidée à la synchronisation**. Ce qui est synchronisé n'est plus annulable localement.
2. Revenir sur une modification déjà synchronisée se fait par une nouvelle commande inverse, tracée, et non par une annulation.
3. La journalisation des commandes hors ligne est conservée pour l'arbitrage des conflits, avec présentation des deux versions à l'utilisateur.
4. La validation de complétude du graphe est rejouée après chaque synchronisation et bloque la publication en cas d'échec.
### E5.4 Sauvegarde automatique
Sauvegarde locale à chaque commande validée, en stockage local du navigateur, distincte de la synchronisation serveur. Reprise proposée à la réouverture après incident, avec choix explicite de l'utilisateur entre l'état local et l'état serveur. Aucune fusion silencieuse.
---
## E6. Sélection et accessibilité
L'accessibilité d'un éditeur graphique se décide dans le modèle de sélection. Ajoutée après, elle n'existe jamais.
### E6.1 Modèle
- Sélection simple, multiple, additive, par rectangle de capture, par catégorie d'objets.
- La sélection est un état d'interface, jamais une donnée persistée.
- L'ordre de la sélection est stable et déterministe : ordre de tracé, départagé par identifiant.
### E6.2 Pilotage au clavier, obligatoire
Toute opération réalisable au pointeur l'est au clavier. Sans exception, y compris le dessin.
- Parcours des objets d'un calque par tabulation, dans l'ordre stable ci-dessus.
- Déplacement de l'objet sélectionné par touches directionnelles, pas de 0,01 m, pas augmenté avec la touche de modification.
- Saisie numérique directe des coordonnées, des dimensions et de l'angle de l'objet sélectionné. C'est aussi le moyen le plus précis pour tout le monde, pas seulement une mesure d'accessibilité.
- Création d'une forme par saisie de ses dimensions, sans geste de pointage.
### E6.3 Restitution
- Chaque objet expose un nom accessible construit depuis ses données métier, jamais depuis sa forme.
- Les changements de sélection et le résultat des opérations sont annoncés.
- L'indicateur de focus est visible et distinct de l'indicateur de sélection.
- Aucune information portée par la seule couleur, vérifié sur un rendu en niveaux de gris.
---
## E7. Outillage de géométrie, contexte 1
### E7.1 Outils de base
Sélection, sélection directe de sommet, main, zoom, rectangle, ellipse, polygone régulier, polyligne, courbe de Bézier, texte, cotation, mesure.
### E7.2 Outils métier, l'apport réel
Ces outils n'existent pas dans un éditeur généraliste et justifient l'effort :
- **Tracé de cellule** : polygone contraint aux angles droits par défaut, avec libération explicite.
- **Décalage parallèle** : générer une cloison d'épaisseur donnée à partir d'un axe.
- **Division de cellule** : scinder une empreinte en deux, en conservant les attributs et en attribuant un nouveau code.
- **Fusion de cellules** : opération inverse, avec arbitrage explicite des attributs conservés.
- **Tracé d'axe de circulation** : produit directement des nœuds et des arêtes, pas une simple ligne.
- **Placement de nœud typé** : le type est choisi avant le geste, pas après.
- **Duplication en série** : répartir n cellules identiques le long d'un axe, cas des galeries à trame régulière.
- **Report de niveau** : copier les circulations et les noyaux verticaux d'un niveau à l'autre, ce qui est le geste le plus fréquent sur un bâtiment à plusieurs étages.
### E7.3 Opérations d'ensemble
Alignement, répartition, groupement, verrouillage, calques, ordre de superposition, copier-coller y compris entre niveaux et entre sites de la même organisation.
Le copier-coller entre organisations est interdit et fait échouer l'opération avec un code dédié.
### E7.4 Opérations booléennes
Union, soustraction, intersection sur les empreintes. Le résultat est validé par les mêmes contrôles que la saisie : polygone simple, fermé, non auto-intersectant, surface au-dessus de la tolérance. Un résultat invalide annule l'opération au lieu de produire une géométrie dégénérée.
---
## E8. Magnétisme et contraintes
### E8.1 Cibles
Sommets, milieux de segments, intersections, centres, grille, guides, alignements sur objets voisins.
### E8.2 Règles
- Le magnétisme s'exprime en pixels écran, la tolérance est donc constante à l'affichage et non en unité métier.
- Tolérance par défaut de 8 pixels, constante nommée, réglable par l'utilisateur.
- Priorité déterministe entre cibles concurrentes : sommet, puis intersection, puis milieu, puis guide, puis grille. Départage final par identifiant de l'objet cible.
- Désactivation temporaire par touche de modification.
- Contraintes de tracé : orthogonal, angles multiples d'une valeur réglable, conservation des proportions.
Le magnétisme n'introduit aucun indéterminisme : à état de vue identique et geste identique, la cible retenue est identique.
---
## E9. Couche d'habillage
### E9.1 Le besoin
Les directories réels contiennent des éléments qui n'appartiennent à aucun modèle métier et sans lesquels le plan ne ressemble à rien : alignements d'arbres, jardins nommés, massifs, voies et voies ferrées hors périmètre, passerelles, bâtiments voisins, logos d'enseignes majeures, annotations reliées par un filet de rappel, bloc de titre, légende, rose des vents.
Le cahier des charges principal ne les prévoyait pas. Sans eux, le produit ne peut pas remplacer l'outil actuel.
### E9.2 Principe de séparation
La couche d'habillage est **strictement séparée** de la couche métier. Elle ne participe à aucun calcul : ni parcours, ni couverture, ni quantitatif, ni zone cliquable. Elle est purement graphique.
Un objet d'habillage ne peut jamais porter d'attribut métier. S'il en a besoin, c'est qu'il relève de la couche métier.
### E9.3 Ajouts au modèle de données
```sql
decoration_layer   (id, org_id, site_id, level_id, name, z_order int, visible boolean,
                    print_visible boolean, locked boolean)
decoration_shape   (id, org_id, layer_id, kind, geometry jsonb,
                    style_role, label, rotation_deg numeric)
                   kind in ('area','path','symbol','group')
annotation         (id, org_id, level_id, anchor jsonb, leader jsonb,
                    text jsonb, style_role)
                   text = { fr, en }
imported_asset     (id, org_id, site_id, kind, storage_path, sanitized boolean,
                    original_name, checksum, imported_at)
                   kind in ('logo','symbol','background')
layout_composition (id, org_id, site_id, level_id, target,
                    page_format, elements jsonb, updated_at)
                   target in ('print','kiosk','web')
```
`layout_composition` porte la mise en page : position du bloc de titre, de la légende, de la rose des vites, des marges. C'est ce qui reste composé à la main une fois, puis rarement retouché.
### E9.4 Légende
La légende n'est pas un objet dessiné. Elle est **générée** depuis les catégories réellement présentes sur le niveau, et sa position seule est composée. C'est ce qui garantit qu'elle ne peut pas devenir fausse, à la différence d'un fichier graphique classique.
Même règle pour la rose des vents, qui est orientée depuis les données et non dessinée.
### E9.5 Bibliothèque de symboles
Symboles d'habillage fournis et éditables : arbres, massifs, mobilier, véhicules, silhouettes. Ils sont des données, pas du code, et suivent les règles de la section D8 sur les gabarits.
Ils ne se confondent jamais avec les pictogrammes du registre de sécurité, qui restent en lecture seule.
---
## E10. Édition de gabarit, contexte 2
- L'écran d'édition manipule la grille, les zones, les liaisons de blocs et les rôles de style. Il ne manipule pas de contenu réel.
- Aperçu permanent avec des données d'exemple, dont un jeu volontairement long dans les deux langues actives, pour éprouver le débordement.
- Le nombre de faces impactées par la modification est affiché en permanence, avec accès à la liste.
- Sauvegarde d'un gabarit dont un bloc déborde de la grille refusée, avec le code prévu.
- Un rôle de style ne référence jamais une couleur directe, uniquement un rôle de charte.
Preuve exigée par D8.4 : ajouter un gabarit sans toucher au code. Si l'éditeur de gabarit demande une modification de code pour un gabarit nouveau, l'exigence n'est pas tenue.
---
## E11. Face de support, contexte 3
Écran de contrôle, pas d'édition.
**Autorisé :** choisir le gabarit, saisir le contenu des blocs `free`, choisir les langues affichées, déclarer une dérogation de format, demander une régénération, émettre une épreuve.
**Interdit, et refusé par l'interface autant que par le moteur :** déplacer un bloc, redimensionner un bloc, modifier une couleur, ajouter un objet graphique, modifier un contenu résolu, contourner un contrôle bloquant.
Un contrôle bloquant empêche l'émission d'une épreuve. Il ne peut être ni ignoré, ni marqué comme accepté. La seule issue est de corriger la donnée source ou le gabarit.
---
## E12. Typographie
Absent du cahier des charges principal, alors que c'est ce qui fait la lisibilité d'un panneau.
- Polices incorporées, jamais chargées depuis le réseau, y compris dans le paquet de borne.
- Mesure de texte déterministe, à partir des métriques de la police et non d'une mesure faite par le navigateur, qui varie selon le moteur de rendu et le système. C'est une condition de l'invariant 4.
- Attributs gérés : corps, graisse, interlettrage, approche de paire, interligne, casse, alignement.
- Césure désactivée par défaut sur les supports. Une destination coupée en fin de ligne est illisible de loin.
- Détection de débordement calculée, jamais visuelle, avec le code prévu.
- Le calcul de dimension se fait sur la variante linguistique la plus longue parmi les langues actives, conformément à D12.2.
- Les polices de la charte sont validées à l'import : présence des jeux de caractères latins nécessaires au français et à l'anglais, accents compris, et licence d'incorporation déclarée par l'organisation.
---
## E13. Couleur et gestion colorimétrique
- Les chartes s'expriment en références Pantone ou RAL, l'écran affiche en rouge vert bleu, la fabrication travaille en quadrichromie ou en teinte directe.
- Une couleur de charte porte sa référence d'origine, sa valeur d'affichage et son profil de sortie. La référence d'origine fait foi pour le fabricant.
- Aucune conversion automatique n'est présentée comme exacte. L'écran est un aperçu, et l'interface le dit.
- Profils de sortie par substrat, conformément au cahier des charges principal.
- Le calcul de contraste se fait sur les valeurs d'affichage, avec la formule de luminance relative, et le résultat est mesuré, jamais estimé.
- Les couleurs du registre de sécurité ne sont jamais converties ni approchées. Elles proviennent du paquet de règles et sont utilisées telles quelles.
---
## E14. Import d'actifs clients
Les chartes arrivent en fichiers d'éditeur vectoriel propriétaire, en encapsulé PostScript ou en SVG. C'est un besoin quotidien et un vecteur d'attaque.
### E14.1 Formats
SVG accepté. Les formats propriétaires et encapsulés sont convertis par un outil serveur isolé, jamais interprétés côté navigateur.
### E14.2 Assainissement obligatoire
Avant tout stockage :
- Suppression de tout script, de tout événement, de toute référence externe, de toute entité externe.
- Suppression des métadonnées, y compris les mentions d'outil et les informations d'auteur.
- Refus des fichiers dépassant une taille ou une complexité déclarées.
- Vectorisation conservée, aucune image en mode point acceptée dans un logo.
- Un actif non assaini n'est jamais rendu. Le champ `sanitized` fait foi.
### E14.3 Traitement
Recadrage sur le contenu, normalisation de l'échelle, contrôle de la largeur minimale imposée par la charte, contrôle du contraste sur les fonds autorisés.
---
## E15. Performance
Le plan initial supposait quelques centaines d'objets. Un site réel à plusieurs bâtiments et plusieurs niveaux en compte plusieurs milliers, habillage compris.
Budget, mesuré selon le protocole de D13 :
| Grandeur | Cible |
| --- | --- |
| Objets visibles en rendu par éléments du document | jusqu'à 3 000 |
| Bascule vers le rendu en mode point | au-delà de 3 000 |
| Rafraîchissement pendant un geste | 60 images par seconde |
| Latence de détection de clic | inférieure à 16 millisecondes |
| Ouverture d'un niveau de 2 000 objets | inférieure à 2 secondes |
| Application d'une commande et de son annulation | inférieure à 50 millisecondes |
Un dépassement fait échouer la chaîne d'intégration. Ces valeurs sont des cibles, à réviser après le premier site réel, avec traçabilité de la révision.
---
## E16. Raccourcis clavier
- Table de raccourcis unique, déclarée en donnée, jamais dispersée dans les composants.
- Détection automatisée des conflits, y compris avec les raccourcis réservés du navigateur et du système.
- Aucun raccourci à touche unique destructeur sans confirmation.
- Table exportable et affichable, personnalisable en incrément ultérieur.
- Compatibilité vérifiée avec les dispositions de clavier français et anglais, qui ne placent pas les mêmes caractères aux mêmes touches. C'est une source classique de raccourcis inatteignables.
---
## E17. Ajouts au catalogue des codes d'anomalie
À ajouter au catalogue de la section D2.2, dans le même commit que leur première utilisation.
| Code | Gravité | Sens |
| --- | --- | --- |
| `EDIT.CONTEXT_VIOLATION` | bloquant | Opération interdite dans ce contexte d'édition |
| `EDIT.BOOLEAN_RESULT_INVALID` | bloquant | Opération booléenne produisant une géométrie invalide |
| `EDIT.CROSS_ORG_PASTE_DENIED` | bloquant | Collage entre organisations refusé |
| `EDIT.UNDO_AFTER_SYNC` | avertissement | Annulation demandée sur une modification déjà synchronisée |
| `EDIT.TEMPLATE_BLOCK_OVERFLOW` | bloquant | Bloc débordant de la grille du gabarit |
| `ASSET.SANITIZATION_FAILED` | bloquant | Actif importé non assainissable |
| `ASSET.RASTER_IN_LOGO` | bloquant | Image en mode point dans un logo |
| `ASSET.FONT_MISSING_GLYPHS` | bloquant | Police sans les caractères requis |
| `TYPO.TEXT_OVERFLOW` | bloquant | Débordement de texte calculé |
| `COLOR.PROFILE_MISSING` | avertissement | Profil de sortie absent pour ce substrat |
---
## E18. Rattachement aux tâches existantes
Cette partie ne crée pas de feuille de route parallèle. Elle s'insère dans le découpage existant.
| Élément | Rattachement |
| --- | --- |
| Modèle de vue, transformation, sélection, accessibilité | T-1.2, étendue |
| Quantification et déterminisme des opérations | T-1.2, critère d'acceptation ajouté |
| Motif de commande et annulation | nouvelle tâche T-1.2b, préalable à T-1.4 |
| Outillage de géométrie de base | T-1.2, étendue |
| Outils métier de E7.2 | nouvelle tâche T-1.2c |
| Magnétisme et contraintes | nouvelle tâche T-1.2d |
| Tracé d'axe produisant nœuds et arêtes | T-1.4, étendue |
| Report de niveau | T-1.5, étendue |
| Couche d'habillage et composition | nouvelles tâches T-2.17 à T-2.19 |
| Import et assainissement d'actifs | nouvelle tâche T-2.20 |
| Éditeur de gabarit | T-2.2, étendue |
| Écran de contrôle de face | T-2.15, étendue |
| Typographie et mesure déterministe | T-2.4 et T-2.15, critères ajoutés |
| Gestion colorimétrique | T-2.12, étendue |
| Articulation annulation et hors ligne | L4.4, contrainte ajoutée |
| Budget de performance | D13, mesuré dès T-1.2 |
Conséquence de charge à assumer : l'incrément 1 s'allonge, parce que l'éditeur devient un vrai éditeur et non un formulaire de saisie. L'incrément 2 s'allonge également du fait de la couche d'habillage, qui n'était pas prévue. Ces allongements ne sont pas chiffrés ici, faute de décomposition en lots de travail.
---
## E19. Ce que cette partie ne couvre pas
1. **Le chiffrage.** L'allongement des incréments 1 et 2 est certain, son ampleur n'est pas estimée.
2. **Le seuil de bascule de rendu.** La valeur de 3 000 objets est une hypothèse à mesurer, pas un résultat.
3. **La saisie tactile et au stylet.** Non traitée. Elle change le modèle de sélection et de magnétisme, et devra faire l'objet d'une décision avant l'incrément 5.
4. **L'édition simultanée à plusieurs sur un même niveau.** Hors périmètre. Le hors ligne du lot 4.4 traite la synchronisation différée, pas la présence simultanée.
5. **Les métriques de police et la licence d'incorporation.** Les règles sont posées, la vérification effective de licence reste une responsabilité de l'organisation cliente.
6. **La conversion colorimétrique exacte.** Aucun rendu écran ne peut garantir une teinte directe. Le produit affiche un aperçu et l'annonce.
7. **La reprise des fichiers existants des clients.** Un client arrivant avec vingt ans de fichiers d'éditeur vectoriel ne les convertira pas en modèle Azimut. Aucune voie de reprise n'est prévue et il ne faut pas en promettre.
