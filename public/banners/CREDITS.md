# Banner credits — v9

Six signature banner images, one per room. All sourced from the Library of
Congress digital collections; LOC photographs of this vintage are in the
public domain (no known restrictions on publication). Source links and
photographer credits below per LOC item record.

These are the LOC "r" reduced JPEGs (339–640 px wide). They are smaller than
the v9 banner-image target (~1200 px wide) and will be visually stretched
and cropped by `object-fit: cover; max-height: 240px` in CSS. The
integration site (banner placement + banner CSS) is the load-bearing v9
ship; the next pass should replace these with higher-resolution LOC service
files where available, or recompose at 1200×240 with ImageMagick once it
is installed in the dev environment.

## Per-room

- **Reading Room** — `reading.jpg`. *Library of Congress (Jefferson
  Building). Main Reading Room, Library of Congress.* Photographer:
  Theodor Horydczak (ca. 1890–1971). Source:
  https://www.loc.gov/pictures/item/2019685011/ — direct image:
  https://tile.loc.gov/storage-services/service/pnp/thc/5a50000/5a50700/5a50787r.jpg
  License: Public domain (no known restrictions, LOC).

- **Atlas** — `atlas.jpg`. *The City of San Francisco. Bird's-eye view
  from the bay looking south-west.* Source:
  https://www.loc.gov/pictures/item/90715988/ — direct image:
  https://tile.loc.gov/storage-services/service/pnp/ppmsca/08900/08933r.jpg
  License: Public domain (no known restrictions, LOC).

- **Counting House** — `counting.jpg`. *Miscellaneous interiors. Bank
  interior, to counters and vault.* Photographer: Theodor Horydczak.
  Source: https://www.loc.gov/pictures/item/2019680818/ — direct image:
  https://tile.loc.gov/storage-services/service/pnp/thc/5a44000/5a44300/5a44356r.jpg
  License: Public domain (no known restrictions, LOC).

- **Map Room** — `maps.jpg`. *Geological Survey, Washington, D.C.,
  Mar. 13. Lithographic draftsmen correcting the printing.* Photographer:
  Harris & Ewing. Source:
  https://www.loc.gov/pictures/item/2016871361/ — direct image:
  https://tile.loc.gov/storage-services/service/pnp/hec/22300/22384r.jpg
  License: Public domain (no known restrictions, LOC).

- **Newsroom** — `newsroom.jpg`. *Newsroom of the New York Times
  newspaper. Ten o'clock is news room deadline.* Source: FSA/OWI
  Collection. https://www.loc.gov/pictures/item/2017837891/ — direct
  image:
  https://tile.loc.gov/storage-services/service/pnp/fsa/8d22000/8d22600/8d22688r.jpg
  License: Public domain (no known restrictions, LOC).

- **Voices** — `voices.jpg`. *Testimony of Chicago cop climaxes stormy
  session of Civil Liberties Committee, Washington, D.C., July 1, 1937.*
  Photographer: Harris & Ewing. Source:
  https://www.loc.gov/pictures/item/2016871945/ — direct image:
  https://tile.loc.gov/storage-services/service/pnp/hec/22900/22970r.jpg
  License: Public domain (no known restrictions, LOC).

## TODOs for the next pass

1. Upgrade each image to a higher-resolution LOC service file (the
   `_servicefile.jpg` variant where available) and recompose to ~1200×240
   with horizontal cropping that preserves the editorial focus.
2. Consider whether the **Voices** photo (Civil Liberties Committee
   testimony) reads as litigation-adjacent rather than editorial-voice
   adjacent. Per the user-memory note "library-institutional surfaces
   don't telegraph litigation," a softer image of a civic podium / public
   reading / testimony hall may be preferable. Candidate replacement
   queries: "civic forum", "town hall meeting", "public reading hall".
3. Confirm with the user whether the Atlas bird's-eye view of San
   Francisco is the right metaphor for the Atlas, or whether a Sanborn
   wall-map workshop image would read more clearly as cartographic
   archive. Candidate replacement: any of the Sanborn fire-insurance map
   results in the LOC HABS/HAER collection.
4. Optimize file sizes once a target image-quality pipeline (ImageMagick
   or similar) is available in dev.
