// Contrat des variables lues à l'exécution, étendu aux fonctions JS et TypeScript.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
export function variablesLues(source) {
  const noms = new Set();
  for (const motif of [/(?:getEnv|(?:Netlify\.)?env\.get)\(\s*["']([A-Z][A-Z0-9_]*)["']/g, /(?:process\.env|env)\.([A-Z][A-Z0-9_]*)/g, /(?:process\.env|env)\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\]/g]) {
    for (const m of source.matchAll(motif)) noms.add(m[1]);
  }
  return noms;
}
export function sources(dossier) {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) return sources(chemin);
    return /\.(mjs|js|ts)$/.test(entree.name) && !/\.(test|spec)\./.test(entree.name) ? [readFileSync(chemin, "utf8")] : [];
  });
}
