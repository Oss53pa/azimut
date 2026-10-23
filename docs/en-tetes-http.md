# En-têtes HTTP du studio

Ce document est produit par `apps/studio/src/security/headers-doc.ts` depuis la
source unique des en-têtes (`apps/studio/src/security/headers.ts`). Un essai
vérifie qu'il la suit ; `AZIMUT_WRITE_HEADERS_DOC=1 pnpm test` le réécrit.

## Ce que la construction produit

- `dist/_headers` : tous les en-têtes, avec une politique de sécurité du
  contenu dont `connect-src` ne nomme que l'API et le service
  d'authentification déclarés à la construction (`VITE_AZIMUT_API_URL`,
  `VITE_AZIMUT_AUTH_URL`). Cloudflare et de nombreux serveurs statiques le
  lisent tel quel.
- Une balise meta `Content-Security-Policy` en tête de `index.html`, en
  secours. Une balise ne peut porter ni `frame-ancestors` ni la sécurité de
  transport stricte : ces deux protections n'existent que si le serveur pose
  les en-têtes ci-dessous.

Les scripts ne viennent que du site, sans `unsafe-inline` ni `unsafe-eval`.
Les polices sont servies par le studio (D-9).

## Les en-têtes

Pour une instance dont l'API et l'authentification sont servies depuis
`https://<instance>` :

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://<instance>; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin
```

## nginx

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://<instance>; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "DENY" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
```

## Caddy

```caddy
header {
  Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://<instance>; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"
  Strict-Transport-Security "max-age=63072000; includeSubDomains"
  X-Content-Type-Options "nosniff"
  Referrer-Policy "strict-origin-when-cross-origin"
  X-Frame-Options "DENY"
  Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  Cross-Origin-Opener-Policy "same-origin"
}
```

## Apache

```apache
Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://<instance>; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"
Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains"
Header always set X-Content-Type-Options "nosniff"
Header always set Referrer-Policy "strict-origin-when-cross-origin"
Header always set X-Frame-Options "DENY"
Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
Header always set Cross-Origin-Opener-Policy "same-origin"
```

## Vercel

`vercel.json` est un fichier statique, qui ne connaît pas l'instance : il porte
la part de la politique qui n'en dépend pas, et la balise meta de la page
porte le reste. Les deux politiques s'appliquent ensemble. Les réglages de
déploiement du fichier ne changent pas.

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "script-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        },
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        }
      ]
    }
  ]
}
```

## CORS

- **L'API de l'instance.** En installation autonome, PostgREST restreint les
  origines admises par `server-cors-allowed-origins` (variable
  `PGRST_SERVER_CORS_ALLOWED_ORIGINS`, PostgREST 12) : n'y inscrire que
  l'origine du studio. Sur un projet hébergé, le passage d'API de la
  plateforme fixe lui-même cette règle.
- **Le compilateur.** Il n'a aucun point d'entrée HTTP : il lit la file des
  travaux en base. Rien à restreindre tant qu'il n'en a pas.
