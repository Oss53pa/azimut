# Complément au cahier des charges de développement
## Azimut, partie G. Résolution des points ouverts

Éditeur : Atlas Studio

Cette partie traite les points laissés ouverts en fin de partie E. Elle prend le même rang que la partie A dans l'ordre de préséance.

---

## G0. Méthode, et ce qu'un document peut faire

Les points ouverts ne sont pas de même nature, et les traiter uniformément produirait de fausses certitudes.

| Point | Nature | Ce que ce document apporte |
| --- | --- | --- |
| Chiffrage | Estimation | Une décomposition et une méthode de calibrage, pas des durées |
| Seuil de bascule de rendu | Mesure | Un mécanisme adaptatif qui rend le seuil fixe inutile |
| Saisie tactile et stylet | Spécification | Une spécification complète |
| Édition simultanée | Décision de périmètre | Une décision, une solution intermédiaire spécifiée |
| Polices et licences | Technique + juridique | La partie technique est spécifiée, la partie juridique reste ouverte |
| Colorimétrie | Technique + juridique | La chaîne est spécifiée, une contrainte de licence est révélée |
| Reprise des fichiers clients | Décision commerciale | Une position, et une non-promesse assumée |

Écrire davantage ne transforme pas une mesure manquante en résultat. Les sections qui suivent le disent à chaque fois que c'est le cas.

---

## G1. Décomposition et chiffrage

### G1.1 Pourquoi aucune durée n'est écrite ici

Les fourchettes données jusqu'ici sont des ordres de grandeur non décomposés. Les transformer en engagement demanderait une vélocité mesurée, qui n'existe pas puisque rien n'a été construit. Produire des jours-hommes maintenant reviendrait à inventer un chiffre auquel quelqu'un se fierait.

Ce que ce document apporte à la place : une décomposition en lots, une taille relative par lot, et un protocole de calibrage qui produit les durées après deux lots réels.

### G1.2 Échelle de taille relative

Quatre tailles seulement. Une échelle plus fine donnerait une fausse précision.

| Taille | Sens |
| --- | --- |
| S | Contenu et contours clairs, peu d'inconnues |
| M | Contours clairs, quelques inconnues techniques |
| L | Plusieurs inconnues, ou forte interaction avec l'existant |
| XL | Comporte une inconnue majeure. À découper avant d'être engagé |

Règle : aucun lot XL n'entre en développement. Il est d'abord découpé, ou précédé d'un travail exploratoire borné dans le temps dont le livrable est une note, pas du code.

### G1.3 Décomposition, incrément 0

| Lot | Taille | Inconnue principale |
| --- | --- | --- |
| Squelette, chaîne d'intégration, migrations | S | aucune |
| Schéma site et géométrie | M | contraintes géométriques en base |
| Authentification et rôles | S | aucune |
| Cloisonnement par ligne et tests d'étanchéité | L | canaux indirects de fuite |
| Jetons, composants, icônes, dictionnaires | L | ampleur de la bibliothèque |
| Chargeur de paquets de règles | M | aucune |
| Décision et preuve sur la génération PDF | L | déterminisme à l'octet non acquis |
| Trousse de test et sites de référence | M | volume de données à construire |
| Service de compilation | M | reprise sans effet de bord |
| Vérification d'auto-hébergement | M | dépendances non réimplantables |

### G1.4 Décomposition, incrément 1

| Lot | Taille | Inconnue principale |
| --- | --- | --- |
| Import et calage de plan | M | qualité réelle des plans reçus |
| Modèle de vue, transformation, sélection | L | pilotage clavier complet |
| Motif de commande et annulation | L | articulation future avec le hors ligne |
| Outillage de géométrie de base | L | ampleur de l'outillage attendu |
| Outils métier de tracé | L | division et fusion de cellules |
| Magnétisme et contraintes | M | déterminisme du choix de cible |
| Saisie du graphe et liaisons | M | aucune |
| Validation de complétude | M | exhaustivité des cas |
| Destinations et bibliothèques sectorielles | M | volume des bibliothèques |
| Profils et moteur de parcours | M | invalidation de cache |
| Points de décision et audits | L | justesse métier à confronter au terrain |
| Reprise de carnet existant | L | hétérogénéité des fichiers reçus |
| Rapport de rapprochement | M | aucune |
| Écran de conception assemblé | L | densité et utilisabilité réelles |

