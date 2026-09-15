# Note de décision — Tâche T-0.9 : génération PDF/X et PDF/A

**Statut : proposition (A2.2). La décision est soumise, pas prise seule.**

Cette note répond au premier des trois critères d'acceptation de T-0.9
(« note comparative de deux ou trois options »). Les deux autres critères —
preuve de conformité PDF/X vérifiée par un outil tiers, et démonstration du
déterminisme de sortie — sont traités en §4 et §7 : l'un est partiellement
acquis, l'autre reste à réaliser hors de cet environnement. La tâche relève
explicitement de A2.2 : la bibliothèque n'est pas arrêtée ici, elle est
proposée à ratification.

---

## 1. Contexte et contraintes

Le service de compilation (A6) doit produire, pour chaque face de support,
un fichier d'exécution destiné à la fabrication : PDF/X-4 pour l'impression
en quadrichromie, PDF/A pour l'archivage. Trois contraintes du cahier des
charges bornent le choix, avant toute considération de confort :

- **INV-4 — déterminisme.** Deux compilations d'un même état produisent des
  fichiers strictement identiques, octet pour octet. Toute source
  d'horodatage, d'identifiant aléatoire ou d'ordre non défini est à
  neutraliser explicitement.
- **Installation autonome (A2.4).** Une fonctionnalité indisponible en
  installation autonome est interdite. Une dépendance à un service
  d'hébergement, ou à un binaire lourd difficile à empaqueter, est à écarter
  ou à justifier.
- **Aucune valeur normative en dur (INV-5).** Les profils colorimétriques et
  seuils relèvent de données versionnées, pas du code.

Environnement cible : Node ≥ 22, monorepo TypeScript strict, moteurs purs
(ni horloge, ni réseau, ni système de fichiers dans `engine-*`).

---

## 2. Ce que « conformité PDF/X-4 / PDF/A » exige réellement

La conformité n'est pas un drapeau ; c'est un ensemble de conditions
structurelles vérifiables. Pour PDF/X-4 (ISO 15930-7) et PDF/A (ISO 19005),
l'essentiel :

1. **OutputIntent avec profil ICC incorporé.** Le fichier doit contenir le
   flux ICC lui-même (`DestOutputProfile`), pas seulement le nom de la
   condition de sortie.
2. **Métadonnées XMP.** Un paquet XMP portant l'identifiant de conformité
   (`pdfaid:part`/`conformance`, `pdfxid:GTS_PDFXVersion`).
3. **Polices incorporées et sous-ensemblées.** Aucune police non incorporée.
4. **Transparence maîtrisée** (PDF/X-4 l'autorise, PDF/X-1a non ; PDF/A a ses
   propres règles), pas de contenu chiffré, pas de JavaScript, pas de contenu
   externe.

Ces conditions valent quelle que soit la bibliothèque : aucune des options
ci-dessous ne les fournit « gratuitement ».

---

## 3. Options comparées

