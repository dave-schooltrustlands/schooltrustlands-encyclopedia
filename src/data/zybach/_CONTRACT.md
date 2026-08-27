# `src/data/zybach/` — data contract

Generated 2026-08-27 by `zybach pipeline build_data.py` v1.0
(source: `/home/claude/zybach_build/records/`, generator:
`/home/claude/zybach_build/pipeline/build_data.py`).

Everything here is generated. **Do not hand-edit** — re-run the generator instead.
All files are UTF-8, pretty-printed with 2-space indent, `ensure_ascii=False`.
`_READY` exists when a complete generation has been written; `_READY_v2` when the
records repaired by the REPAIR agent have been regenerated.

## URL scheme these files encode

Every `href` in this data is a site-absolute path, ready to drop into `<a href>`:

```
/collections/zybach/                                    finding aid
/collections/zybach/{series-slug}/                      inventory series
/collections/zybach/soap-creek/                          Soap Creek series page
/collections/zybach/soap-creek/{mono-slug}/              monograph
/collections/zybach/soap-creek/{mono-slug}/{chapter}/    chapter transcript, page anchors #pNN
/collections/zybach/soap-creek/thesis/  /auto-tour/  /auto-tour/stop-{n}/
/collections/zybach/soap-creek/index/  /index/{a..z}/     series index
/collections/zybach/soap-creek/places/{slug}/  /people/{slug}/  /timeline/{period-slug}/
/collections/zybach/elliott/                             Elliott series page
/collections/zybach/elliott/interviews/{YYYYMMDD}/       interview, page anchors #pNN, tape anchors #tape-XX
/collections/zybach/elliott/videos/{video_id}/  /places/{slug}/  /maps/  /photos/  /recordings/
```

A citation `05:47` resolves as
`monographs.json → the record with number 5 → page_to_chapter["47"] → "<chapter>"`
→ `/collections/zybach/soap-creek/m05-rohner/<chapter>/#p47`.

## Files

| file | size | what it is |
| --- | ---: | --- |
| `collection.json` | 14.3 KB | collection-level record: series list, counts, provenance, rights, creator, colophon |
| `content_notes.json` | 75.5 KB | collection statement + page-level notes (high and medium severity only) |
| `holds.json` | 2.2 KB | pages held from display in this preview |
| `soap_creek/monographs.json` | 905.1 KB | the fifteen monographs: metadata, structure, chapters, `page_to_chapter` |
| `soap_creek/gazetteer.json` | 2.12 MB | 1071 places with mentions and evidence |
| `soap_creek/gazetteer.geojson` | 144.4 KB | 281 point features for `ZybachMap` |
| `soap_creek/_withheld_places.json` | 1.8 KB | places withheld from the public gazetteer, with the reason |
| `soap_creek/people.json` | 510.8 KB | 59 full records (narrators, interviewers, contributors) |
| `soap_creek/people_index.json` | 1.42 MB | 1311 named people with page mentions, for the index |
| `soap_creek/series_index.json` | 1.07 MB | the living series index: metadata, counts and a headings-only list |
| `soap_creek/series_index/{a..z, other}.json` | 433.0 KB (a) … | full entries with refs, one file per letter page |
| `soap_creek/chronology.json` | 1.85 MB | 1571 dated statements in Bob's nine book periods |
| `soap_creek/thesis.json` | 395.2 KB | the 1999 M.A.I.S. thesis record |
| `soap_creek/autotour.json` | 153.3 KB | the 1989 Auto Tour: eleven stops, verbatim |
| `elliott/interviews.json` | 262.8 KB | interviews → tapes → segments, with hrefs and MP3 URLs |
| `elliott/gazetteer.json` | 136.5 KB | Elliott places |
| `elliott/gazetteer.geojson` | 48.3 KB | Elliott point features |
| `elliott/videos.json` | 236.6 KB | ORWWmedia playlist with time-coded segments and embed URLs |
| `elliott/recordings.json` | 38.5 KB | MP3 link register |
| `elliott/photos.json` | 95.4 KB | photograph link register grouped by date then place |
| `elliott/maps.json` | 46.4 KB | map link register |

### Soap Creek transcripts (one file per monograph)

