# Complément au cahier des charges de développement
## Azimut, partie F. Interface, design système et front

Éditeur : Atlas Studio

Cette partie complète le cahier des charges principal et les parties D et E. Elle prend le même rang que la partie A dans l'ordre de préséance.

---

## F0. Objet et ce qui est déjà décidé

Ce document définit l'interface : jetons, mise en page, composants, états, écriture, mouvement, structure du code front.

Décisions antérieures, non rediscutées ici et rappelées pour mémoire : palette Papier en thème par défaut, thème sombre Instrument en incrément 4, quatre couleurs réservées à usage sémantique exclusif, accent réservé aux valeurs produites par un moteur, zone de travail toujours en fond clair quel que soit le thème.

---

## F1. Le brief

### F1.1 En une phrase

Un outil professionnel de conception, utilisé plusieurs heures par jour par un opérateur expert, qui produit des documents destinés à être fabriqués, et qui affiche en permanence des couleurs, des typographies et des pictogrammes appartenant à ses clients.

### F1.2 Les cinq principes

**1. Silence chromatique.** L'interface ne doit rien ajouter à ce qu'elle montre. Toute couleur qu'elle emploie pour elle-même entre en concurrence avec le contenu qu'elle sert à juger. C'est la contrainte fondatrice et elle est propre à ce produit.

**2. Une seule audace, la zone de travail.** Le plan est le sujet. Tout le reste est discipliné, plat, calme. Aucun ornement autour du canevas.

**3. La structure porte de l'information.** Un filet, un cadre, une pastille colorée signifient quelque chose. Rien n'est décoratif. Une couleur réservée qui apparaîtrait par agrément détruit la valeur d'alerte des trois autres.

**4. Densité assumée.** Le public est expert et travaille sur de grandes surfaces d'affichage. L'espacement généreux d'un site vitrine est ici un défaut : il oblige à faire défiler, donc à perdre le contexte.

**5. L'accent ne dit qu'une chose.** Ce que le logiciel a calculé. Ce que l'utilisateur a saisi reste neutre. Le concepteur distingue ainsi d'un coup d'œil ce qu'il a décidé de ce qui lui est proposé.

### F1.3 Ce que l'interface ne fait pas

- Elle n'emploie jamais la charte d'un client, même du client à qui l'on montre l'écran. Le brand book d'un site est du contenu, jamais de l'habillage d'interface.
- Elle n'utilise pas d'aplats colorés larges, qui fausseraient la perception des couleurs voisines.
- Elle n'emploie ni ombre portée, ni dégradé, ni carte arrondie répétée. Ces dispositifs ajoutent du bruit visuel autour d'un contenu dont les valeurs comptent.
- Elle n'anime rien qui ne réponde pas à une action.

---

## F2. Jetons de couleur

### F2.1 Thème Papier, par défaut

```
surface-page        #FBFAF8
surface-panel       #FFFFFF
surface-canvas      #F7F5F1
surface-sunken      #F2EEE8
border-hairline     #E3DFD8
border-strong       #CFC8BC
border-interactive  #8E867C
text-primary        #1C1F24
text-secondary      #5A606B
text-muted          #656B75
accent              #17457A
accent-soft         #EDF2F8
accent-secondary    #26695C
```

`surface-canvas` est plus sombre que `surface-panel`. C'est la correction issue de la maquette : la hiérarchie se rétablit en descendant la zone de travail d'un demi-ton, jamais en blanchissant les panneaux, sous peine d'éclaircir le fond sur lequel les supports sont jugés.

### F2.2 Couleurs réservées

```
state-blocking      #B32F26
state-warning       #96560A
state-valid         #2A7047
state-info          #2B6CB0
```

Usage sémantique exclusif. Interdiction d'emploi décoratif, sans exception. Un test d'analyse statique cherche ces valeurs hors des composants d'état.

### F2.3 Contrastes mesurés

Les valeurs ci-dessus ne sont plus estimées. Elles sont calculées, sur les cinq fonds susceptibles de porter du texte, le plus sombre étant `surface-sunken`.

| Jeton | Ratio minimal sur fond | Blanc posé dessus |
| --- | --- | --- |
| `text-primary` | 14,30 | 16,52 |
| `text-secondary` | 5,47 | 6,32 |
| `text-muted` | 4,64 | 5,37 |
| `accent` | 8,38 | 9,68 |
| `accent-secondary` | 5,58 | 6,45 |
| `state-blocking` | 5,42 | 6,27 |
| `state-warning` | 5,00 | 5,78 |
| `state-valid` | 5,18 | 5,99 |
| `state-info` | 4,69 | 5,42 |

