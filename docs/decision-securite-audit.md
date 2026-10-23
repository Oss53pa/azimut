# Décisions de l'audit de sécurité (cible OWASP ASVS niveau 2)

Décisions prises par Oss53pa au titre de A2.2, à l'issue de l'étape 0 de
l'audit. Chaque lot qui les applique les cite par leur numéro.

| N° | Lot | Décision | Date |
| --- | --- | --- | --- |
| D-1 | 1 | `VITE_AZIMUT_DB_SCHEMA` reste une variable de construction : le nom du schéma n'est pas un secret. Elle figure dans la liste blanche motivée du contrôle de secrets. | 23/10/2026 |
| D-2 | 2 | Le studio parle au service d'authentification par appels HTTP directs (`apps/studio/src/auth/`), sans bibliothèque nouvelle. | 23/10/2026 |
| D-3 | 3 | `vendor_id` désigne un fabricant de l'organisation (`vendor`), auquel les comptes `vendor` sont rattachés (`vendor_member`). Migration 0077. | 22/10/2026 |
| D-4 | 3, 4 | `apply_commands` est fermée par une liste blanche en base (`command_table`), tirée du registre de propriété. Migration 0078. | 22/10/2026 |
| D-5 | 4, 5, 8 | Les seuils vivent dans une table commune, surchargeable par organisation, et les compteurs de débit dans une table de compteurs par fenêtre. | 23/10/2026 |
| D-6 | 5 | Quatre espaces de stockage privés : `plans`, `proofs`, `creatives`, `deliveries`. Chemin `{org_id}/{site_id}/{id}/{nom régénéré}`, accès par URL signée de courte durée. | 23/10/2026 |
| D-7 | 5 | SVG et PDF passent par un analyseur écrit dans le dépôt, par liste blanche, qui refuse tout le reste. | 23/10/2026 |
| D-8 | 7 | Une source unique d'en-têtes produit `_headers` et la documentation des serveurs courants, avec une CSP en balise meta en secours. Les mêmes en-têtes entrent dans `vercel.json`, sans toucher à ses réglages de déploiement. | 23/10/2026 |
| D-9 | 7 | Les polices sont hébergées dans le dépôt, à la place de Google Fonts. | 23/10/2026 |
| D-10 | 9 | Le propriétaire des tables est distinct du rôle de connexion de l'application, qui ne peut pas l'endosser. Documenté dans `packages/db/migrations/ORDRE.md`, et contrôlé en base. | 23/10/2026 |
| D-11 | 10 | Le paquet de borne est protégé par son empreinte seule, conformément à A5.9 et A7.5 ; aucune signature. | 23/10/2026 |
| D-12 | – | L'ancien schéma `azimut`, partiel et vide, du projet hébergé partagé a été retiré, puis les migrations 0001 à 0079 appliquées en une transaction. | 22/10/2026 |
| D-13 | 9 | Les échecs d'authentification sont journalisés par le service d'authentification lui-même, dans son journal des requêtes, et non dans `azimut.audit_log`. Aucune table nouvelle. | 23/10/2026 |
| D-14 | 10 | Vite passe en 6.4 pour le studio, le compilateur et le cadre d'essai, et vitest en 4.1 : les failles hautes de vite ne sont corrigées qu'à partir de 6.4.4, et vitest 3 dépend encore d'une version vulnérable de tinypool. Déroge à A3.1 (« Vite 5 ») ; l'amendement du cahier revient à Oss53pa. | 23/10/2026 |

## Sessions (lot 2)

- **Identité.** Une requête de l'API est identifiée par la revendication `sub`
  de son jeton, et par rien d'autre (migration 0080). Le réglage de session
  `azimut.current_user_id` ne vaut que pour une connexion directe à la base,
  qui suppose ses identifiants : service de compilation, outils
  d'exploitation.
- **Second facteur.** `admin` et `owner_rep` ne comptent dans une organisation
  que si le jeton porte `aal = aal2`. Avant, ils ne voient que leur propre
  inscription, et le studio ne leur montre que l'enrôlement ou la
  vérification du facteur TOTP.
- **Durée.** La durée d'un jeton d'accès est réglée par le service
  d'authentification (`jwt_expiry`, 3600 s dans `supabase/config.toml`). Le
  studio le rafraîchit à mi-vie. La rotation des jetons de rafraîchissement
  est active (`enable_refresh_token_rotation`).
