#!/usr/bin/env node
// Migration Cloudflare (chantier 310) : traduit les regles de Netlify (netlify.toml et
// public/_redirects, public/_headers) vers ce que Cloudflare Workers sait servir :
//   - dist/_redirects : redirections 301, 302, 303, 307, 308 et reecritures locales 200 ;
//   - dist/_headers   : en-tetes, plus HSTS (ajoute d'office par Netlify) ;
//   - worker/routes.generated.mjs : chemins rendus en 410 ou 404 avec une page (statuts que
//     _redirects ne connait pas), servis par le Worker quand aucun fichier ne correspond.
// Netlify reste la production tant que le site n'est pas bascule : ce script n'est PAS lance
// par `npm run build`, sinon Netlify appliquerait aussi ces fichiers.
//
// Fail-closed : toute regle sans equivalent arrete le script (conditions de pays ou de langue,
// query, signature, proxy vers une URL absolue, `force` sur un chemin qui existe dans dist/, ou
// redirection par domaine vers un autre domaine). Les redirections de domaine vers le domaine
// canonique (http, www) sont ecartees et listees : elles relevent des regles de la zone.
//
// Usage : node scripts/cloudflare-assets.mjs [--preview]
//   --preview : ajoute `X-Robots-Tag: noindex` partout (copie workers.dev de recette).
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";

const HSTS = "max-age=31536000";
const STATUTS_REDIRECTS = new Set([200, 301, 302, 303, 307, 308]);
const STATUTS_WORKER = new Set([404, 410]);

const existeDansDist = (dist, chemin) => {
  if (!dist || chemin.includes("*") || chemin.includes(":")) return false;
  const p = join(dist, chemin.replace(/\/+$/, ""));
  return existsSync(`${p}.html`) || existsSync(join(p, "index.html")) || (existsSync(p) && statSync(p).isFile());
};

/** Lit public/_redirects au format Netlify : `source destination [statut][!]`. */
export function lireRedirectsNetlify(texte) {
  const regles = [];
  for (const brute of texte.split("\n")) {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith("#")) continue;
    const [from, to, code = "301", ...reste] = ligne.split(/\s+/);
    const force = code.endsWith("!");
    regles.push({ from, to, status: Number(code.replace("!", "")), force, extra: reste.length > 0, source: "public/_redirects" });
  }
  return regles;
}

/** Lit public/_headers au format Netlify : un motif, puis des lignes indentees `Nom: valeur`. */
export function lireHeadersNetlify(texte) {
  const out = [];
  let motif = null;
  for (const brute of texte.split("\n")) {
    if (!brute.trim() || brute.trim().startsWith("#")) continue;
    if (!/^\s/.test(brute)) {
      motif = brute.trim();
      continue;
    }
    const i = brute.indexOf(":");
    if (motif && i > 0) out.push([motif, brute.slice(0, i).trim(), brute.slice(i + 1).trim()]);
  }
  return out;
}

