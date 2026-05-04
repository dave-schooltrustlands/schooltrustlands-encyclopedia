import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  // Layout primitives from the Visual Rebuild Handoff are intended to be
  // available globally so authors can opt in by adding the class. Tailwind's
  // tree-shaker would otherwise strip them on first build because they're
  // not yet referenced in any source file.
  safelist: [
    'chapter-opener',
    'kicker',
    'opener-figure',
    'pull-quote',
    'dossier-card',
    'dossier-image',
    'dossier-facts',
    'archival-divider',
    'badge',
    'badge-verified',
    'badge-awaiting',
    'badge-na',
    'badge-conflict',
    'badge-pending',
    'eyebrow',
    'atlas-header-strip',
    'site-wordmark',
    'plss-mark',
    'wordmark-text',
    'site-footer',
    'footer-credit',
    'footer-meta',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: [
          '"Source Serif 4"',
          '"Iowan Old Style"',
          '"Libre Baskerville"',
          'Charter',
          'Georgia',
          'Cambria',
          '"Times New Roman"',
          'Times',
          'serif',
        ],
        sans: [
          'Inter',
          '"Source Sans 3"',
          '"IBM Plex Sans"',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        // Existing accent kept for backward compatibility (== trust-blue).
        accent: {
          DEFAULT: '#1d4f7c',
          dark: '#163b5d',
        },
        // Visual identity palette (Visual Rebuild Handoff v0).
        ink: '#17202A',
        'trust-blue': '#1D4F7C',
        'deep-navy': '#1F2A44',
        'archive-paper': '#FAF9F6',
        'linen-card': '#FFFDF7',
        'rule-border': '#D8D1C2',
        'old-gold': '#B88A2E',
        sage: '#6F7F52',
        oxblood: '#7A2E2E',
        // Semantic / confidence-badge colors.
        verified: '#2F6F4E',
        'awaiting-disclosure': '#B7791F',
        'not-applicable': '#8B8F98',
        'source-conflict': '#B42318',
        pending: '#5E5A8A',
      },
    },
  },
  plugins: [typography],
};
