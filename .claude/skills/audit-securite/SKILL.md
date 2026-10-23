---
name: audit-securite
description: Audit puis durcissement sécurité d'une application existante, par lots validés un à un (secrets et clés, authentification, autorisation et cloisonnement, validation des entrées, fichiers téléversés, encodage en sortie, en-têtes HTTP, limitation de débit, journalisation, dépendances). À lancer à la demande (/audit-securite), jamais en tâche de fond.
---

# Audit et durcissement sécurité

Cible de revue : OWASP ASVS niveau 2.

## Préalable

1. Lis le `CLAUDE.md` du projet et la documentation de référence qu'il désigne.
   Ils priment sur cette skill. Toute contradiction : arrêt et signalement, pas
   d'arbitrage.
2. Identifie la pile réelle (front, back, base, hébergement) avant de proposer
   quoi que ce soit. Ne suppose pas l'existence d'une couche API : une
   application monopage qui parle directement à sa base n'a pas de « routes ».

## Contraintes globales

- Aucune bibliothèque nouvelle sans accord explicite. Utilise ce que le projet
  autorise déjà.
- Aucun service géré propre à un hébergeur si le projet doit rester portable.
- Seuils (débit, tailles, durées) en configuration, jamais en constantes.
- Ne jamais contourner le cloisonnement par organisation ou par locataire, y
  compris en test.
- Ne jamais committer de secret, même « de test ».

## Étape 0 : audit, sans modifier de code

Produis une note contenant :

1. La cartographie des points d'entrée : appels client vers la base ou l'API,
   fonctions serveur, files de travaux, stockage objet, webhooks.
2. L'inventaire des secrets et variables d'environnement, et leur exposition
   (client ou serveur). Vérifie le bundle construit, pas seulement le source.
3. Les champs saisis par l'utilisateur et leur état de validation.
4. Pour chaque lot ci-dessous : l'existant, l'écart, la proposition, l'effort.

**Arrête-toi et attends la validation, lot par lot.** L'ordre recommandé place
le lot 3 avant les lots 4 et 8 : valider ou limiter le débit sur une table mal
cloisonnée ne protège rien.

## Lots

### Lot 1 : secrets et clés
- Côté client, seules les clés publiques par conception (anon, publiable).
  Toute autre clé reste serveur.
- Recherche de secrets dans le bundle de production après construction.
- `.env.example` sans valeur réelle ; détection de secrets en CI.

### Lot 2 : authentification et sessions
- Double authentification pour les rôles privilégiés, vérifiée côté serveur ou
  base, pas seulement dans l'interface.
- Durée de session, révocation, déconnexion globale, limitation des tentatives.

### Lot 3 : autorisation et cloisonnement
- Autorisation en base (RLS ou équivalent) sur toute table portant un
  identifiant de locataire, avec un test qui échoue si une table en manque.
- Aucune fuite inter-locataires par message d'erreur, compteur, clé étrangère
  ou temps de réponse.
- Fonctions privilégiées (`security definer` ou équivalent) : `search_path`
  figé, contrôle explicite du locataire et du rôle.

### Lot 4 : validation et nettoyage des entrées
- Schéma strict par entrée : type, longueur maximale, format, énumération,
  champs inconnus rejetés.
- Validation à la frontière serveur ou en base (contraintes `CHECK`). La
  validation client n'est que de l'ergonomie.
- Nettoyage = normaliser (trim, Unicode NFC) puis rejeter ; jamais réécrire
  silencieusement une donnée métier.
- Imports de fichiers ligne par ligne, même schéma, rapport d'erreurs.
- Aucune requête construite par concaténation.

### Lot 5 : fichiers téléversés
- Type vérifié sur les octets, taille bornée, nom régénéré côté serveur.
- Aucun bucket public ; URL signées à durée courte ; politiques alignées sur
  le locataire et le rôle.
- SVG et PDF : refuser ou assainir scripts, références externes, entités XML.
- Bornes de décompression, de pages et de durée sur les traitements lourds.

### Lot 6 : encodage en sortie
- Tout texte utilisateur échappé à la sérialisation (HTML, SVG, PDF).
- Aucune injection de HTML brut sur une donnée non maîtrisée.

### Lot 7 : en-têtes HTTP
- CSP stricte, HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
  `frame-ancestors`, CORS restreint.
- Forme portable d'un hébergeur à l'autre.

### Lot 8 : limitation de débit
- Compteurs par utilisateur et par locataire sur les points sensibles ; quotas
  sur les files de travaux.
- Réponse 429 avec `Retry-After`, sans fuite d'information.

### Lot 9 : journalisation et erreurs
- Journal d'audit en insertion seule, garanti en base.
- Ni secret, ni jeton, ni donnée personnelle dans les journaux.
- Erreurs client génériques avec code stable.

### Lot 10 : dépendances et chaîne de fabrication
- Audit des dépendances en CI, lockfile figé.
- Intégrité des artefacts publiés (empreinte ou signature) si le projet le
  prévoit ; sinon, signaler et demander.

## Livraison de chaque lot

- Tests : unitaires pour les schémas, test de cloisonnement, et un test d'abus
  propre au lot (dépassement de débit, fichier piégé, accès d'un autre
  locataire).
- Commandes de vérification du projet exécutées, sortie réelle au rapport.
- Un lot cohérent par poussée ; rien sur la branche de production sans
  validation.

## Particularités d'Azimut

Si le dépôt courant est Azimut :

- Sections à lire : A3.3, A3.4, A5, A6, A9, A12.3 de
  `docs/cahier-des-charges.md`. Le format de rapport est celui de A2.6.
- `zod` est la seule bibliothèque de validation autorisée ; toute autre
  bibliothèque déclenche l'arrêt A2.2.
- Portabilité Supabase autonome (A3.4) : ni Upstash, ni middleware ou firewall
  d'hébergeur, ni Worker avec logique. Le studio est servi en statique.
- A6.3 impose déjà : double authentification pour `admin` et `owner_rep`,
  validation zod y compris des données relues en base.
- Le rôle `vendor` se cloisonne par rattachement explicite, pas par
  organisation : tests dédiés.
- Vérifications : `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm test:visual`, plus `pnpm test:rls` pour le lot 3.