| file | size | contents |
| --- | ---: | --- |
| `soap_creek/transcripts/zc-sc-m01.json` | 302.5 KB | 16 chapters, 562 entries |
| `soap_creek/transcripts/zc-sc-m02.json` | 302.0 KB | 30 chapters, 462 entries |
| `soap_creek/transcripts/zc-sc-m03.json` | 496.4 KB | 20 chapters, 983 entries |
| `soap_creek/transcripts/zc-sc-m04.json` | 365.5 KB | 25 chapters, 696 entries |
| `soap_creek/transcripts/zc-sc-m05.json` | 962.9 KB | 45 chapters, 1861 entries |
| `soap_creek/transcripts/zc-sc-m06.json` | 722.1 KB | 18 chapters, 1564 entries |
| `soap_creek/transcripts/zc-sc-m07.json` | 1.25 MB | 36 chapters, 2472 entries |
| `soap_creek/transcripts/zc-sc-m08.json` | 1.57 MB | 43 chapters, 2916 entries |
| `soap_creek/transcripts/zc-sc-m09.json` | 1.35 MB | 26 chapters, 3171 entries |
| `soap_creek/transcripts/zc-sc-m10.json` | 744.8 KB | 32 chapters, 1265 entries |
| `soap_creek/transcripts/zc-sc-m11.json` | 1.38 MB | 7 chapters, 2999 entries |
| `soap_creek/transcripts/zc-sc-m12.json` | 865.1 KB | 31 chapters, 1726 entries |
| `soap_creek/transcripts/zc-sc-m13.json` | 609.2 KB | 28 chapters, 1038 entries |
| `soap_creek/transcripts/zc-sc-m14.json` | 587.4 KB | 29 chapters, 1113 entries |
| `soap_creek/transcripts/zc-sc-m15.json` | 1021.1 KB | 12 chapters, 1702 entries |

### Elliott transcripts (one file per transcript record)

| file | size | contents |
| --- | ---: | --- |
| `elliott/transcripts/zc-el-s19621008-larson.json` | 103.5 KB | 214 entries, 11 pages, 2 anchors |
| `elliott/transcripts/zc-el-s19651111-larson.json` | 121.9 KB | 281 entries, 9 pages, 2 anchors |
| `elliott/transcripts/zc-el-s20080503-jacobson.json` | 145.3 KB | 237 entries, 17 pages, 19 anchors |
| `elliott/transcripts/zc-el-s20150120-jacobson.json` | 148.3 KB | 253 entries, 16 pages, 15 anchors |
| `elliott/transcripts/zc-el-s20171006-phillips.json` | 64.7 KB | 93 entries, 7 pages, 27 anchors |
| `elliott/transcripts/zc-el-s20171010-phillips.json` | 942.0 KB | 2442 entries, 134 pages, 57 anchors |
| `elliott/transcripts/zc-el-s20171108-gould-edits.json` | 868.2 KB | 2196 entries, 111 pages, 129 anchors |
| `elliott/transcripts/zc-el-s20171108-phillips.json` | 1.17 MB | 3157 entries, 175 pages, 53 anchors |
| `elliott/transcripts/zc-el-s20171128-jacobson.json` | 141.9 KB | 253 entries, 24 pages, 13 anchors |
| `elliott/transcripts/zc-el-s20171206-phillips.json` | 1.12 MB | 3026 entries, 171 pages, 49 anchors |
| `elliott/transcripts/zc-el-s20181010-gould.json` | 237.0 KB | 542 entries, 35 pages, 19 anchors |
| `elliott/transcripts/zc-el-s20191111-gould.json` | 57.4 KB | 26 entries, 6 pages, 0 anchors |

---

## `collection.json`

- `name`, `subtitle`, `generated`, `generator`, `generator_version`, `href`
- `series[]` — `{slug, code, title, kind:'item-level'|'inventory', href, dates?, summary, counts}`.
  Inventory series also carry `summary_basis[]` (what the summary was written from),
  `public_sources[]` and `described_from`.
- `counts` — `{series, item_level_series, inventory_series, soap_creek{…}, elliott{…}, accessioned_files}`
- `provenance` — `{accession_statement, upload_dates[], upload_branches{}, accessioned_files,
  owner, public_sources[{label,url}]}`
- `rights` — `{statement, statement_source, draft:true, note, per_series[{series,statement,draft}]}`
- `creator` — `{display_name, bio_source_note, bio_text_draft_flag:true, bio_text, links[]}`.
  **`bio_text` is a draft carried over from the demonstration page. Label it as a draft for Bob's edit.**
- `colophon` — `{what_the_fleet_did[], what_it_did_not_do[], models[], dates{}}`

## `soap_creek/monographs.json`

An **array** of 15 objects, ordered by `number`:

- identity: `zc_id`, `slug` (`m05-rohner`), `number`, `href`
- `narrators[]` — `{display_name, person_slug, name_variants[], born, died, profession,
  home_site, confidence, href}`