Tous les couples passent le seuil AA de 4,5.

Cinq valeurs proposées initialement échouaient et ont été corrigées : le gris estompé descendait à 2,25, l'ambre à 2,85, et le blanc posé sur l'ambre à 3,30. Conformément à la règle posée, ce sont les jetons qui ont changé, jamais le seuil.

### F2.4 Filets et seuil de 3,0

Le seuil de 3,0 applicable aux limites de composants ne concerne que les bordures nécessaires à identifier un élément interactif, non les séparateurs décoratifs.

- `border-hairline` et `border-strong` sont des séparateurs de structure. Ils sont exemptés, et leur ratio mesuré est compris entre 1,2 et 1,7.
- `border-interactive`, jeton ajouté à cette révision, est la bordure des champs, des boutons et de l'indicateur de focus. Son ratio mesuré est de 3,11 sur le fond le plus clair, donc conforme.

Employer un filet décoratif comme bordure de champ est une non-conformité. Le test d'analyse statique le vérifie.

### F2.5 Règles

- Aucune couleur écrite hors du paquet de jetons. Règle déjà posée, rappelée parce que c'est celle qui se contourne le plus facilement.
- Chaque jeton porte un rôle, jamais un nom de couleur. `accent`, pas `bleu`.
- Le thème sombre exigera un second jeu complet de couleurs réservées, les valeurs claires étant illisibles sur fond sombre. Ce n'est pas un échange de neutres.
- Les couleurs de contenu, celles des chartes clients et du registre de sécurité, ne passent jamais par les jetons. Elles viennent des données et ne sont ni converties, ni approchées.

---

## F3. Typographie de l'interface

### F3.1 Choix

Famille unique et sa variante à chasse fixe : IBM Plex Sans pour tout le texte, IBM Plex Mono pour les seules données numériques tabulaires.

### F3.2 Motifs du choix

Ce ne sont pas des motifs esthétiques.

1. **Chiffres tabulaires.** L'interface affiche en permanence des cotes, des azimuts, des coordonnées, des hauteurs de caractère. Sans chiffres à chasse constante, les colonnes de valeurs dansent à chaque saisie.
2. **Licence permettant l'incorporation.** Les polices sont incorporées dans le paquet de borne, qui fonctionne sans réseau. Une police sous licence restrictive rendrait le paquet non conforme.
3. **Superfamille cohérente.** La variante à chasse fixe partage les proportions et la hauteur d'x de la variante proportionnelle, ce qui évite la rupture visuelle habituelle des associations improvisées.
4. **Couverture latine complète** pour le français et l'anglais, accents et signes compris.
5. **Registre technique** proche des documents d'architecte que l'outil manipule.

Les licences ne sont plus un point ouvert de cette partie. Le mécanisme de mesure déterministe depuis les métriques extraites, le registre des polices et les règles d'incorporation sont spécifiés en partie G. Rappel de la règle qui gouverne l'interface : une police dont la licence n'est pas déclarée reste utilisable en aperçu écran et ne peut jamais être incorporée dans un livrable distribué.

### F3.3 Emploi de la chasse fixe

Restreint aux champs de valeurs numériques alignées en colonne. Interdit pour les libellés, les intitulés et le texte courant : une police à chasse fixe employée comme signal de sérieux est un maniérisme, pas une décision.

### F3.4 Échelle

Base à 13 pixels, adaptée à un outil dense. Progression suivant un intervalle constant.

| Rôle | Taille | Graisse | Interligne |
| --- | --- | --- | --- |
| Micro-libellé | 11 | 400 | 1,4 |
| Libellé de champ | 12 | 400 | 1,4 |
| Texte courant | 13 | 400 | 1,5 |
| Valeur mise en avant | 13 | 500 | 1,4 |
| Titre de panneau | 15 | 500 | 1,3 |
| Titre d'écran | 18 | 500 | 1,25 |
| Titre de document | 22 | 500 | 1,2 |

Deux graisses seulement, 400 et 500. Au-delà, la hiérarchie se fait par la position et l'espace, pas par la graisse.

### F3.5 Interdits

