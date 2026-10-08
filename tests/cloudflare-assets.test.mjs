// Migration Cloudflare (chantier 310) : traduction des regles Netlify vers Workers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { convertir, lireRedirectsNetlify } from "../scripts/cloudflare-assets.mjs";

const lire = (p) => {
  const u = new URL(`../${p}`, import.meta.url);
  return existsSync(u) ? readFileSync(u, "utf8") : "";
};
const DOMAINE = JSON.parse(lire("package.json")).cloudflare?.domaine;

test("les regles Netlify reelles du site se traduisent sans erreur", () => {
  const out = convertir(lire("netlify.toml"), {
    publicRedirects: lire("public/_redirects"),
    publicHeaders: lire("public/_headers"),
    domaine: DOMAINE,
  });
  assert.match(out.headers, /^\/\*\n/);
  assert.match(out.headers, /Strict-Transport-Security: max-age=31536000/);
  if (!/x-robots-tag/i.test(lire("netlify.toml") + lire("public/_headers"))) assert.doesNotMatch(out.headers, /X-Robots-Tag/);
});

test("la recette workers.dev est noindex", () => {
  const out = convertir("", { estPreview: true });
  assert.match(out.headers, /X-Robots-Tag: noindex, nofollow/);
});

test("410 et 404 vont au Worker, pas dans _redirects", () => {
  const toml = `[[redirects]]\nfrom = "/blog/"\nto = "/404.html"\nstatus = 410\nforce = true\n[[redirects]]\nfrom = "/a"\nto = "/b"\n`;
  const out = convertir(toml);
  assert.equal(out.redirects, "/a /b 301\n");
  assert.match(out.routes, /"\/blog\/": \{\s+"status": 410,\s+"page": "\/404.html"/);
});

test("une regle sans equivalent arrete la conversion (fail-closed)", () => {
  const toml = `[[redirects]]\nfrom = "/a"\nto = "/b"\nstatus = 302\nconditions = {Country = ["BE"]}\n[[redirects]]\nfrom = "/c"\nto = "https://ailleurs.fr/c"\nstatus = 200\n[[redirects]]\nfrom = "/d/*"\nto = "/404.html"\nstatus = 410\n`;
  assert.throws(() => convertir(toml), (e) => e.erreurs.length === 3);
});

test("www et http vers le domaine canonique sont laisses a la zone ; un autre domaine est refuse", () => {
  const texte = "https://www.exemple.fr/* https://exemple.fr/:splat 301!\n";
  assert.equal(convertir("", { publicRedirects: texte, domaine: "exemple.fr" }).zone.length, 1);
  assert.throws(() => convertir("", { publicRedirects: texte, domaine: "autre.fr" }));
});

test("lecture du format _redirects de Netlify, marqueur de force compris", () => {
  assert.deepEqual(lireRedirectsNetlify("# note\n/old /new 301!\n/x /y\n"), [
    { from: "/old", to: "/new", status: 301, force: true, extra: false, source: "public/_redirects" },
    { from: "/x", to: "/y", status: 301, force: false, extra: false, source: "public/_redirects" },
  ]);
});

test("le repli /* vers une page 404 devient la page 404 du Worker", () => {
  const out = convertir(`[[redirects]]\nfrom = "/*"\nto = "/erreur.html"\nstatus = 404\n`);
  assert.equal(out.redirects, "");
  assert.match(out.routes, /export const PAGE_404 = "\/erreur.html";/);
});

test("un meme en-tete dans _headers et netlify.toml n'est pas double : netlify.toml l'emporte", () => {
  const toml = `[[headers]]\nfor = "/*"\n[headers.values]\nX-Frame-Options = "DENY"\nPermissions-Policy = "camera=()"\n`;
  const out = convertir(toml, { publicHeaders: "/*\n  X-Frame-Options: DENY\n  Permissions-Policy: geolocation=()\n/a/*\n  Cache-Control: no-store\n" });
  assert.equal((out.headers.match(/X-Frame-Options/g) || []).length, 1);
  assert.match(out.headers, /Permissions-Policy: camera=\(\)/);
  assert.match(out.headers, /^\/a\/\*\n  Cache-Control: no-store$/m);
});