- as printed: `title`, `subtitle`, `citation_canonical` (**verbatim — print it exactly**),
  `citation_short`, `year_printed`, `printing`, `publisher`, `authors[]`
- `pages_printed` (last arabic folio), `pages_cited` (the page count in the citation),
  `pages_covered` (last page the chapters actually reach — larger than `pages_printed` where
  the monograph ends in unfoliated leaves, e.g. #01's appendix),
  `unfoliated_pages_after_last_folio[]`
- `pdf_url`, `cover_url` (nwmapsco `-10.jpg`), `thumb_url` (`-2.jpg`), `source`
  (`{public_url, local_file, sha256, scan_type}` — sha256 is the provenance checksum)
- `sessions[]` (`{session_id, date, place, interviewers[], mode, notes, confidence}`),
  `contributors[]` (`{name, role, source_page}`), `front_matter{}` (cover text,
  acknowledgements, project statement, introduction, map note, series list where printed),
  `plates` (null unless the record carries one)
- `structure[]` — the full printed hierarchy: `{level, label, title, slug, start_page,
  end_page, session_id, map_key, chapter_type, href}`. `level` is
  `front|part|chapter|appendix|index`. `start_page`/`end_page` are **as printed**
  (int, roman string, or a bracketed label); `slug` is the chapter the entry lands in.
- `chapters[]` — the transcript's chapter units: `{slug, level, label, title, start_page,
  end_page, pages:[first,last], page_count, session_id, map_key, chapter_type, href}`
- `front_matter_chapter` — the `front-matter` chapter (`front_sections[]` lists the leaves)
- `page_to_chapter` — `{"47": "part-ii-…"}` for **every** page `1..pages_covered`
- `photographs[]`, `maps[]` — as printed, plus `page_int` and `href`; items on a held page are omitted
- `content_notes[]` — `{page, level:'page', severity, category, display_note, href}`
- `holds[]` — `{pages:[a,b], page_list[], what, reason}`
- `quality` — `{ocr_error_rate_sample, speaker_turn_method, self_assessment, pages_failed[],
  known_gaps[], ocr_fix_count, page_anchor_hit_rate, page_rule_used}`
- `index_drift` (bool), `index_drift_note` (string or null), `missing_pages[]`
- `counts` — chapters, transcript_entries, photographs, maps, index_entries,
  places_mentioned, dated_statements, content_notes, held_pages

## `soap_creek/transcripts/{zc_id}.json`

`{zc_id, mono_slug, monograph_number, title, pages_printed, generated, speaker_legend,
holds[], counts, chapters[]}`

- `speaker_legend` — `{narrator, narrator_2, interviewers[], inferred_note, method}`.
  Use `inferred_note` for the once-per-page footnote the spec asks for.
- `chapters[]` — `{slug, title, label, level, start_page, end_page, pages[], session_id,
  chapter_type, href, has_held_pages, attribution_inferred, entries[]}`.
  `attribution_inferred: true` means at least one turn on this chapter's pages was attributed
  from typography rather than a printed speaker label — that is what triggers the
  "attribution inferred from typography" footnote (once per page, not per turn).
  The `front-matter` chapter also carries `front_sections[]`.
- `entries[]` — `{page, seq, speaker, speaker_name, speaker_role, speaker_display,
  speaker_inferred, speaker_confidence, text, bracketed_corrections[], chapter_ref?, held?}`
  - `speaker` is the printed token: `Q | A | narrator-2 | heading | caption | editorial`.
  - `speaker_role` is resolved: `interviewer | narrator | heading | caption | editorial`.
  - `speaker_display` is the name to print (`"Bob Zybach"`, the narrator's name, or `null`
    for headings/captions/editorial). `speaker_inferred: true` means the name came from the
    session record, not from the page — footnote it once per page.
  - `page` is the printed folio (int) or the printed label for front matter.
  - A held page carries exactly one entry with `held: true` and the hold notice as `text`.
- Every page in `page_to_chapter` appears in exactly one chapter.

## `soap_creek/gazetteer.json` / `.geojson`

`places[]` — `{slug, name, variants[], kind, lat, lon, method, confidence, bbox_ok, note,
geocode_source, auto_tour_stop, tour_letters[], narrator_home_of[], mention_count,
record_count, href, mentions[], evidence[]}`.
`mentions[]` = `{zc_id, mono_slug, record_href, pages[], page_links[{page, href}]}`.
`evidence[]` = `{zc_id, page, quote, href}` — quotes are verbatim; evidence on a held page is dropped.
GeoJSON `properties` = `{slug, name, kind, confidence, method, title, subtitle, href}` —
exactly what `ZybachMap.astro` popups expect. **A map must also have the equivalent list.**

`_withheld_places.json` lists places withheld as American Indian burial/grave/artifact sites,
with `matched_on` and `reason`. Do not render them.

## `soap_creek/people.json` / `people_index.json`

`people.json` — full records for narrators, interviewers and contributors:
`{slug, display_name, sort_name, name_variants[], entity_type, roles[], role_credits[],
narrator_of[{zc_id, mono_slug, href}], born, died, lifetime_as_printed, profession,
interview_focus, home_site, sessions[], mentioned_in[], family_links[], conflicts[],
sources[], confidence, notes[], href, is_narrator}` — these get `/people/{slug}/` pages.
`people_index.json` — every named person (`slug, display_name, sort_name, entity_type,
roles[], mentions[], mention_count`) for the Series Index. **Not pages.**

## `soap_creek/series_index.json` + `soap_creek/series_index/{letter}.json`

The index is split so the landing page does not import 6 MB.

`series_index.json` = `{generated, title, note, method_notes[], drift, confidence,
letters_present[], letter_hrefs{}, letter_files{}, letter_file_names{}, headings{},
counts, note_on_files}`.
- `letters_present` — `["A", …, "Z", "#"]`; `"#"` is for headings that do not start with a
  letter and its page is `/index/other/`.
- `letter_hrefs["A"]` → `/collections/zybach/soap-creek/index/a/`; `letter_files["A"]` → `series_index/a.json`.
- `headings["A"]` — `[{entry_id, heading, kind, ref_count, subentry_count, first_ref}]`,
  enough to render the index landing page without loading any letter file.

`series_index/{letter}.json` = `{generated, letter, letter_file, href, counts, entries[]}`.
Entry:
`{entry_id, heading, kind, concordance_category, variants[], monographs[], refs[],
subentries[{subheading, refs[], count}], see[], see_also[], confidence, kind_confidence, ref_count}`.
Ref: `{zc_id, mono_slug, mono_number, page, page_kind, printed, ref ("05:47"), href,
page_verified, page_corrected, confidence}`. **Every ref carries a working href.**
`page_kind` is `"body"` (page is an int, href ends `/{chapter}/#pNN`) or `"front-matter"`
(page is a roman numeral string such as `"v"`, href ends `/front-matter/#pv` — so the
front-matter chapter needs `<section id="pv">` per roman leaf). Refs that could not be
resolved at all are dropped at build time and counted in `counts.refs_dropped_unresolvable`
(currently 0).

