// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://p4-local-demo.netlify.app',
  integrations: [
    react(),
    sitemap({
      filter: (page) =>
        !page.includes('/politique-confidentialite') &&
        !page.includes('/politique-cookies'),
    }),
  ],

  vite: {
    plugins: [tailwindcss()]
  }
});