- Aucune capitale intégrale pour les libellés. Elle réduit la lisibilité et allonge le texte, ce qui pénalise le français, plus long que l'anglais.
- Aucun intitulé de rappel placé au-dessus d'un titre.
- Aucune mise en valeur d'un mot isolé dans un titre par la couleur ou l'italique.
- Longueur de ligne inférieure à 80 caractères pour tout texte courant.

---

## F4. Espacement, filets, rayons

### F4.1 Échelle d'espacement

Base 4 pixels. Valeurs autorisées : 2, 4, 6, 8, 12, 16, 20, 24, 32, 48. Aucune valeur hors échelle.

### F4.2 Filets

Épaisseur unique de 1 pixel, couleur `border-hairline`. `border-strong` réservé à la séparation entre la zone de travail et les panneaux.

Aucune ombre portée dans l'application de conception. Une élévation minimale est admise pour les seuls éléments flottants : menu contextuel, infobulle, boîte de dialogue.

### F4.3 Rayons

- 0 pixel : panneaux, barres, séparateurs, lignes de tableau.
- 4 pixels : champs, boutons, pastilles.
- 6 pixels : éléments flottants.

Le rayon encode la nature de l'élément. Un rayon unique appliqué partout dissout cette information.

---

## F5. Mise en page

### F5.1 Écran de conception

```
+------------------------------------------------------------------+
| barre de site : marque, site, niveau, actions, publier            |
+--------+-----+-------------------------------------+-------------+
| arbo   | out |                                     | propriétés  |
| site   | ils |          zone de travail             |             |
| 200px  | 44  |          (occupe le reste)          | 280px       |
|        |     |                                     |             |
|        |     |                                     +-------------+
|        |     |                                     | contrôles   |
+--------+-----+-------------------------------------+-------------+
| barre d'état : échelle, coordonnées, profil actif, synchro        |
+------------------------------------------------------------------+
```

Règles : les panneaux latéraux sont redimensionnables et repliables, leur largeur est mémorisée par utilisateur. La zone de travail ne descend jamais sous 60 % de la largeur disponible. La barre d'outils verticale reste toujours visible, y compris panneaux repliés.

### F5.2 Barre d'état

Elle porte ce qu'un opérateur doit voir en permanence sans le chercher : échelle courante, coordonnées du pointeur en repère métier, profil de parcours actif, état de synchronisation, nombre d'anomalies bloquantes.

Les coordonnées sont en chasse fixe, avec unité affichée, conformément à la convention de la partie D.

### F5.3 Écran de contrôle de face

```
+------------------------------------------------------------------+
| barre : support, typologie, version, état                         |
+--------------------------------+---------------------------------+
|                                | gabarit                         |
|      aperçu de la face         | contenu résolu (lecture)        |
|      sur fond clair            | blocs libres (saisie)           |
|      toujours                  | dimensions calculées            |
|                                | contrôles                       |
|                                | actions de version              |
+--------------------------------+---------------------------------+
```

L'aperçu occupe la moitié gauche et reste sur fond clair quel que soit le thème. Aucune poignée de manipulation n'est affichée : cet écran ne permet pas l'édition, conformément à la partie E.

### F5.4 Rapport d'audit

Mise en page en document, non en tableau de bord. Colonne de lecture, largeur limitée, sections ordonnées par gravité décroissante. Chaque anomalie porte un lien vers l'entité concernée dans la zone de travail.

---

## F5bis. Inventaire des écrans par module

La première version de cette partie ne détaillait que l'écran de conception, ce qui laissait croire à une application à écran unique. L'inventaire ci-dessous couvre les onze modules de la partie H.

| Module | Écrans |
| --- | --- |
| Socle du site | Liste des sites, fiche de site, import et calage de plan, tracé des empreintes, saisie du graphe, annuaire, habillage et composition |
| Wayfinding | Zonage et nomenclature, hiérarchie de l'information, plan de jalonnement, tableau des messages, principes déclarés |
| Parcours clients | Profils, comparaison de scénarios, carte d'exposition, rapport de flux |
| Signalétique | Implantation, composition de face, contrôle de face, plans muraux, plans d'évacuation, bons à tirer |
| Régie publicitaire | Inventaire des emplacements, planning d'occupation, contrats, réception des visuels, rendu en situation, espace annonceur |
| Enseignes locataires | Règlement, dossiers déposés, instruction, constat de conformité |
| Chantier et pose | Allotissement, ordres de fabrication, planning de pose, procès-verbaux, réserves |
| Exploitation | Tournées, incidents, ordres de travaux, état du parc |
| Budget | Coûts de référence, estimation, suivi budgétaire |
| Portefeuille | Vue multi-sites, comparaison, bibliothèques partagées |
| Transverse | Recherche globale, documents, notifications, journal d'activité, tableau de bord par rôle |

