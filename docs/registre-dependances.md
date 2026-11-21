# Registre des dépendances

D16 impose que toute dépendance nouvelle passe par la procédure d'arrêt et de
demande, que sa version soit figée, et qu'aucune ne soit adoptée sans examen.
Le cahier des charges ne prévoit pas où consigner le résultat de cet examen ;
ce registre le fait, et n'ajoute aucune règle.

Une entrée porte : ce que la dépendance fait, qui l'a autorisée, à quelles
conditions, sa licence, et si elle est distribuée au client. Une dépendance
sans entrée n'a pas été autorisée.

## Préautorisées par A3.3

`zod` pour la validation, `date-fns` pour les dates, `nanoid` pour les
identifiants non métier. Elles n'ont pas besoin d'entrée ici.

## Autorisées au cas par cas

### axe-core

| | |
| --- | --- |
| **Version** | 4.13.0, exacte, figée au fichier de verrouillage |
| **Portée** | `devDependencies` de la racine, une seule déclaration |
| **Licence** | MPL-2.0 |
| **Distribuée** | Non. Outil d'essai, jamais livrée |
| **Autorisée le** | 22 septembre 2026, par Atlas Studio |
| **Emploi** | Analyse d'accessibilité des écrans, injectée dans la page par Playwright |

**Conditions posées à l'autorisation**, et où chacune est tenue :

| Condition | Tenue par |
| --- | --- |
| Dépendance de développement seulement, version exacte | `tests/a11y-not-shipped.test.ts`, premier essai |
| Jamais dans un livrable, contrôlé par la chaîne d'intégration | `tests/a11y-not-shipped.test.ts` pour la source, et l'étape « axe-core n'est livré nulle part » de `.github/workflows/ci.yml` pour les artefacts construits |
| axe-core seul, aucun paquet d'intégration | Aucune autre dépendance ajoutée ; le fichier est injecté par `page.addScriptTag` |
| Règles bornées aux niveaux A et AA de WCAG 2.0, 2.1 et 2.2 | `tests/e2e/a11y-axe.spec.ts`, constante `WCAG_A_AA` |
| Les cinq écrans de la partie M, leurs états, les deux langues | même fichier, 22 essais |
| Zéro violation, incomplets nommés au relevé | même fichier, et `docs/releve-axe.json` |

**Ce que l'essai établit.** L'absence de violation détectable automatiquement.
Ce n'est pas une attestation de conformité AA : une part des critères de WCAG
ne s'automatise pas, et l'attestation relève de l'audit externe du lot 4.7.

**Licence, et ce qu'elle implique ici.** MPL-2.0 est une licence à réciprocité
par fichier. Elle s'exercerait sur des fichiers modifiés et redistribués ;
axe-core n'est ni modifié ni redistribué, et n'entre dans aucun livrable. Le
contrôle de non-livraison est donc aussi ce qui maintient cette situation.

### @supabase/auth-js

| | |
| --- | --- |
| **Version** | 2.119.0, exacte, figée au fichier de verrouillage. Publiée le 4 novembre 2026 |
| **Portée** | `dependencies` de `apps/studio`, une seule déclaration |
| **Licence** | MIT |
| **Distribuée** | Oui, dans le paquet du studio servi au navigateur |
| **Dépendances propres** | `tslib` seule |
| **Autorisée le** | 21 novembre 2026, par Oss53pa (décision QA1, `docs/decoupage-authentification.md`) |
| **Emploi** | Client du service d'authentification de Supabase : connexion, rafraîchissement du jeton, et, pour AUTH.6, second facteur |

**Motif de l'autorisation.** Le code qui tient une session — rafraîchissement
du jeton, facteurs, défis — est un code de sécurité. L'écrire à la main est
le risque qu'OWASP ASVS, cible d'A6.3, demande d'éviter. Le client officiel
seul est retenu, sans le reste de `supabase-js` : l'atelier lit la base par
PostgREST et n'a pas besoin du reste.

**Disponibilité en installation autonome (A3.4).** Le client parle au service
d'authentification de la distribution Supabase autonome, le même que la CI
éprouve depuis AUTH.2. Aucun service géré n'est requis.

**Analyse de vulnérabilités à l'ajout (D16).** `pnpm audit --prod` ne relève
rien pour ce paquet. Il relève une vulnérabilité élevée sur `zod` 4.5.4,
antérieure à cet ajout et sans lien avec lui.

### Polices de l'interface : Dosis et Grand Hotel

| | |
| --- | --- |
| **Version** | Fichiers WOFF2 figés dans le dépôt, sous-ensembles latin et latin étendu, `packages/design-tokens/src/fonts/` |
| **Portée** | Interface du studio seulement, déclarées dans `studio-theme.css` |
| **Licence** | SIL Open Font License 1.1, texte joint à côté de chaque fichier (`OFL-dosis.txt`, `OFL-grand-hotel.txt`) |
| **Distribuée** | Oui, avec l'interface. L'OFL l'autorise tant que la licence et la mention de droits accompagnent les fichiers |
| **Autorisée le** | 25 septembre 2026, par le porteur du projet, avec l'adoption de la maquette « Azimut, logiciel autonome v2 » |
| **Emploi** | Dosis pour tout le texte de l'interface (`--font-sans`), Grand Hotel pour le logotype seul (`--font-brand`) |

**Ce qui n'est pas une dépendance.** Aucun paquet n'est ajouté et aucune
requête ne part vers un service de polices : les fichiers sont servis par
l'application elle-même, ce qui tient A3.4 en installation autonome. Ces
polices ne concernent pas le rendu des panneaux, dont les polices relèvent des
paquets de règles et de la charte.