## `soap_creek/chronology.json`

`{generated, title, method_notes[], period_note, counts, conflicts[], events_top[],
named_events_top[], counts_by_narrator{}, gaps[], periods[]}`.
`periods[]` = `{slug, label, range, href, count, entries[]}` in Bob's book-period order.
Entry: `{entry_id, date, date_label, date_parts, precision, label, statement (verbatim),
narrator, narrator_confidence, zc_id, mono_slug, record_label, page, href, places[],
place_ids[], people[], person_ids[], event_key, event_key_type, conflict, conflict_note,
href_precision, confidence}`. Statements from held pages are dropped.
`href_precision` is `"page"` when the source printed a page, otherwise `"record"` — those
entries (front-matter and caption statements) link to the monograph, not to a `#pNN` anchor.

## `soap_creek/autotour.json`

`{zc_id, kind, href, title, citation_canonical, year_printed, publisher, pages_printed,
source, front_matter, route, map, maps[], photographs[], structure[], stops[],
stops_geojson, pages_text, counts}`. `stops[]` = `{stop_number, stop_label,
slug ("stop-1"), href, title, theme, page, text (verbatim), road_or_landmark,
mileage_from_start, cumulative_miles, cumulative_miles_paved_route, mileage_note,
historical_period, standing_notice, places_named[], people_named[], photo_captions[],
lat, lon, coordinate_source, place_slug, place_href, gazetteer_method,
gazetteer_confidence, geolocation_method, geolocation_confidence, geolocation_hint,
confidence}`.
The booklet prints no coordinates: all eleven stops are geocoded from the gazetteer, and
`coordinate_source` says so — show `gazetteer_method` and `gazetteer_confidence` with the map.
`stops_geojson` is a ready-made `FeatureCollection` for `ZybachMap` (same `properties` shape
as the gazetteer GeoJSON).
`pages_text` maps a printed page to its transcript entries, for the whole-booklet view.

## `soap_creek/thesis.json`

The 1999 thesis record passed through, plus `href`, `pages_printed`, `pages_cited`, `holds[]`
and `counts`. `chronology[]` and `dated_statements[]` carry `href` to `/thesis/#pNN`.
Anything printed on a held page (Table D.4) is removed.

