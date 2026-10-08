// Migration Cloudflare (chantier 310) : coeur commun du Worker des sites du parc.
// Le Worker passe en premier (`run_worker_first = true`) :
//   1. redirection canonique en 301 (www et barre finale), en production seulement ;
//   2. fonctions sur leurs chemins Netlify ;
//   3. fichiers statiques par le binding ASSETS (avec _headers et _redirects generes par
//      scripts/cloudflare-assets.mjs) ;
//   4. sans fichier : 410 ou 404 avec la page prevue (statuts inconnus de _redirects), sinon la
//      page 404 du site.
//
// Pieges connus (memoire formhush-cloudflare-workers-pieges) : jamais `fetch` detache de son
// contexte (« Illegal invocation » sous workerd), jamais `redirect: 'error'`.

/** Reemballe une reponse de fichier statique avec un autre statut, en gardant ses en-tetes (_headers). */
async function pageAvecStatut(env, request, page, status) {
  // Requete neuve, sans en-tetes conditionnels (un 304 ne porterait pas de corps). La gestion
  // des barres finales des assets peut rediriger `/404.html` vers `/404` : on suit une fois.
  let res = await env.ASSETS.fetch(new Request(new URL(page, request.url)));
  const suite = res.headers.get("location");
  if (res.status >= 300 && res.status < 400 && suite) res = await env.ASSETS.fetch(new Request(new URL(suite, request.url)));
  if (!res.ok) return new Response("Not Found", { status });
  const headers = new Headers(res.headers);
  headers.delete("etag");
  headers.set("cache-control", "public, max-age=0, must-revalidate");
  return new Response(request.method === "HEAD" ? null : res.body, { status, headers });
}

/**
 * Redirection canonique en 301, faite par le Worker tant que la zone n'a pas de regles de
 * redirection (le jeton de deploiement n'a pas ce droit) : autre hote (www) vers le domaine, et
 * barre finale selon le `trailingSlash` d'Astro. Active seulement si DOMAINE_CANONIQUE est pose
 * (production), jamais sur workers.dev.
 */
export function redirectionCanonique(url, domaine, barreFinale) {
  if (!domaine || estApercu(url)) return null;
  let chemin = url.pathname;
  if (barreFinale === "never" && chemin.length > 1 && chemin.endsWith("/")) chemin = chemin.replace(/\/+$/, "");
  if (barreFinale === "always" && !chemin.endsWith("/") && !/\.[a-z0-9]+$/i.test(chemin) && !chemin.startsWith("/.netlify/")) chemin += "/";
  if (url.hostname === domaine && chemin === url.pathname) return null;
  return `https://${domaine}${chemin}${url.search}`;
}

/**
 * Adresse d'apercu (workers.dev, dont les alias de PR `pr-N-<worker>.<compte>.workers.dev`) : la
 * version de PR partage les variables et secrets de production, il faut donc la neutraliser ici.
 */
export function estApercu(url) {
  return url.hostname.endsWith(".workers.dev");
}

const ROBOTS_APERCU = "User-agent: *\nDisallow: /\n";

/** Apercu : jamais indexable, jamais en cache partage. */
function marquerApercu(res) {
  const headers = new Headers(res.headers);
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.set("cache-control", "no-store");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/**
 * @param {{ fonctions: Record<string, (req: Request, env: object) => Promise<Response>>, pages: Record<string, {status: number, page: string}>, page404?: string }} options
 */
export function creerServeur({ fonctions, pages, page404 = "/404.html" }) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (estApercu(url)) {
        // Apercu : robots.txt bloquant, formulaires coupes (aucun vrai envoi depuis une PR).
        if (url.pathname === "/robots.txt") return marquerApercu(new Response(ROBOTS_APERCU, { headers: { "content-type": "text/plain; charset=utf-8" } }));
        if (url.pathname.startsWith("/.netlify/functions/")) {
          return marquerApercu(Response.json({ ok: false, erreur: "apercu", message: "Formulaire désactivé sur l'aperçu." }, { status: 503 }));
        }
        return marquerApercu(await servir(request, env, url));
      }
      return servir(request, env, url);
    },
  };

  async function servir(request, env, url) {
    const cible = redirectionCanonique(url, env.DOMAINE_CANONIQUE, env.BARRE_FINALE);
    if (cible) return new Response(null, { status: 301, headers: { Location: cible } });

    const chemin = url.pathname;
    const fonction = fonctions[chemin.replace(/\/+$/, "")];
    if (fonction) return fonction(request, env);
    if (chemin.startsWith("/.netlify/functions/")) return pageAvecStatut(env, request, page404, 404);

    // Le Worker passe d'abord (`run_worker_first = true`) : les fichiers statiques sont servis par
    // le binding, avec _headers et _redirects. Sans fichier, il rend 404 : pages a statut.
    const res = await env.ASSETS.fetch(request);
    if (res.status !== 404) return res;
    const regle = pages[chemin];
    if (regle) return pageAvecStatut(env, request, regle.page, regle.status);
    return pageAvecStatut(env, request, page404, 404);
  }
}

/** Enveloppe `fetch` liee au global : a passer aux gestionnaires qui acceptent un transport. */
export const fetchLie = (input, init) => fetch(input, init);
