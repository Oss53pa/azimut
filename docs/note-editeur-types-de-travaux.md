# Note à l'éditeur du cahier : deux types de travaux sans place dans A5.10

Note d'arrêt au titre de A2.2, cas 3 : le code et le cahier des charges
divergent. Aucune des deux issues n'est appliquée avant la décision de
l'éditeur.

## Constat

Le service de compilation connaît huit types de travaux
(`apps/compiler/src/job.ts`). La section A5.10 du cahier, et la contrainte de
la colonne `job.kind` en base, n'en listent que six :

```
import_plan, import_roster, compile_artworks,
build_kiosk_package, export_quantities, audit_site
```

Deux types n'y figurent pas :

| Type | Ce qu'il produit | Introduit |
| --- | --- | --- |
| `build_delivery_archive` | l'archive de livraison de D11 (« porte le même schéma sans les segments de support, plus un fichier d'index reprenant le quantitatif ») | 12 septembre 2026, `45a4dfa` |
| `build_wall_plans` | la famille de plans muraux orientés de D6 | 12 septembre 2026, `9fb03bb` |

## Conséquence aujourd'hui

Leurs gestionnaires existent et sont essayés, mais ces deux types ne peuvent
pas passer par la file en base. Une insertion dans `job` avec l'un d'eux est
refusée par la contrainte. Seule la file en mémoire les accepte, et elle ne
sert qu'aux essais.

Ce n'est pas bloquant pour la tranche en cours : le service ne branche
aujourd'hui que `build_kiosk_package`. Ça le deviendra quand les gestionnaires
seront réécrits pour charger leur site travail par travail.

## Deux issues

**1. Les ajouter au cahier.** A5.10 liste les deux types. Une migration
additive élargit la contrainte de `job.kind`. Aucune ligne n'est transformée.
C'est cohérent avec INV-1 : l'archive de livraison et les plans muraux sont
des livrables nommés par le cahier (D6, D11), et ils dépassent la durée d'une
opération courte (A3.2).

**2. Les retirer du code.** L'archive de livraison et les plans muraux
seraient alors produits par un type existant, par exemple `compile_artworks`
avec un paramètre de sortie. Les deux gestionnaires et leurs essais seraient
fondus dans ce type.

## Ce qui est demandé

Le choix entre les deux issues, porté dans une prochaine version du cahier
avec son empreinte. Rien ne change dans le code ni dans la base avant cette
version.
