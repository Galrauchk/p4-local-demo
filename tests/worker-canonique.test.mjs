// Migration Cloudflare (chantier 310) : redirections canoniques faites par le Worker.
import { test } from "node:test";
import assert from "node:assert/strict";
import { creerServeur, redirectionCanonique } from "../worker/serveur.mjs";

const r = (u, barre = "never") => redirectionCanonique(new URL(u), "electium.fr", barre);

test("www vers le domaine, chemin et query gardes", () => {
  assert.equal(r("https://www.electium.fr/contact?x=1"), "https://electium.fr/contact?x=1");
});
test("barre finale retiree en mode never, racine intacte", () => {
  assert.equal(r("https://electium.fr/aides/"), "https://electium.fr/aides");
  assert.equal(r("https://electium.fr/"), null);
  assert.equal(r("https://electium.fr/contact"), null);
});
test("barre finale ajoutee en mode always, sauf fichiers", () => {
  assert.equal(r("https://electium.fr/guides", "always"), "https://electium.fr/guides/");
  assert.equal(r("https://electium.fr/robots.txt", "always"), null);
});
test("sans domaine canonique (workers.dev), aucune redirection", () => {
  assert.equal(redirectionCanonique(new URL("https://x.workers.dev/a/"), undefined, "never"), null);
});

test("apercu de PR (workers.dev) : jamais redirige meme avec le domaine de production", () => {
  assert.equal(r("https://pr-12-electium.quiet-edge-4821.workers.dev/aides/"), null);
});

const assets = { fetch: async (req) => new URL(req.url).pathname === "/" ? new Response("<h1>ok</h1>", { headers: { "cache-control": "public, max-age=0" } }) : new Response("nf", { status: 404 }) };
const env = { ASSETS: assets, DOMAINE_CANONIQUE: "electium.fr", BARRE_FINALE: "never" };
let envois = 0;
const serveur = creerServeur({ fonctions: { "/.netlify/functions/send-contact-email": async () => { envois++; return new Response("envoye"); } }, pages: {}, page404: "/404.html" });
const apercu = "https://pr-12-electium.quiet-edge-4821.workers.dev";

test("apercu : pages en noindex et sans cache partage", async () => {
  const res = await serveur.fetch(new Request(apercu + "/"), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(res.headers.get("cache-control"), "no-store");
});
test("apercu : robots.txt interdit tout", async () => {
  const res = await serveur.fetch(new Request(apercu + "/robots.txt"), env);
  assert.match(await res.text(), /Disallow: \/\n/);
});
test("apercu : formulaire coupe, aucun envoi", async () => {
  const res = await serveur.fetch(new Request(apercu + "/.netlify/functions/send-contact-email", { method: "POST", body: "{}" }), env);
  assert.equal(res.status, 503);
  assert.equal(envois, 0);
});
test("production : formulaire servi, pas de noindex", async () => {
  const res = await serveur.fetch(new Request("https://electium.fr/.netlify/functions/send-contact-email", { method: "POST", body: "{}" }), env);
  assert.equal(await res.text(), "envoye");
  assert.equal(res.headers.get("x-robots-tag"), null);
});
