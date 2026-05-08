# Banner credits — v10 (2026-05-08)

Six signature banner images, one per room. All sourced from the Library of
Congress digital collections; LOC photographs of this vintage are in the
public domain (no known restrictions on publication). Source links and
photographer credits below per LOC item record.

## v10 update — 2026-05-08

All six banners recomposed to **1200×240** with horizontal cropping that
preserves each room's editorial focus, using `sharp` (mozjpeg, q84) against
the highest-resolution LOC source available for each item — TIFF masters
where digitized, larger `v.jpg` derivatives otherwise. CSS no longer needs
to upscale or stretch.

Two images were replaced from v9:

- **Atlas** — was a bird's-eye view of San Francisco (1878 Currier &
  Ives). Replaced with an interior photograph of the Library of Congress
  Map Division reading room (Levin C. Handy, ca. 1900–1930) so the room
  reads clearly as a cartographic archive rather than a single map.
- **Voices** — was Harris & Ewing 1937 Senate Civil Liberties Committee
  testimony (Chicago police). Per the repository convention that
  library-institutional surfaces should not telegraph litigation, replaced
  with a Theodor Horydczak photograph of a public lecture in an
  auditorium — speaker upstage, audience filling the hall — which reads
  as civic-podium / editorial-voice rather than courtroom.

## Per-room

- **Reading Room** — `reading.jpg`. *Library of Congress (Jefferson
  Building). Main Reading Room, Library of Congress.* Photographer:
  Theodor Horydczak (ca. 1890–1971). Source:
  https://www.loc.gov/pictures/item/2019685011/ — TIFF master:
  https://cdn.loc.gov/master/pnp/thc/5a50000/5a50700/5a50787u.tif
  License: Public domain (no known restrictions, LOC).

- **Atlas** — `atlas.jpg`. *Library of Congress, Map Division quarters,
  north curtain, second floor.* Photographer: Levin C. Handy (1855–1932),
  ca. 1900–1930. Source:
  https://www.loc.gov/pictures/item/96504174/ — TIFF master:
  https://cdn.loc.gov/master/pnp/cph/3b20000/3b22000/3b22300/3b22345u.tif
  License: Public domain (no known restrictions, LOC).

- **Counting House** — `counting.jpg`. *Miscellaneous interiors. Bank
  interior, to counters and vault.* Photographer: Theodor Horydczak.
  Source: https://www.loc.gov/pictures/item/2019680818/ — TIFF master:
  https://cdn.loc.gov/master/pnp/thc/5a44000/5a44300/5a44356u.tif
  License: Public domain (no known restrictions, LOC).

- **Map Room** — `maps.jpg`. *Geological Survey, Washington, D.C.,
  Mar. 13. Lithographic draftsmen correcting the printing.* Photographer:
  Harris & Ewing. Source:
  https://www.loc.gov/pictures/item/2016871361/ — service JPEG:
  https://tile.loc.gov/storage-services/service/pnp/hec/22300/22384v.jpg
  License: Public domain (no known restrictions, LOC).

- **Newsroom** — `newsroom.jpg`. *Newsroom of the New York Times
  newspaper. Ten o'clock is news room deadline.* Source: FSA/OWI
  Collection. https://www.loc.gov/pictures/item/2017837891/ — service
  JPEG:
  https://tile.loc.gov/storage-services/service/pnp/fsa/8d22000/8d22600/8d22688v.jpg
  License: Public domain (no known restrictions, LOC).

- **Voices** — `voices.jpg`. *Electric Institute of Washington, Potomac
  Electric Power Co. Lecture in auditorium.* Photographer: Theodor
  Horydczak. Source:
  https://www.loc.gov/pictures/item/2019674465/ — TIFF master:
  https://cdn.loc.gov/master/pnp/thc/5a44000/5a44900/5a44934u.tif
  License: Public domain (no known restrictions, LOC).

## Notes on resolution ceilings

The Theodor Horydczak negative collection (LOC `thc/`) was digitized at a
modest resolution: even the TIFF masters are ~340–540 px on the long edge.
For Reading, Counting, and Voices we recompose from the TIFF master rather
than the JPEG derivative, which yields cleaner downscaling and crop
control than CSS `object-fit: cover`, but does not exceed the source
resolution. The Atlas (Handy / `cph/`) and Maps / Newsroom (Harris&Ewing
and FSA/OWI) sources are substantially larger (1024–1536 px on the long
edge).
