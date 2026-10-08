# Préparation Cloudflare Workers

Code préparé le 08/10/2026. Production toujours sur Netlify. Modèle copié depuis
`Galrauchk/electium`, `main` au commit `94f6c4d`. Le cœur `worker/serveur.mjs`
et le convertisseur `scripts/cloudflare-assets.mjs` sont des copies conformes.

`npm ci`, `npm run build`, puis `npm run cf:check` construisent et vérifient localement
les fichiers statiques, les redirections, les en-têtes et le contrat des variables.
`npm run cf:dev` lance le Worker local. Aucun secret de production n'est nécessaire.

La configuration Astro, ses URL et son `trailingSlash` restent inchangés.
La conversion des règles Netlify s'exécute après le build, uniquement dans les commandes
Cloudflare. Le build Netlify reste utilisable pour le retour arrière.

Les deux workflows restent en sommeil tant que les variables GitHub
`CLOUDFLARE_PREVIEW_ENABLED` et `CLOUDFLARE_PRODUCTION_ENABLED` ne valent pas `true`.
Aucune activation ne fait partie de cette PR. La production exige une décision de bascule
séparée, la configuration des routes et des variables du site, puis une recette.
Les mentions légales de l'hébergement restent celles de la production Netlify.

Avant d'activer les aperçus, créer l'application Cloudflare Access « Aperçus p4-local-demo »,
destination `preview_worker`, et rattacher les politiques équipe et CI existantes.
Renseigner `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CF_ACCESS_CLIENT_ID`
et `CF_ACCESS_CLIENT_SECRET` dans les secrets GitHub, sans les passer en argument shell.
L'aperçu de chaque PR utilise `wrangler versions upload --preview-alias pr-N`, refuse
l'accès anonyme, reste non indexable et désactive les fonctions pouvant envoyer des messages.

Pour les sites sans domaine personnalisé, le domaine de production Cloudflare reste à décider
avant activation. Les URL Netlify existantes et leurs liens restent inchangés dans cette PR.
Une future redirection depuis Netlify devra être préparée avant toute fermeture de ce service.

Sources officielles : [aperçus privés](https://developers.cloudflare.com/workers/configuration/cloudflare-access/),
[règles d'URL des fichiers HTML](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/).
