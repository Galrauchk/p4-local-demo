# AGENTS.md - p4-local-demo

<!-- socle-webtrafic:debut (copie de webtrafic-workspace/50_OPERATIONS_TECH/docs/socle-agents.md, ne pas editer ici) -->

## Socle WebTrafic (commun à tous les dépôts)

- Répondre en français. Code et messages de commit en anglais (commits conventionnels), contenus
  et commentaires métier en français.
- Jamais de tiret cadratin ni demi-cadratin, partout (code, commits, PR, docs, contenus) : le
  trait d'union seulement. Contrôle : `perl -CSD -ne 'print if /\x{2014}|\x{2013}/' <fichiers>`.
- Jamais de secret, de `.env`, de donnée personnelle ni d'information interne publiés. Un secret
  ne s'affiche pas et ne passe jamais en argument shell (fichier ou stdin).
- Contenu web public : l'identité de l'agence (nom de l'exploitant, adresse, SIRET, téléphone,
  e-mail) est publiable sur ses propres sites depuis le 07/10/2026 ; jamais de donnée personnelle
  sensible. Un site client porte l'identité du client. Si `scripts/check-pii.mjs` existe, il est
  bloquant.
- Aucun nom de partenaire ou de fournisseur interne dans un contenu destiné au public ou au client.
- Dépôt d'un site client : pied de page « Site réalisé par WebTrafic » avec lien dofollow vers
  `https://webtrafic.fr/` ; commits avec `--author="WebTrafic <contact@webtrafic.fr>"`, sans
  `Co-Authored-By` ; toute PR porte une section `## Pour le client` (1 à 3 puces, langage client,
  aucune donnée interne).
- Qui tranche (16/10/2026) : sur un projet interne ou un produit de l'agence, l'IA décide selon le
  retour sur investissement, seule limite toute dépense (à demander avant, avec alternative gratuite
  ou faite maison) ; sur un client, seule la décision de Jeffrey tranche et aucun message ne lui
  part sans elle. Suppression seulement après sauvegarde restaurée. Un mail à un client le tutoie.
- Avant de pousser : les vérifications du dépôt passent (site : `npm run build` sans erreur ni
  warning ; app : lint, test, build). Aucun test supprimé pour faire passer la CI, aucun
  force-push.
- Ne rien inventer : une information manquante devient un `TODO` explicite. Ne pas annoncer comme
  fait ce qui est seulement prévu ; une preuve est une commande et sa sortie.
- Règles complètes et décisions : dépôt `Galrauchk/webtrafic-workspace`, fichier `AGENTS.md`. Ce
  dépôt précise ; le workspace fait foi sur les principes.

<!-- socle-webtrafic:fin -->

## Ce dépôt

Gabarit de démonstration `P4` du catalogue WebTrafic (Astro). Base de duplication des sites
clients via `create-site` (workspace). DÉPÔT PUBLIC.

## Commandes

`npm ci`, `npm run dev`, `npm run build`.

## Règles propres

- Dépôt public : aucune donnée client, aucun contenu ou nom interne, aucun secret.
- Contenu fictif seulement ; une correction utile à tous les sites se reporte aussi dans le
  gabarit source du catalogue.