### G1.5 Décomposition, incrément 2

| Lot | Taille | Inconnue principale |
| --- | --- | --- |
| Typologies et gabarits déclaratifs | M | expressivité suffisante du format |
| Résolution de contenu | M | aucune |
| Calcul des dimensions | M | dépend du contenu des paquets de règles |
| Contrôles de composition | L | contraste et lisibilité à valider |
| Verrouillage du registre de sécurité | M | exhaustivité des voies de contournement |
| Projection isométrique et zones cliquables | L | cas des empreintes recoupées |
| Vue en plan simplifié | M | critère objectif de densité réduite |
| Plans muraux orientés | M | erreur de signe difficile à voir |
| Plans d'évacuation | M | dépend du corpus normatif |
| Chaîne tactile et braille | L | standard de transcription non tranché |
| Exécutions PDF et colorimétrie | L | déterminisme et profils |
| Quantitatif | S | aucune |
| Versions et bons à tirer | M | insertion seule au niveau base |
| Couche d'habillage et symboles | L | ampleur de la bibliothèque |
| Composition de page | M | aucune |
| Import et assainissement d'actifs | L | sécurité de l'assainissement |
| Éditeur de gabarit | L | preuve qu'un gabarit reste une donnée |
| Écran de contrôle de face | M | aucune |
| Compilation en lot | M | tenue du budget de temps |

### G1.6 Protocole de calibrage

1. Choisir deux lots de taille S et deux de taille M en début d'incrément 0.
2. Les réaliser en mesurant la durée réelle, sans estimation préalable communiquée, qui biaiserait la mesure.
3. Établir une durée moyenne par taille, avec sa dispersion.
4. Projeter le reste, en affichant une fourchette et non une valeur unique.
5. Réviser après chaque incrément. Une projection non révisée après six mois est périmée.

Règle de communication : toute durée sortie de ce protocole est présentée avec sa fourchette et la date de la mesure qui la fonde. Une durée citée seule est trompeuse.

### G1.7 Effet des parties E et F sur la charge

Constat qu'il faut assumer plutôt que dissoudre. Les parties E et F ajoutent aux incréments 1 et 2 : un éditeur vectoriel réel là où un formulaire de saisie était supposé, une couche d'habillage entièrement nouvelle, une bibliothèque de composants et un jeu d'icônes propres, un import d'actifs clients avec assainissement, une chaîne colorimétrique.

Sur les 33 lots des incréments 1 et 2, 8 n'existaient pas dans le cahier des charges principal et 6 y étaient sous-évalués. L'allongement est donc substantiel, et son ampleur sortira du calibrage, pas d'une estimation faite maintenant.

---

## G2. Budget de rendu et seuil adaptatif

### G2.1 Le problème du seuil fixe

La valeur de 3 000 objets était une hypothèse. Un seuil fixe est de toute façon faux : la performance dépend du matériel, du navigateur, de la complexité des polygones et du niveau de zoom, pas du seul nombre d'objets. Un seuil calibré sur le poste du développeur sera mauvais chez le client.

### G2.2 Mécanisme retenu

Le seuil est supprimé et remplacé par un budget mesuré à l'exécution.

1. Le rendu vise un budget de temps par image, constante nommée, valeur initiale 16 millisecondes.
2. Le temps de rendu est mesuré en continu, sur une moyenne glissante de 30 images.
3. Si la moyenne dépasse le budget pendant plus de 500 millisecondes, la vue bascule en mode de rendu allégé.
4. Si elle repasse durablement sous 60 % du budget, elle revient au mode complet, avec une hystérésis empêchant l'oscillation.
5. Le mode courant est indiqué dans la barre d'état, jamais silencieux.

### G2.3 Mode allégé

Rendu en mode point de la scène statique, éléments interactifs conservés en éléments du document. La détection de clic passe au calcul géométrique, avec index spatial.

Exigence : le mode allégé ne change ni la sélection possible, ni les opérations disponibles, ni les coordonnées produites. Il change la façon de dessiner, jamais le résultat. Un test compare l'état final après une même séquence d'opérations dans les deux modes et exige l'égalité stricte.

### G2.4 Ce qui reste à mesurer

