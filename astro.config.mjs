// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';
import remarkStripVerify from './scripts/remark-strip-verify.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://schooltrusts.net',
  // The Forever Promise review room is a passcode gate handled entirely in
  // middleware (same-origin POST). Astro 5's default CSRF checkOrigin rejects
  // form POSTs whose Origin header is absent/mismatched with 403
  // 'Cross-site POST form submissions are forbidden', which broke the unlock.
  // Disable it to restore the working gate (the only on-demand POST surfaces
  // are this gate + the fp-suggest/comment endpoints, all legitimate).
  security: { checkOrigin: false },
  output: 'static',
  integrations: [tailwind()],
  adapter: cloudflare(),
  markdown: {
    remarkPlugins: [remarkStripVerify],
  },
});
