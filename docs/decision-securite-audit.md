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
