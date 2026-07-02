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
    'site-wordmark',
    'plss-mark',
    'wordmark-text',
    'site-footer',
    'footer-credit',
    'footer-meta',
    'launch-announcement',
    'reading-card',
    'cover',
    'plss-pattern',
    'meta',
    'byline',
    'abstract',
    'toc',
    'cta',
    'astl-field-block',
    'attribution',
    'see-also',
    'voices-article',
    'voices-card',
    'cta-box',
    'dek',
    'source-page',
    'provisional-note',
    'state-appendix',
    'cross-link',
    'faq-q',
  ],
  theme: {
    extend: {
      fontFamily: {
        // 2026-07-02 shared-palette re-skin: Newsreader/Public Sans, matching
        // the schooltrustlands.net redesign (commit 5484652 in that repo).
        serif: [
          'Newsreader',
          '"Source Serif 4"',
          '"Iowan Old Style"',
          'Georgia',
          'Cambria',
          '"Times New Roman"',
          'Times',
          'serif',
        ],
        sans: [
          '"Public Sans"',
          'Inter',
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
          DEFAULT: '#1b3252',
          dark: '#14243c',
        },
        // Visual identity palette — 2026-07-02 shared-palette re-skin.
        // Values aligned with the schooltrustlands.net navy/gold/cream
        // redesign tokens; token NAMES preserved so existing class usage
        // continues to work.
        ink: '#1a1a2e',
        'trust-blue': '#1b3252',
        'deep-navy': '#14243c',
        'archive-paper': '#f5f1e8',
        'linen-card': '#FFFDF7',
        'rule-border': '#D8D1C2',
        'old-gold': '#a87f2c',
        sage: '#6F7F52',
        oxblood: '#7A2E2E',
        // Stock-utility remaps: ~108 files use default Tailwind blue/slate/
        // white classes. Remapping the scales here re-skins them all to the
        // shared navy/warm-grey/linen family without touching content.
        white: '#fffdf7',
        blue: {
          50: '#eef1f6',
          100: '#dfe5ee',
          200: '#c9d2e0',
          300: '#a8b6cb',
          400: '#7c8fae',
          500: '#4f668c',
          600: '#33496e',
          700: '#1b3252',
          800: '#16294a',
          900: '#14243c',
          950: '#0e1b2e',
        },
        slate: {
          50: '#f8f5ed',
          100: '#f0ebdd',
          200: '#e3dcca',
          300: '#d2c8b2',
          400: '#7c889b',
          500: '#5f6c80',
          600: '#4c5a70',
          700: '#3a4a60',
          800: '#2c3a50',
          900: '#1c2940',
          950: '#131e30',
        },
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
