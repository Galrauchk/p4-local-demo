// Les identifiants restent en mémoire, jamais dans les arguments du processus.
import assert from "node:assert/strict";
const url = process.env.PREVIEW_URL;
assert.ok(url && /^https:\/\/pr-[a-z0-9.-]+\.workers\.dev$/.test(url), "URL d'aperçu invalide");
const anon = await fetch(url, { redirect: "manual" });
assert.ok([302, 401, 403].includes(anon.status), "Aperçu public : configurer Cloudflare Access avant activation");
assert.ok(process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET, "Identifiants Access absents");
const headers = { "CF-Access-Client-Id": process.env.CF_ACCESS_CLIENT_ID, "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET };
const page = await fetch(url, { headers, redirect: "manual" });
assert.equal(page.status, 200);
assert.match(page.headers.get("x-robots-tag") || "", /noindex/);
const robots = await fetch(url + "/robots.txt", { headers, redirect: "manual" });
assert.equal(robots.status, 200);
assert.match(await robots.text(), /^Disallow: \/$/m);