La valeur initiale du budget et les paramètres d'hystérésis sont des points de départ, pas des résultats. Ils se mesurent selon le protocole de la partie D, sur le premier site réel modélisé, et la révision est tracée.

---

## G3. Saisie tactile et stylet

### G3.1 Principe

Trois types de pointeur, avec des capacités différentes assumées. Prétendre que tout est possible partout produit une interface mauvaise partout.

| Type | Capacités |
| --- | --- |
| Souris | Toutes |
| Stylet | Toutes |
| Doigt | Navigation, sélection, édition de propriétés. Pas de tracé libre |

Le tracé libre au doigt est exclu. La précision requise pour une empreinte de cellule ne s'obtient pas au doigt, et proposer une fonction imprécise vaut moins que ne pas la proposer.

### G3.2 Tolérances par type

La tolérance de sélection et de magnétisme dépend du pointeur, en pixels écran conformément à la partie E.

| Type | Tolérance de sélection | Tolérance de magnétisme |
| --- | --- | --- |
| Souris | 4 | 8 |
| Stylet | 3 | 6 |
| Doigt | 12 | 16 |

Ces valeurs sont des constantes nommées, réglables, et leur effet sur le déterminisme est nul : à état de vue et geste identiques, le résultat est identique pour un type de pointeur donné.

### G3.3 Gestes

- Un doigt sur le fond : déplacement de la vue.
- Un doigt sur un objet : sélection.
- Deux doigts : déplacement et zoom simultanés.
- Appui long : menu contextuel.
- Aucun geste à trois doigts ou plus, non découvrable et souvent capté par le système.

### G3.4 Stylet

- Traité comme un pointeur précis, avec les tolérances ci-dessus.
- La pression n'est pas utilisée. Elle n'a aucun sens dans un dessin technique et introduirait une variabilité contraire au déterminisme.
- L'inclinaison n'est pas utilisée.
- Rejet de la paume obligatoire dès qu'un stylet est détecté : tout contact tactile est ignoré tant que le stylet est actif.

### G3.5 Adaptation de l'interface

Quand un pointeur grossier est détecté, les cibles interactives passent à 44 pixels minimum et les outils de tracé libre sont désactivés avec indication du motif. L'adaptation suit le pointeur réellement employé, pas le type d'appareil déclaré : un ordinateur portable à écran tactile utilise les deux.

---

## G4. Présence simultanée

### G4.1 Décision de périmètre

L'édition simultanée en temps réel sur un même niveau est **exclue définitivement du produit**, et non reportée.

Motifs : la fusion en temps réel d'un graphe dont la cohérence topologique est une exigence bloquante est un problème d'un autre ordre de difficulté que la synchronisation différée. Elle exposerait à des états intermédiaires incohérents, et elle est sans rapport avec le besoin réel, où une à deux personnes modélisent un site.

Ce qui reste : la synchronisation différée du lot 4.4, inchangée.

### G4.2 Ce qui est spécifié à la place

Deux personnes peuvent ouvrir le même niveau. Le produit empêche le dégât, sans empêcher le travail.

**Présence.** Les utilisateurs ayant le niveau ouvert sont affichés en permanence dans la barre d'état, avec leur nom et l'heure de leur dernière modification.

**Verrouillage consultatif au niveau de l'objet.** Modifier un objet pose un verrou consultatif portant l'auteur et une expiration de 15 minutes, renouvelée tant que l'édition se poursuit. Un autre utilisateur voit l'objet marqué, peut le consulter, ne peut pas le modifier sans passer outre.

**Passage en force explicite.** Possible, avec confirmation nommant le détenteur du verrou, et journalisation. Un verrou expiré tombe de lui-même.

**Aucun verrou dur.** Un verrou qui bloquerait sans recours produirait des sites inaccessibles après une déconnexion. C'est le défaut classique de ce mécanisme, et il est évité par l'expiration.

### G4.3 Limite déclarée

Ce dispositif réduit le risque, il ne l'annule pas. Deux personnes travaillant simultanément sur des parties disjointes du même graphe peuvent produire une incohérence topologique. La validation de complétude rejouée à la synchronisation la détecte et bloque la publication. Elle la détecte, elle ne l'empêche pas.

---

## G5. Métriques de police et licences

### G5.1 Mesure déterministe du texte

C'est la partie technique, et elle se résout entièrement.