## `elliott/interviews.json`

`{generated, series, project, data_model_notes[], discrepancies[], gaps[], counts, interviews[]}`.
Interview: `{interview_id, interview_key ("20171010"), date, date_as_printed,
number_as_printed, title_as_printed, tour_label_as_printed, route_description, interviewer,
narrators[], href, in_2019_index, has_transcript, note, primary_transcript, transcript_file,
related_transcripts[],
public_url, printed_pages, total_pages, total_audio, totals_as_printed, totals_from_index,
counts, tapes[], recordings[], photographs[], maps[]}`.
Tape: `{tape_id, tape_label_as_printed, side, minutes, mp3_mb, mp3_url, mp3_recording_id,
transcript_pages_range, part_label_as_printed, part_title_as_printed, topics_1_4[],
map_refs[], participants[], notes, anchor ("tape-01-b"), href, counts, segments[]}`.
Segment: `{segment_id, stop_id, stop_label_as_printed, tape_side, minute, minute_seconds,
topic, transcript_page, transcript_page_as_printed, transcript_page_resolves, photo_count,
map_refs[], notes, href ("…/#p12"), source}`.
Twelve dates in all. Six carry Bob's 2019 segment index (`in_2019_index: true`). Five more
have a transcript but no segment index — render them as transcript-only interviews. One
(2019-10-08, Vonderohe) has two MP3s and nothing else: `has_transcript: false`,
`title_as_printed: null`, and `note` says why — render the date and the audio.
`segments_without_transcript_page[]` lists the segments Bob's printed index gives no page for
(`transcript_page_resolves: false`); their `href` is the interview page with no anchor.

## `elliott/transcripts/{zc_id}.json`

`{zc_id, interview_date, interview_key, href, title_as_printed, participants_as_printed[],
interviewer, source, front_matter, page_mapping_rule, printed_pages[], generated, counts,
anchors[], photographs[], places_mentioned[], dated_statements[], content_notes[], quality,
gaps[], entries[]}`.
Entry: `{page, pdf_page, seq, kind, speaker, speaker_name, speaker_confidence, tape_side,
anchor_ref, text}`. `kind` is `speech | draft_speech | heading | anchor | editorial_note |
narrative | narrative_with_source_citation | photo_caption`.
Anchor: `{page, tape_side, minute, stop_label, topic_as_printed, label_as_printed, anchor_id,
anchor_source, confidence, href}` — these are Bob's printed stop/minute markers.

## `elliott/videos.json`

`videos[]` = `{video_id, slug, href, playlist_position, title, url, embed_url, thumbnail_url,
length_seconds, length_label, published, description, orww_links[], external_links[],
sponsor_note, confidence, counts, segments[]}`.
Segment: `{t_seconds, t_label, label, stop_number, embed_url, watch_url}` where `embed_url`
is `https://www.youtube.com/embed/{video_id}?start={t_seconds}` — reload the iframe with it.

## `elliott/photos.json` / `recordings.json` / `maps.json`

`photos.json` → `groups[]` by interview date → `places[]` → `photographs[]`
(`full_url` = the `-10` rendition, `thumb_url` = the `-2` rendition or `null`).
`recordings.json` → `recordings[]` with `url` (MP3 on orww.org), `interview_href`,
`duration_hms_estimated` (+ `duration_confidence` — estimated from bitrate, not measured).
`maps.json` → `maps[]` with `url`, `thumbnail_url`, `slug`, `interview_href`.

## `content_notes.json`

`{generated, collection_statement (the 114-word draft, `draft: true`),
collection_statement_words, collection_statement_source, policy, counts, items[]}`.
Item: `{zc_id, mono_slug, record_href, page, level:'page', severity ('high'|'medium'),
category, display_note (neutral, no quotations), href}`. Severity `low` and category
`not-an-issue` are excluded here by policy.

## `holds.json`

`holds[]` = `{zc_id, mono_slug, record_href, ranges[[a,b]], pages[], what, reason}`.
Held pages still exist and are still citable; their text is replaced by the hold notice
(`entries[].held === true` in the transcript files).

## Conventions every page agent should honour

1. Print `citation_canonical` verbatim. Do not reformat it.
2. Page anchors are `#pNN` on a `<section id="pNN">`; the folio is the permalink.
3. Show `confidence` and `method` wherever a coordinate or an attribution is displayed.
4. `speaker_inferred: true` needs one footnote per page, not one per turn.
5. Never render `_withheld_places.json`; never render a held page's text.
6. A map always ships with an equivalent list.