### F5bis.1 Trois familles de mise en page

Onze modules ne demandent pas onze mises en page. Trois familles suffisent, et toute nouvelle vue s'y rattache.

**Famille atelier.** Zone de travail dominante, panneaux latéraux, barre d'outils, barre d'état. Structure décrite en F5.1. Concerne le tracé, le graphe, l'implantation, l'habillage, la carte d'exposition, l'inventaire publicitaire.

**Famille registre.** Tableau dense en pleine largeur, filtres persistants, panneau de détail latéral, actions groupées. Concerne le tableau des messages, l'annuaire, les contrats, les dossiers d'enseignes, les ordres de travaux, les coûts.

**Famille document.** Colonne de lecture de largeur limitée, sections ordonnées, exportable. Concerne les rapports d'audit, les rapports de flux, les fiches techniques, les procès-verbaux.

Règle : aucune quatrième famille sans passage par la procédure d'arrêt et de demande.

### F5bis.2 Navigation

Sélecteur de site permanent, puis navigation par module. Le module actif est toujours visible. Le passage d'un module à l'autre conserve le site et le niveau courants, sans quoi l'utilisateur perd son contexte à chaque changement.

Les modules non souscrits par l'organisation ne sont pas affichés en grisé mais absents. Un module grisé est une publicité, pas une interface.

### F5bis.3 Écran du tableau des messages

Écran de famille registre, et livrable central du wayfinding. Il mérite une spécification propre.

Colonnes : support, face, bloc, contenu en français, contenu en anglais, pictogramme, direction, niveau d'information, point de décision justifiant la ligne, état de péremption.

Exigences : édition en série sur sélection multiple, comparaison entre deux versions, marquage visible des lignes périmées, export en tableur et en document, circuit de validation identique à celui des bons à tirer.

C'est l'écran que la maîtrise d'ouvrage regardera le plus longtemps. Sa densité et sa lisibilité priment sur son élégance.

---

## F6. Bibliothèque de composants

Liste fermée. Tout composant nouveau relève de la procédure d'arrêt et de demande.

**Saisie** : champ texte, champ numérique avec unité, champ d'angle, sélecteur, sélecteur de rôle de charte, interrupteur, case à cocher, groupe de choix exclusif, champ de recherche.

**Structure** : panneau, section repliable, arborescence, tableau de données, onglets, séparateur, barre d'outils, barre d'état.

**Retour** : pastille d'état, ligne d'anomalie, bandeau, infobulle, indicateur de progression, indicateur de synchronisation.

**Action** : bouton principal, bouton secondaire, bouton discret, bouton d'icône, menu, menu contextuel.

**Superposition** : boîte de dialogue, panneau latéral temporaire, sélecteur de fichier.

**Zone de travail** : vue, cadre de sélection, poignées de transformation, guides, règles, minicarte.

### F6.1 Règles communes

- Chaque composant expose ses états : repos, survol, focus, actif, désactivé, en erreur, en chargement.
- L'indicateur de focus est visible et distinct de l'indicateur de sélection. Confondre les deux rend l'application inutilisable au clavier.
- Un champ numérique affiche toujours son unité. Un champ dimensionnel sans unité affichée est refusé en revue.
- Aucun composant n'est construit à partir d'une bibliothèque tierce, conformément à la règle du cahier des charges principal.

---

## F7. États obligatoires d'un écran

Tout écran affichant des données traite les six états suivants. Un écran qui n'en traite que le cas nominal est incomplet et refusé en revue.

| État | Traitement |
| --- | --- |
| Vide | Invitation à agir, avec l'action en évidence. Jamais un simple constat d'absence. |
| Chargement | Structure d'attente calquée sur la forme du contenu. Jamais un tourniquet centré. |
| Partiel | Ce qui est disponible s'affiche, ce qui manque est nommé. |
| Erreur | Ce qui s'est passé et comment le corriger. |
| Hors ligne | Bandeau permanent, indication de ce qui reste possible. |
| Droit refusé | Ce que le rôle courant ne permet pas, et à qui s'adresser. |

---

