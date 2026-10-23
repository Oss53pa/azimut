import { z } from 'zod';

/**
 * Lot 7 de l'audit (A3.4) : zod valide sans compilation à la volée.
 *
 * La politique de sécurité du contenu du studio refuse l'évaluation de code
 * (`script-src 'self'`, sans `unsafe-eval`). Par défaut, zod essaie
 * `new Function` à la construction de chaque schéma d'objet, ce que le
 * navigateur refuse et signale comme une violation. Le résultat d'une
 * validation ne change pas, seule sa vitesse.
 *
 * zod lit ce réglage à la construction d'un schéma : ce module est donc le
 * premier qu'importe le point d'entrée, avant tout module qui en déclare un.
 */
z.config({ jitless: true });