export function convertir(toml, { publicRedirects = "", publicHeaders = "", estPreview = false, dist = null, domaine = null } = {}) {
  const conf = parse(toml || "");
  const erreurs = [];
  const zone = [];
  const redirects = [];
  const pages = [];
  let page404 = "/404.html";

  const regles = [
    ...lireRedirectsNetlify(publicRedirects),
    ...(conf.redirects || []).map((r) => ({ ...r, status: r.status ?? 301, source: "netlify.toml" })),
  ];
  for (const r of regles) {
    const ref = `${r.source} ${r.from} -> ${r.to} (${r.status})`;
    if (/^https?:\/\//.test(r.from)) {
      const cible = /^https?:\/\/([^/]+)/.exec(r.to)?.[1];
      if (domaine && cible === domaine) zone.push(ref);
      else erreurs.push(`${ref} : redirection par domaine vers un autre domaine`);
      continue;
    }
    if (r.conditions) erreurs.push(`${ref} : conditions (pays, langue, role) non supportees`);
    if (r.query) erreurs.push(`${ref} : correspondance sur la query non supportee`);
    if (r.signed) erreurs.push(`${ref} : redirection signee non supportee`);
    if (r.headers) erreurs.push(`${ref} : en-tetes de proxy non supportes`);
    if (r.extra) erreurs.push(`${ref} : options supplementaires non supportees`);
    if (r.force && existeDansDist(dist, r.from)) erreurs.push(`${ref} : force sur un chemin qui existe dans dist`);
    if (r.from === "/*" && r.status === 404 && r.to.startsWith("/")) {
      page404 = r.to; // page 404 personnalisee de tout le site : rendue par le Worker
      continue;
    }
    if (STATUTS_WORKER.has(r.status)) {
      if (/^https?:/.test(r.to) || r.from.includes("*") || r.from.includes(":")) erreurs.push(`${ref} : statut ${r.status} seulement pour un chemin exact vers une page locale`);
      else pages.push([r.from, r.status, r.to]);
      continue;
    }
    if (!STATUTS_REDIRECTS.has(r.status)) {
      erreurs.push(`${ref} : statut ${r.status} non supporte`);
      continue;
    }
    if (r.status === 200 && /^https?:/.test(r.to)) erreurs.push(`${ref} : proxy 200 vers une URL absolue`);
    redirects.push(`${r.from} ${r.to} ${r.status}`);
  }

  // En-tetes : public/_headers puis netlify.toml, fusionnes par motif. Pour un meme motif et un
  // meme nom, netlify.toml l'emporte (comportement observe chez Netlify le 06/10 sur nexacover) ;
  // Cloudflare, lui, concatenerait les deux valeurs (« DENY, DENY »).
  const parMotif = new Map();
  const ajouter = (motif, nom, valeur) => {
    if (!parMotif.has(motif)) parMotif.set(motif, new Map());
    parMotif.get(motif).set(nom.toLowerCase(), [nom, valeur]);
  };
  for (const [motif, nom, valeur] of lireHeadersNetlify(publicHeaders)) ajouter(motif, nom, valeur);
  for (const h of conf.headers || []) for (const [k, v] of Object.entries(h.values || {})) ajouter(h.for, k, String(v));
  if (!parMotif.has("/*")) parMotif.set("/*", new Map());
  const tous = parMotif.get("/*");
  if (!tous.has("strict-transport-security")) tous.set("strict-transport-security", ["Strict-Transport-Security", HSTS]);
  if (estPreview) tous.set("x-robots-tag", ["X-Robots-Tag", "noindex, nofollow"]);
  const blocs = [["/*", tous], ...[...parMotif].filter(([m]) => m !== "/*")].map(
    ([motif, noms]) => `${motif}\n${[...noms.values()].map(([k, v]) => `  ${k}: ${v}`).join("\n")}`,
  );

  if (erreurs.length) {
    const e = new Error(`${erreurs.length} regle(s) Netlify sans equivalent Cloudflare\n- ${erreurs.join("\n- ")}`);
    e.erreurs = erreurs;
    throw e;
  }
  return {
    redirects: redirects.length ? redirects.join("\n") + "\n" : "",
    headers: blocs.join("\n\n") + "\n",
    routes: `// Genere par scripts/cloudflare-assets.mjs : ne pas modifier a la main.\nexport const PAGES_STATUT = ${JSON.stringify(Object.fromEntries(pages.map(([f, s, t]) => [f, { status: s, page: t }])), null, 2)};\nexport const PAGE_404 = ${JSON.stringify(page404)};\n`,
    nbRedirects: redirects.length,
    nbPages: pages.length,
    nbBlocs: blocs.length,
    zone,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const racine = process.cwd();
  const dist = join(racine, "dist");
  if (!existsSync(dist)) {
    console.error("[cloudflare-assets] dist/ absent : lancer `npm run build` d'abord.");
    process.exit(1);
  }
  const lire = (p) => (existsSync(join(racine, p)) ? readFileSync(join(racine, p), "utf8") : "");
  // Domaine canonique : champ `cloudflare.domaine` de package.json (sert a reconnaitre les
  // redirections www et http, laissees aux regles de la zone).
  const domaine = JSON.parse(lire("package.json") || "{}").cloudflare?.domaine || null;
  try {
    const out = convertir(lire("netlify.toml"), {
      publicRedirects: lire("public/_redirects"),
      publicHeaders: lire("public/_headers"),
      estPreview: process.argv.includes("--preview"),
      dist,
      domaine,
    });
    writeFileSync(join(dist, "_redirects"), out.redirects);
    writeFileSync(join(dist, "_headers"), out.headers);
    writeFileSync(join(racine, "worker", "routes.generated.mjs"), out.routes);
    console.log(
      `[cloudflare-assets] ${out.nbRedirects} redirection(s), ${out.nbPages} page(s) a statut, ${out.nbBlocs} bloc(s) d'en-tetes${process.argv.includes("--preview") ? " (recette : noindex)" : ""}.`,
    );
    for (const z of out.zone) console.log(`[cloudflare-assets] regle de zone (www, http) ecartee : ${z}`);
  } catch (e) {
    console.error(`[cloudflare-assets] ${e.message}`);
    process.exit(1);
  }
}