## F8. Restitution des anomalies

L'interface possède un dictionnaire par code d'anomalie et par langue. Un code sans entrée fait échouer un test.

**Bloquante.** Pastille `state-blocking`, entité liée, action de correction proposée. Empêche l'émission d'une épreuve. Ne peut être ni masquée, ni acceptée, ni reportée.

**Avertissement.** Pastille `state-warning`, masquable pour la session, jamais définitivement.

**Information.** Pastille `state-info`, présente dans le rapport, absente de la vue courante.

Toute anomalie d'origine normative affiche sa référence documentaire. Une anomalie normative sans référence visible est un défaut, pas un détail de présentation.

Les anomalies sont groupées par entité, jamais par ordre d'apparition dans le code. Le comptage des bloquantes est visible en permanence dans la barre d'état.

---

## F9. Iconographie

### F9.1 La règle qui compte

L'interface affiche, dans la zone de travail, des pictogrammes normalisés du registre de sécurité et des pictogrammes d'orientation. Une icône d'interface ne doit jamais pouvoir être confondue avec l'un d'eux.

Conséquences, à respecter sans exception :

- Icônes d'interface en tracé seul, épaisseur constante, jamais en aplat plein.
- Jamais inscrites dans un cercle ou un carré plein, ces formes étant celles des pictogrammes normalisés.
- Jamais coloriées avec les couleurs de sécurité.
- Jamais représentant un sujet du domaine de la signalétique de sécurité : silhouette en fuite, flamme, personne, flèche directionnelle de sortie.

Une flèche d'interface, quand elle est indispensable, se distingue par sa forme et n'est jamais employée seule à côté d'un rendu de plan.

### F9.2 Fabrication

Jeu unique, taille de base 16 pixels, alignement sur la grille du pixel, épaisseur de tracé constante. Livré en fichiers, incorporé, jamais chargé depuis le réseau.

Toute icône porte un texte de remplacement décrivant l'action, pas la forme.

---

## F10. Écriture

### F10.1 Vocabulaire

Le vocabulaire imposé par le cahier des charges principal fait foi dans l'interface comme dans le code. Aucun synonyme. Un support est un support, jamais un panneau, un élément ou un item.

### F10.2 Ton

- Casse de phrase partout, y compris sur les boutons.
- Verbes actifs. Un bouton dit ce qui se produit : « Publier », pas « Valider ».
- Une action garde son nom sur tout le parcours. Le bouton « Publier » produit le message « Publié ».
- Aucune formule de politesse dans les erreurs, aucune excuse. Une erreur dit ce qui s'est passé et ce qu'il faut faire.
- Un écran vide invite à agir.
- Aucun texte destiné à rassurer sans informer.

### F10.3 Bilinguisme

- Toute chaîne passe par une clé. Aucun texte écrit dans un composant.
- Les maquettes sont contrôlées dans les deux langues, le français étant en général plus long de 15 à 25 %.
- Les libellés de champs sont dimensionnés sur la variante la plus longue, pas sur celle de la langue de développement.
- Aucune construction de phrase par concaténation de fragments : les langues n'ont pas le même ordre.

---

## F11. Mouvement

- Aucune animation qui ne réponde pas à une action de l'utilisateur.
- Durées : 120 millisecondes pour un changement d'état, 200 pour l'ouverture d'un élément flottant, 240 pour un panneau. Trois valeurs, pas davantage.
- Aucune animation d'entrée en cascade, aucune apparition progressive de sections.
- L'animation de parcours de la zone de travail est un contenu, pas un effet d'interface. Elle est réglable et possède un équivalent statique.
- Le mode à animation réduite est respecté. Il ne supprime pas l'information, il supprime le mouvement.

---

## F12. Densité et matériel cible

- Poste de référence : ordinateur portable, affichage de 1440 pixels de large, résolution standard.
- Largeur minimale prise en charge pour l'application de conception : **1366 pixels**.

**Correction d'une contradiction interne.** La valeur de 1280 pixels annoncée dans la première version était incompatible avec la règle de F5.1, qui impose que la zone de travail ne descende jamais sous 60 % de la largeur disponible. Les panneaux fixes occupent 524 pixels, ce qui exige une largeur totale d'au moins 1310 pixels pour respecter la règle. À 1280, la zone de travail tombait à 59,1 %.

