// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Domaine reel du site. Lu par ContactTracking.astro pour identifier le site aupres du
  // CRM : sans lui le build echoue, plutot que de publier une mesure anonyme ou attribuee
  // au mauvais client. A remplacer par le domaine definitif lors de la creation d'un site.
  site: 'https://p4-local-demo.netlify.app',

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()]
  }
});