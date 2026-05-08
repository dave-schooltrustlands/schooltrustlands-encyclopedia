America's School Trust Library — seal asset directory.

This directory is the integration site for the Library seal. The seal
itself is generated Cowork-side (ChatGPT prompt bundle) and lands here
as `library-seal-v1.png` in a separate small commit.

Site Update v9 (Super-agent DELTA, D.2) prepared the integration
sites in:
  - src/pages/index.astro          (lobby home-page floor inlay; Library Mode only)
  - src/pages/about.astro          (header mark)
  - src/components/Footer.astro    (small footer mark)

Each placement uses an `onerror="this.style.display='none'"` handler so
the placeholder degrades gracefully until the asset is dropped in. CSS
sizing for `.library-seal`, `.library-seal--inlay`,
`.library-seal--header`, `.library-seal--footer` lives in
`src/styles/global.css`; mode-specific reveal/hide rules live in
`src/styles/mode-library.css` and `src/styles/mode-reference.css`.

Do NOT generate a fake seal here. The placeholder text/comment in this
file is the placeholder. The image arrives in a follow-up commit.
