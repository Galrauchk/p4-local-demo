// Test après build : une variable oubliée doit bloquer la livraison.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "smol-toml";
import { variablesLues, sources } from "../scripts/worker-env.mjs";

test("la sonde détecte les lectures et un oubli de variable", () => {
  const detectees = variablesLues(`getEnv("PUBLIC_EXEMPLE"); process.env.SECRET_TEST; Netlify.env.get('CLE'); env['AUTRE'];`);
  assert.deepEqual([...detectees].sort(), ["AUTRE", "CLE", "PUBLIC_EXEMPLE", "SECRET_TEST"]);
  assert.equal([...detectees].filter((nom) => !new Set(["CLE"]).has(nom)).length, 3);
});

test("chaque variable lue par les fonctions est déclarée dans le Worker", () => {
  const texte = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  const conf = parse(texte);
  const declarees = new Set([...Object.keys(conf.vars || {}), "ASSETS"]);
  for (const m of texte.matchAll(/^# secrets = \[(.*)\]$/gm)) {
    for (const s of m[1].matchAll(/"([A-Z0-9_]+)"/g)) declarees.add(s[1]);
  }
  for (const binding of [...(conf.kv_namespaces || []), ...(conf.d1_databases || [])]) declarees.add(binding.binding);
  const racine = new URL("../", import.meta.url).pathname;
  const textes = ["netlify/functions", "netlify/edge-functions", "worker"].flatMap((d) => sources(racine + d));
  const lues = new Set(textes.flatMap((s) => [...variablesLues(s)]));
  assert.deepEqual([...lues].filter((nom) => !declarees.has(nom)).sort(), []);
});