Interdiction de mesurer un texte par les fonctions de mesure du navigateur : le résultat varie selon le moteur de rendu, la version et le système, ce qui rend l'invariant 4 invérifiable et fait diverger les empreintes visuelles entre deux postes.

Mécanisme retenu :

1. À la construction, les métriques de chaque police sont extraites en table : unités par cadratin, hauteur de cadratin, hauteur d'x, jambages, chasse de chaque glyphe, paires d'approche.
2. La table est versionnée avec la police et porte une empreinte.
3. Le moteur de composition mesure exclusivement depuis cette table.
4. Un changement de version de police change l'empreinte et invalide les rendus concernés, qui sont recompilés.
5. Un test compare la mesure calculée à un rendu de référence et détecte toute dérive.

### G5.2 Registre des polices

```sql
font_asset      (id, org_id, family, style, weight, storage_path,
                 metrics_path, metrics_hash, embeddable boolean,
                 licence_kind, licence_ref, declared_by, declared_at,
                 latin_coverage_ok boolean)
                licence_kind in ('open','purchased','client_supplied','unknown')
```

Règles :

- Une police de `licence_kind = 'unknown'` ne peut pas être incorporée dans un livrable distribué. Elle reste utilisable en aperçu écran.
- L'incorporation dans un paquet de borne exige `embeddable = true` et une référence de licence renseignée.
- La couverture latine requise pour le français et l'anglais, accents compris, est vérifiée automatiquement à l'import.
- Un livrable produit avec une police non incorporable lève une anomalie bloquante.

### G5.3 Ce qui reste ouvert

La vérification juridique des termes de licence n'est pas automatisable. Le produit enregistre une déclaration et son auteur, il ne l'atteste pas. La responsabilité reste à l'organisation qui déclare, et la clause contractuelle standard le dit.

---

## G6. Chaîne colorimétrique

### G6.1 Modèle

Une couleur de charte n'est pas une valeur, c'est un faisceau de représentations.

```sql
charter_color   (id, org_id, charter_id, key, usage,
                 reference_system, reference_code,
                 lab_l numeric, lab_a numeric, lab_b numeric,
                 display_hex, source_of_truth,
                 declared_by, declared_at)
                reference_system in ('pantone','ral','ncs','cmyk','rgb','none')
                source_of_truth in ('reference','lab','display')

color_output_profile (id, org_id, substrate_key, profile_path, profile_name)
```

**La référence fait foi.** C'est elle qui part chez le fabricant. Les valeurs d'affichage et de sortie en sont des approximations, et l'interface les présente comme telles.

### G6.2 Règles

- Aucune conversion n'est jamais présentée comme exacte. Tout aperçu écran porte une mention d'approximation, y compris dans les exports d'aperçu.
- Le calcul de contraste utilise les valeurs d'affichage, avec la formule de luminance relative. C'est une mesure d'accessibilité, pas une mesure colorimétrique.
- L'écart colorimétrique entre deux couleurs n'est calculé que si les deux disposent de valeurs mesurées. Sinon, l'interface indique que l'écart n'est pas calculable, au lieu d'afficher un chiffre faux.
- Un profil de sortie est requis par substrat avant production. Son absence lève une anomalie.
- Les couleurs du registre de sécurité ne sont ni converties, ni approchées, ni contrôlées en contraste par rapport à la charte. Elles proviennent du paquet de règles et sont employées telles quelles.
- Une épreuve physique reste nécessaire avant fabrication. Le produit ne remplace pas l'épreuve contractuelle et l'écrit dans ses livrables.

### G6.3 Contrainte de licence révélée

Point non identifié jusqu'ici, et qui a des conséquences directes sur le développement.

Les données colorimétriques des principaux systèmes de teintes directes du commerce sont propriétaires. Les tables de correspondance entre un code de nuancier et ses valeurs mesurées ne peuvent pas être incorporées dans un logiciel sans licence de l'éditeur du nuancier.

Conséquence : le produit **stocke une référence saisie par le client**, sous forme de texte, et ne fournit aucune table de conversion. Si le client fournit lui-même les valeurs mesurées de sa charte, elles sont enregistrées et utilisées. Sinon, la référence reste une chaîne transmise au fabricant, et l'aperçu écran repose sur la valeur d'affichage déclarée par le client.