La valeur retenue est 1366, largeur d'affichage courante sur les postes portables d'entrée de gamme, qui laisse la zone de travail à 61,6 %. En dessous, un message indique la contrainte au lieu de proposer une version dégradée inutilisable.

Cette valeur reste à confronter aux postes réellement utilisés. C'est un calcul cohérent, pas une observation.
- L'application de conception n'a pas de version pour terminal mobile. Ce serait une promesse intenable pour un outil de dessin. Une consultation en lecture seule pourra être envisagée ultérieurement, elle n'est pas prévue.
- Les rendus produits, eux, sont indépendants du matériel.

---

## F13. Interface du runtime de borne

Contraintes distinctes de celles de l'application de conception. Ne pas réutiliser les composants sans révision.

- Base typographique à 20 pixels au minimum, distance de lecture d'un usager debout.
- Cible tactile minimale de 44 pixels, espacement minimal de 8 pixels entre cibles.
- Zone d'interaction principale dans le tiers inférieur de l'écran, compatible avec un usage assis.
- Aucun survol, aucun menu déroulant, aucun lien sortant.
- Retour à l'accueil après inactivité, sans conservation d'état entre usagers.
- Mode contraste renforcé accessible en un geste depuis n'importe quel écran.
- Alternative sonore à toute information portée par la seule couleur.
- Vue en plan simplifié accessible partout où l'isométrie est proposée.
- Polices et icônes incorporées, aucune requête sortante.

---

## F14. Accessibilité

Cible AA sur l'application de conception et sur la borne. En complément des exigences déjà posées :

- Contraste calculé, jamais estimé, sur tous les couples de jetons, y compris les états de survol et de focus.
- Navigation complète au clavier, ordre de tabulation cohérent, aucun piège de focus.
- La zone de travail est intégralement pilotable au clavier, conformément à la partie E. C'est l'exigence la plus difficile et elle se conçoit dès le modèle de sélection.
- Aucune information portée par la seule couleur, vérifié sur un rendu en niveaux de gris.
- Textes de remplacement décrivant le contenu, jamais la forme.
- Les changements d'état et le résultat des actions sont annoncés.

---

## F15. Structure du code front

```
apps/studio/src/
  app/          composition des écrans, routage
  screens/      un dossier par écran
  components/   bibliothèque F6, aucun composant hors liste
  viewport/     zone de travail, vue, sélection, outils
  state/        magasin et commandes, écrit dans le dépôt
  i18n/         clés et dictionnaires
  a11y/         utilitaires d'annonce et de focus
```

Règles :

- Aucune valeur de couleur, d'espacement, de taille ou de durée écrite dans un composant. Jetons uniquement.
- Aucune règle de style spécifique à un écran. Un besoin de style non couvert par les jetons relève de la procédure d'arrêt et de demande.
- Attention aux spécificités de sélecteurs qui s'annulent, notamment entre sélecteurs de type et sélecteurs d'élément sur les marges internes.
- Aucun composant ne calcule sa propre conversion entre repère de vue et repère métier. Transformation unique, conformément à la partie E.

---

## F16. Tests front

- Non-régression visuelle sur chaque composant, dans chacun de ses états, dans les deux langues.
- Contraste calculé sur tous les couples de jetons.
- Parcours complet au clavier sur chaque écran.
- Analyse statique : aucune couleur en dur, aucune valeur d'espacement hors échelle, aucune chaîne de texte écrite dans un composant.
- Contrôle du dictionnaire : chaque code d'anomalie possède une entrée dans chaque langue active.
- Contrôle iconographique : aucune icône d'interface en aplat plein, aucune inscrite dans une forme fermée pleine.
- Rendu en niveaux de gris : aucune information perdue.

---

## F17. Rattachement aux tâches

| Élément | Rattachement |
| --- | --- |
| Jetons, typographie, espacement | T-0.7, étendue |
| Bibliothèque de composants et états | nouvelle tâche T-0.13 |
| Jeu d'icônes et règle de non-confusion | nouvelle tâche T-0.14 |
| Dictionnaires et mécanisme bilingue | nouvelle tâche T-0.15 |
| Mise en page de l'écran de conception | T-1.15, étendue |
| Barre d'état et coordonnées | T-1.15 |
| Restitution des anomalies | T-1.12 et T-2.5 |
| Écran de contrôle de face | T-2.15, étendue |
| Rapport d'audit en mise en page document | T-1.14, étendue |
| Interface de borne | lot 3.5 |
| Thème sombre | lot 4.6 |

