# Note de décision — Table de métriques de police et mesure déterministe

**Statut : proposition (A2.2 §2, choix de modèle de données). Soumise, pas figée dans le code.**

Cette note propose le modèle de données de la **table de métriques de
police** et l'**algorithme de mesure** qui manquent pour rendre actif le
contrôle de débordement `LAYOUT.CONTENT_OVERFLOW`. Elle rend concret le
mécanisme décrit en **partie G §G5.1**, sans rien inventer de normatif : la
partie G en fixe le contenu, cette note en fixe la forme, à ratifier.

---

## 1. Pourquoi cette note

`checkFaceContentFit` (engine-graph) est écrit, exporté, testé et déjà câblé
dans le compilateur (`apps/compiler/src/artwork.ts`) : il s'exécute dès qu'un
`TextMeasure` lui est fourni. Il reste dormant pour une seule raison — aucun
producteur de mesure n'existe :

- `FontMetricsRecord` (font-registry) ne porte aujourd'hui que la **présence**
  et l'**empreinte** de la table (`present`, `declared_hash`, `actual_hash`).
  Il ne contient **aucune chasse de glyphe**, donc ne permet pas de mesurer.

§G5.1 interdit de mesurer par le navigateur (INV-4 : résultat variable selon
moteur/version/poste). La mesure doit donc venir d'une **table versionnée**
portant les chasses. Cette table est le modèle de données à trancher.

---

## 2. Contenu imposé par §G5.1 (rappel, non négociable)

La table extraite à la construction porte, mot pour mot :

> unités par cadratin, hauteur de cadratin, hauteur d'x, jambages, chasse de
> chaque glyphe, paires d'approche.

Plus : versionnée avec la police, portant une empreinte (§G5.1.2), seule
source de mesure du moteur (§G5.1.3), un changement de version invalide les
rendus (§G5.1.4), un test compare à un rendu de référence (§G5.1.5).

---

## 3. Modèle de données proposé

Un type pur core-model, sans dépendance, distinct du `FontMetricsRecord`
d'intégrité (qui reste tel quel pour le contrôle présence/empreinte) :

```ts
/** G5.1 — table de métriques d'une police, unité : unités de police (upm). */
export type FontMetricsTable = {
  readonly font_id: string;
  /** Unités par cadratin (typiquement 1000 ou 2048). */
  readonly units_per_em: number;
  /** Hauteur de cadratin, hauteur d'x, jambages hauts et bas — en upm. */
  readonly em_height: number;
  readonly x_height: number;
  readonly ascender: number;
  readonly descender: number;
  /** Chasse de chaque glyphe, indexée par point de code (clé décimale). */
  readonly advances: Readonly<Record<string, number>>;
  /** Paires d'approche : clé "cp1,cp2" → correction de chasse en upm. */
  readonly kerning: Readonly<Record<string, number>>;
};
```

Justifications des choix ouverts (ce qui relève de A2.2) :

- **Unité interne = upm** (unités de police), converties en mm seulement à la
  mesure finale. Garde les entrées entières, donc exactes et déterministes ;
  aucune accumulation de flottants sur les chasses.
- **Indexation par point de code** (et non par caractère) : une clé stable,
  insensible à l'encodage NFC/NFD, cohérente avec le tri par point de code de
  l'empreinte §4. Les clés sont décimales (`"233"` pour « é »).
- **Approches en table plate `"cp1,cp2"`** plutôt qu'imbriquée : sérialisation
  et empreinte directes, pas d'objets creux.
- L'empreinte de la table réutilise le sérialiseur §4 (`empreinte`) déjà en
  place — pas de second mécanisme de hachage.

---

## 4. Algorithme de mesure proposé

```
mesurer(texte, fontSizeMm, table) :
  total_upm = 0
  pour i de 0 à n-1 :
    cp = point de code du caractère i
    a = table.advances[cp]        # chasse
    si a absent → anomalie bloquante (voir §5)
    total_upm += a
    si i > 0 : total_upm += table.kerning["cp_prev,cp"] ?? 0
  largeur_mm = total_upm * fontSizeMm / table.units_per_em
  retour arrondi D1.4 (roundMm ou précision de comparaison à trancher §6)
```

Propriétés : somme d'entiers en upm, une seule division finale, arrondi par le
module unique D1.4. Pure, déterministe, sans horloge ni navigateur. Le
`TextMeasure` attendu par `checkFaceContentFit` en est une fermeture :
`(text, sizeMm) => mesurer(text, sizeMm, table)`.

---

## 5. Glyphe absent de la table — décision demandée

Un caractère à mesurer dont la chasse manque ne peut pas être approximé sans
réintroduire de l'indéterminisme. Deux options, cohérentes avec l'esprit de
G5 (métriques absentes = anomalie bloquante `FONT.METRICS_MISSING`) :

- **(a) Anomalie bloquante** `FONT.METRICS_MISSING` (ou un code dédié
  `FONT.GLYPH_ADVANCE_MISSING`) : la mesure échoue, le rendu est refusé.
  Cohérent avec la couverture latine déjà garantie à l'import
  (`ASSET.FONT_MISSING_GLYPHS`) : un glyphe couvert a forcément une chasse.
- **(b) Chasse de substitution** documentée (p. ex. celle du glyphe de
  remplacement) : jamais silencieuse, tracée par un avertissement.

**Recommandation : (a)**, un nouveau code `FONT.GLYPH_ADVANCE_MISSING`. La
couverture latine étant déjà un préalable bloquant à l'import, ce cas ne
devrait pas survenir pour fr/en ; s'il survient, c'est une table corrompue,
pas un contenu à rendre au mieux.

---

## 6. Points à trancher (A2.2)

1. **Le modèle §3** (`FontMetricsTable`, upm, indexation par point de code,
   approches plates) est-il ratifié, ou faut-il une autre forme ?
2. **Glyphe absent (§5)** : option (a) bloquante avec
   `FONT.GLYPH_ADVANCE_MISSING`, ou (b) substitution tracée ?
3. **Précision de comparaison** : la largeur mesurée entre-t-elle dans
   `checkFaceContentFit` arrondie au mm entier (`roundMm`), ou à la précision
   d'affichage (`roundSvg`, 3 décimales) ? Le contrôle est un seuil, pas un
   rendu ; l'arrondi doit être décidé, pas supposé.
4. **Donnée de test (§G5.1.5)** : le « rendu de référence » exige les
   métriques d'une police réelle. En livre-t-on une (open source, licence
   claire) comme fixture versionnée, ou teste-t-on l'algorithme sur une table
   synthétique en attendant ? (Une police réelle relève d'un choix de licence,
   §G5.3.)

---

## 7. Ce que je fais une fois ratifié

- Ajouter `FontMetricsTable` et `measureTextFromMetrics` en core-model (types
  purs, testés sur table synthétique et cas limites : vide, approche, glyphe
  absent).
- Fournir le `TextMeasure` au compilateur depuis la table chargée en donnée,
  ce qui **active `LAYOUT.CONTENT_OVERFLOW` de bout en bout**.
- Ajouter le code d'anomalie retenu au catalogue et à l'i18n FR/EN.
- Aucune valeur normative en dur ; les métriques restent une donnée versionnée
  portant son empreinte (INV-1, INV-5).

Tant que le §6 n'est pas tranché, le contrôle reste dormant, comme
aujourd'hui — aucune régression, mais aucune activation non plus.