| Critère | pdf-lib (en place) | PDFKit | Chromium sans tête (Puppeteer) |
| --- | --- | --- | --- |
| Nature | JS pur, sans binaire natif | JS pur, sans binaire natif | binaire Chromium (~150–300 Mo) |
| Installation autonome | oui | oui | lourde, empaquetage délicat |
| Modèle d'API | bas niveau, objets PDF manipulables | flux/haut niveau, orienté document | rendu HTML/SVG → PDF |
| Fidélité de rendu SVG | à écrire nous-mêmes (fait, minimal) | à écrire nous-mêmes | native, très élevée |
| Incorporation de polices | oui (contrôle manuel) | oui (avec sous-ensemble) | native |
| OutputIntent + ICC incorporé | possible (bas niveau) | possible, moins direct | non maîtrisable |
| Métadonnées XMP | possible (bas niveau) | possible | non maîtrisable |
| **Déterminisme octet** | **contrôlable** (date/ID explicites, sans flux d'objets) | possible mais délicat (ID de fichier, ordre interne) | **non** : horodatages, variation selon version |
| Conformité PDF/X-4 clé en main | non | non | non |

Notes :

- **Chromium sans tête** offrirait la meilleure fidélité de rendu, mais il
  est écarté sur trois motifs cumulés : non déterministe par construction
  (horodatages intégrés, sortie variable selon la version du moteur), lourd à
  empaqueter en installation autonome, et sans contrôle des structures de
  conformité PDF/X. La présence d'un Chromium dans l'environnement de test ne
  change pas ce verdict : ce serait une dépendance de produit, pas de test.
- **PDFKit** est un pair viable de pdf-lib (JS pur, incorporation de polices
  avec sous-ensemble mieux outillée). Son API orientée flux rend le
  déterminisme octet plus laborieux à garantir (identifiant de fichier et
  ordre d'écriture internes), sans l'interdire.
- **Post-traitement Ghostscript** (`-dPDFX`, conversion colorimétrique) est la
  voie classique vers une conformité PDF/X-4 stricte, mais introduit une
  dépendance à un binaire natif (relève de A2.2 §4) et demande un ancrage
  d'horodatage pour rester déterministe. C'est une option de *finalisation*,
  orthogonale au choix du générateur, à considérer seulement si la conformité
  native s'avère insuffisante après §6.

---

## 4. Déterminisme : état prouvé et limite

La sortie de `exportArtworkPdf` est aujourd'hui **prouvée déterministe au
sein de l'exécution** (commit de durcissement associé) :

- fonction pure des valeurs d'entrée, invariante à l'identité d'objet ;
- stable octet-à-octet sur plusieurs compilations successives ;
- sans état de module fuité ;
- vérifiée pour les deux cibles, `pdf-x4` et `pdf-a`.

Cela tient parce que la date de création est un **paramètre explicite** (pas
`Date.now()`), l'identifiant `/ID` est dérivé du contenu, et l'enregistrement
se fait sans flux d'objets (`useObjectStreams: false`).

**Limite assumée.** Le déterminisme inter-environnement (même octet sur une
autre machine ou une autre version de `pdf-lib`) n'est volontairement pas
figé par une empreinte de référence stockée : une empreinte propre à une
machine *masquerait* une dérive au lieu de la *révéler*. La stabilité
inter-version se vérifiera au moment d'un changement de version, par
recompilation d'un jeu de référence.

---

## 5. État réel du code actuel (constaté)

`applyConformanceMetadata` pose aujourd'hui un `OutputIntent` **par son nom**
(`sRGB IEC61966-2.1`) **sans incorporer le flux ICC** (`DestOutputProfile`),
et **sans paquet XMP** de conformité. En l'état, le fichier produit n'est
donc **pas encore réellement conforme** PDF/X-4 ni PDF/A : il en a la
silhouette (OutputIntent, MarkInfo), pas les conditions structurelles du §2.
C'est un écart à combler, pas un défaut bloquant du choix de bibliothèque.

Par ailleurs, le profil ICC à incorporer est une **donnée** (INV-5) : il
devra provenir d'un fichier de profil versionné, pas d'une constante de code.

---

## 6. Recommandation (proposition, non décision)

**Retenir `pdf-lib` comme générateur**, pour trois raisons alignées sur les
contraintes du §1 :

1. JS pur, sans binaire natif → installation autonome sans réserve ;
2. accès bas niveau aux objets PDF → maîtrise des structures de conformité
   (OutputIntent+ICC, XMP) et du déterminisme (date/ID explicites) ;
3. déjà intégré et déjà prouvé déterministe en exécution.

**Suivi nécessaire** pour atteindre la conformité réelle du §2, en tâche
dédiée (hors T-0.9) :

- incorporer le profil sRGB dans `DestOutputProfile`, chargé depuis un fichier
  de profil versionné (donnée, INV-5) ;
- écrire le paquet XMP de conformité (`pdfaid`, `pdfxid`) ;
- garantir l'incorporation et le sous-ensemblage des polices ;
- conserver le déterminisme (le flux ICC et le XMP sont des octets fixes).

---

## 7. Validation tierce (critère d'acceptation restant)

La preuve de conformité par outil tiers demandée par T-0.9 se fera avec
**veraPDF** (validateur open source de la PDF Association, profils PDF/A et
PDF/X), et/ou une vérification Preflight. Cette étape exige un outil non
présent dans l'environnement de développement à quatre commandes ; elle est
donc **à réaliser séparément**, sur un fichier d'essai, une fois le §6 fait.

---

## 8. Décision demandée (A2.2)

Trois points à trancher, qui ne relèvent pas de l'agent seul :

1. **Ratifier `pdf-lib`** comme bibliothèque de génération (§3, §6), ou
   demander l'évaluation chiffrée d'une alternative (PDFKit, ou finalisation
   Ghostscript).
2. **Valider le plan de conformité** du §6 comme tâche de suivi, avec le
   profil ICC traité en donnée versionnée (INV-5).
3. **Cadrer la validation tierce** du §7 (veraPDF) : qui l'exécute, sur quel
   fichier d'essai, et où le rapport est archivé.

Tant que ces points ne sont pas arrêtés, le code reste dans son état
actuel : générateur déterministe en exécution, conformité PDF/X-4/PDF/A
**non encore atteinte** (§5).
