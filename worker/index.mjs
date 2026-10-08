// Migration Cloudflare : fichiers statiques, coeur Electium inchangé.
import { creerServeur } from "./serveur.mjs";
import { PAGE_404, PAGES_STATUT } from "./routes.generated.mjs";

export default creerServeur({ fonctions: {}, pages: PAGES_STATUT, page404: PAGE_404 });