- **Stockage.** Le jeton d'accès ne vit qu'en mémoire. Le jeton de
  rafraîchissement est gardé pour l'onglet seulement (`sessionStorage`).
- **Révocation.** « Se déconnecter » ferme la session de ce poste.
  « Se déconnecter de tous les appareils » révoque tous les jetons de
  rafraîchissement du compte (`logout?scope=global`). Un jeton d'accès déjà
  émis reste valable jusqu'à son expiration : c'est la limite de durée qui
  borne la fenêtre.
- **Projet hébergé.** Les réglages du fichier `supabase/config.toml` valent
  pour l'installation locale. Sur un projet hébergé, les mêmes réglages se
  posent dans la configuration du service d'authentification : facteur TOTP
  activé, mot de passe d'au moins 12 caractères, confirmation au changement
  de mot de passe.

## Journal des événements (lot 9)

- **Le journal de l'organisation.** `azimut.audit_log` n'admet que
  l'insertion, par le seul rôle `azimut_audit`, au travers des déclencheurs
  des événements de A12.3. Chaque ligne appartient à une organisation.
- **Les échecs d'authentification (D-13).** Une tentative de connexion
  échouée n'appartient à aucune organisation : elle n'entre pas dans
  `azimut.audit_log`. Elle est consignée par le service d'authentification,
  qui la reçoit et la refuse. En installation autonome, son journal des
  requêtes est la sortie du service, à conserver avec les autres journaux
  de l'instance ; sur un projet hébergé, c'est le journal du service
  d'authentification de la plateforme. Le débit des tentatives est borné au
  même endroit (lot 8, « La connexion »).

## Débit et quotas (lot 8)

- **Ce qui est compté.** Les écritures, une par instruction et par
  utilisateur ; les changements de membres et de fabricants, par utilisateur
  et par organisation ; les créations d'organisation, par utilisateur ; les
  dépôts de travaux, par utilisateur et par organisation. Seule une requête
  identifiée est comptée. Le quota d'une organisation n'est consommé que par
  ses membres : nul n'épuise celui d'une organisation dont il n'est pas
  membre.
- **Les seuils.** Ce sont des données de `azimut.security_setting`
  (`rate.*.per_user`, `rate.*.per_org`, `rate.*.window_seconds`), qu'une
  organisation peut resserrer. La file a deux quotas de plus :
  `job.max_running_per_org` (travaux en cours simultanés) et
  `job.payload.max_bytes` (taille du paramètre).
- **La réponse.** Un dépassement rend `rate_limited`, que PostgREST traduit
  en 429 avec `Retry-After`. Le message ne nomme ni l'organisation, ni
  l'utilisateur, ni le compteur. Le dépassement est consigné au journal
  technique de la base (`rate_limited action=… scope=…`) : une entrée dans
  `audit_log` serait annulée avec la requête refusée.
- **Le compilateur.** Ses écritures faites sous l'identité du demandeur
  passent par les mêmes déclencheurs. Un refus y devient un échec de travail,
  rejoué selon la temporisation de D9.2.
- **La connexion.** Elle est limitée par le service d'authentification
  (`[auth.rate_limit]` de `supabase/config.toml`) : 30 connexions ou
  inscriptions par adresse et par tranche de 5 minutes, 150 rafraîchissements
  de session, 30 vérifications de code. Sur un projet hébergé, les mêmes
  limites se posent dans la configuration du service d'authentification.

## Chaîne de fabrication et paquet de borne (lot 10)

- **Le paquet de borne.** La borne n'ouvre un paquet que par
  `openKioskPackage` : manifeste lu par un schéma strict, chaque fichier
  confronté à son empreinte, empreinte du manifeste recalculée, fichiers de
  données couverts par le manifeste. Un seul écart et le paquet est refusé,
  avant toute lecture du site. Conformément à D-11, c'est l'empreinte seule :
  elle prouve que le paquet est celui que son manifeste décrit, pas qui l'a
  produit.
- **Les dépendances.** `pnpm audit:all` refuse en intégration toute faille
  connue, haute ou critique, dans toutes les dépendances, outillage d'essai
  et de construction compris (D-14). L'installation suit le verrou
  (`--frozen-lockfile`).
- **Les versions forcées.** `pnpm.overrides` ne fait que corriger une faille
  dans la même version majeure ; un essai le vérifie.
- **Les outils de la chaîne.** Chaque action est épinglée par son empreinte,
  avec sa version en commentaire, et `wrangler` est appelé dans une version
  exacte. Une mise à jour est un changement explicite du dépôt.
