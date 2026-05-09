// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';
import remarkStripVerify from './scripts/remark-strip-verify.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://schooltrusts.net',
  output: 'static',
  integrations: [tailwind()],
  adapter: cloudflare(),
  markdown: {
    remarkPlugins: [remarkStripVerify],
  },
});