---

## F18. La marque Azimut

Traitée ici parce qu'elle ne peut pas rester hors du document, mais avec une frontière stricte : le rôle de cette section est autant de définir la marque que d'empêcher qu'elle contamine l'interface.

### F18.1 Le nom

Azimut désigne l'attribut qui oriente chaque plan mural selon le regard de l'usager. Le nom décrit donc ce que le produit fait, et se justifie en une phrase devant un client. Il est prononcé de façon quasi identique en français et en anglais.

Deux orthographes existent, avec et sans h final. Déposer les deux, ne communiquer que sur une seule.

### F18.2 Le signe

Concept retenu : la notation d'un relèvement. Un point d'observation et une direction relevée, tels qu'ils figurent sur un plan de géomètre. Pas de rose des vents, pas d'épingle de localisation, pas de globe : ce sont les trois solutions attendues, donc les trois qui ne distinguent pas.

Contraintes de construction : tracé monolinéaire d'épaisseur constante, lisible à 16 pixels, fonctionnant en une seule couleur, sans dégradé, sans ombre.

Une réserve de protection égale à la hauteur du signe. Largeur minimale déclarée pour l'impression et pour l'écran.

Trois versions seulement : positive sur fond clair, négative sur fond sombre, monochrome pour la gravure et la sérigraphie.

### F18.3 Interdits

Ne jamais déformer, incliner, contourner, ombrer, remplir d'un dégradé, poser sur une photographie chargée, ni recolorer hors des trois versions.

Ne jamais employer une couleur du registre de sécurité. Ne jamais inscrire le signe dans un cercle ou un carré plein, pour la même raison que les icônes d'interface : la confusion possible avec un pictogramme normalisé.

### F18.4 La frontière avec l'interface

Règles fermes, qui sont l'objet principal de cette section.

- Le signe apparaît à un seul endroit de l'application de conception : la barre de site, en petit format. Nulle part ailleurs.
- Les couleurs de la marque ne sont pas des jetons d'interface. Si la marque devait un jour adopter une couleur propre, celle-ci n'entrerait pas dans le système de jetons.
- **La marque n'apparaît jamais sur un livrable client.** Ni sur une exécution destinée au fabricant, ni sur un plan mural, ni sur un rapport exporté, ni dans les métadonnées d'un fichier produit. Le fabricant reçoit un fichier propre.
- **La marque n'apparaît jamais sur une borne.** Une borne porte l'identité du site, pas celle de l'éditeur du logiciel. Une mention discrète est admissible dans un écran de service accessible au personnel, pas dans le parcours visiteur.
- L'espace annonceur et l'espace locataire portent l'identité du site, pas celle d'Azimut.

Motif : le produit se vend à des exploitants dont l'identité est l'actif. Un logiciel qui signe leurs livrables se rend impossible à recommander.

### F18.5 Ce qui reste à faire

Le dessin effectif du signe relève d'un designer. Cette section en fixe le concept et les contraintes, elle ne le remplace pas.

La disponibilité du nom n'est pas vérifiée : ni les noms de domaine, ni les antériorités de marque en classes 9 et 42 auprès des offices compétents. Un nom déjà déposé ne vaut rien, et cette vérification relève d'un conseil en propriété industrielle. C'est un préalable, pas une formalité.

---

## F19. Ce que cette partie ne couvre pas

Liste réduite depuis la première version. Les points relatifs aux licences de polices, à l'ergonomie tactile et au stylet sont désormais traités en partie G. Les contrastes sont mesurés en F2.3. La largeur minimale est corrigée en F12. La marque est traitée en F18.

Restent ouverts :

1. **Le dessin du signe.** Concept et contraintes posés, exécution à confier à un designer.
2. **La disponibilité du nom.** Non vérifiée, préalable bloquant.
3. **La largeur minimale de 1366 pixels.** Cohérente avec la règle de proportion de la zone de travail, mais non confrontée aux postes réellement utilisés.
4. **Les essais sur usagers.** Aucune décision de ce document n'a été éprouvée auprès d'un opérateur réel, et ils portent maintenant sur un produit à onze modules. La densité retenue est le point le plus susceptible d'être remis en cause.
5. **Les écrans des sept modules ajoutés.** Inventoriés en F5bis et rattachés à trois familles de mise en page, ils ne sont pas spécifiés écran par écran. Chacun le sera au moment d'entrer dans son incrément.
