# `src/data/zybach_desk/`: approved office replies

One JSON file per approved reply from Bob's office, written by
`scripts/office/publish-packet.mjs` from a packet that Dave downloaded on
`/office/admin/`. Each file becomes `/collections/zybach/desk/<slug>/`.
Do not hand-edit; re-run the script. To take a page down, delete its JSON
file (and its folder under `public/collections/zybach/desk/<slug>/`) and commit.