C'est une limite assumée, et c'est aussi la position juridiquement sûre. Elle doit figurer dans la documentation commerciale, faute de quoi un client s'attendra à une conversion que le produit ne fera jamais.

---

## G7. Reprise des fichiers existants des clients

Septième point ouvert de la partie E, traité ici pour ne pas le laisser en suspens.

### G7.1 Position

Un client arrivant avec des années de fichiers d'éditeur vectoriel ne les convertira pas en modèle Azimut. La conversion automatique d'un dessin en modèle structuré n'est pas un problème d'import, c'est un problème d'interprétation : un dessin ne contient ni graphe, ni catégories, ni statuts d'occupation.

### G7.2 Ce qui est proposé

Une seule voie, honnête et utile : **l'import comme référence de fond**. Le fichier est converti en image calée, sur laquelle le concepteur redessine. Il est archivé et consultable, il n'alimente aucun calcul.

En complément, la reprise de carnet existant par tableur, déjà spécifiée, couvre la partie qui compte réellement, à savoir l'inventaire des supports.

### G7.3 Non-promesse

Ne jamais annoncer une reprise automatique de fichiers graphiques. C'est la promesse la plus facile à faire en avant-vente et la plus certaine de décevoir. La documentation commerciale dit ce que fait le produit : il reprend un inventaire, pas un dessin.

---

## G8. Ajouts au catalogue des codes d'anomalie

| Code | Gravité | Sens |
| --- | --- | --- |
| `EDIT.OBJECT_LOCKED` | avertissement | Objet verrouillé par un autre utilisateur |
| `EDIT.LOCK_OVERRIDDEN` | information | Verrou forcé, journalisé |
| `EDIT.TOUCH_TOOL_UNAVAILABLE` | information | Outil de tracé indisponible au doigt |
| `RENDER.BUDGET_EXCEEDED` | information | Bascule en mode de rendu allégé |
| `FONT.NOT_EMBEDDABLE` | bloquant | Police non incorporable dans un livrable distribué |
| `FONT.METRICS_MISSING` | bloquant | Table de métriques absente ou altérée |
| `FONT.LICENCE_UNKNOWN` | avertissement | Licence non déclarée |
| `COLOR.DELTA_NOT_COMPUTABLE` | information | Écart non calculable, valeurs mesurées absentes |
| `COLOR.REFERENCE_UNVERIFIABLE` | information | Référence de nuancier sans valeurs fournies |
| `IMPORT.VECTOR_AS_REFERENCE_ONLY` | information | Fichier importé en référence de fond, sans exploitation |

---

## G9. Rattachement aux tâches

| Élément | Rattachement |
| --- | --- |
| Décomposition et calibrage | démarrage de l'incrément 0, avant tout engagement |
| Budget de rendu adaptatif | T-1.2, remplace le seuil fixe |
| Saisie tactile et stylet | T-1.2, tolérances par type de pointeur |
| Présence et verrouillage consultatif | nouvelle tâche T-1.16 |
| Extraction des métriques de police | nouvelle tâche T-0.16, préalable à T-2.4 |
| Registre des polices et licences | T-0.16 |
| Modèle de couleur de charte | T-2.12, étendue |
| Profils de sortie par substrat | T-2.12 |
| Import en référence de fond | T-1.1, étendue |

---

## G10. Ce qui reste non résolu

Court, et c'est voulu.

1. **Les durées.** Ce document donne une décomposition et une méthode. Les durées sortiront du calibrage, après deux lots réels. Aucune valeur n'est écrite ici et aucune ne doit être citée avant cette mesure.
2. **La vérification juridique des licences de polices.** Automatisable pour la déclaration, pas pour la vérification. Reste à l'organisation cliente, avec clause contractuelle.
3. **La licence des données de nuanciers.** La position retenue est de ne fournir aucune table de conversion. Si une licence était acquise un jour, le modèle de données la supporte déjà, mais rien ne doit être promis d'ici là.
4. **Les valeurs initiales du budget de rendu et des tolérances de pointeur.** Points de départ, à mesurer sur le premier site réel.
5. **L'ergonomie tactile réelle.** Spécifiée, non éprouvée. Les essais d'utilisabilité peuvent remettre en cause l'exclusion du tracé libre au doigt, dans un sens comme dans l'autre.
