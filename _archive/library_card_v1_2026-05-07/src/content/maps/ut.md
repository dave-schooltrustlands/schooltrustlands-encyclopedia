---
state: Utah
fips: "49"
abbr: ut
tier: Strong
title: "Utah — Map Room"
description: "Utah's School and Institutional Trust Lands Administration operates the most aliquot-friendly public GIS in the country."
---

# Utah

**Transparency tier: Strong.** Utah's School and Institutional Trust Lands Administration (SITLA) operates the most architecturally clean public-facing trust-land GIS in the United States. The Digital Plat Map combines business records (lease, contract, ownership) with spatial data, exposes a queryable feature service, publishes weekly updates, and integrates with the Utah Statewide Geographic Information Database (SGID) for downstream re-use. Severed mineral estates are tracked as a distinct layer. For a researcher who needs to verify a parcel of Utah trust land, the path from address to aliquot to ownership status to lease terms is short, well-documented, and free.

## At a glance

| | |
|---|---|
| Admitted to the Union | January 4, 1896 |
| Original grant statute | Utah Enabling Act, 28 Stat. 107 (1894) |
| Sections granted | 2, 16, 32, and 36 of every township (the four-section grant template) |
| Original grant acreage | ≈5.8 million acres (school + institutional combined) |
| Current trust-land surface acres | ≈3.4 million |
| Current trust-land mineral acres | ≈4.5 million (including ≈1.0–1.1 million severed-only) |
| Beneficiary | Common Schools (the dominant beneficiary), plus eleven other institutional beneficiaries (universities, schools for the deaf and blind, state hospital, reservoirs) |
| Managing agency | School and Institutional Trust Lands Administration (SITLA) |

## The Utah Enabling Act and its trust language

The Utah Enabling Act of July 16, 1894 — passed two years before Utah's January 1896 admission — was the first federal enabling act to use explicit trust language and enumerate enforceable fiduciary duties. Where prior Western admissions had granted school sections under the older "use of schools" formula of the Land Ordinance of 1785 and the Northwest Ordinance of 1787, the Utah Enabling Act expressly designated the granted sections as "held in trust" for the named beneficiaries, prohibited self-dealing, required full monetary compensation for any transfer of trust assets, and made the U.S. Attorney General the enforcement mechanism for breaches of the trust.

This trust framework is doctrinally important. In *Lassen v. Arizona ex rel. Arizona Highway Department*, 385 U.S. 458 (1967), the Supreme Court relied on parallel Arizona–New Mexico Enabling Act language (28 Stat. 107 / 36 Stat. 557) to hold that "the Enabling Act unequivocally demands" full monetary compensation for any interest transferred from the trust — speculative enhancement-value credits cannot offset cash. *Branson School District RE-82 v. Romer*, 161 F.3d 619 (10th Cir. 1998), confirmed that beneficiaries (school districts) have Supremacy Clause standing to enforce the trust.

The Utah grant also followed the *four-section* template (Sections 2, 16, 32, and 36 in every township), expanded from the earlier two-section template (16 and 36) to compensate for the high proportion of arid and difficult-to-monetize land in the Intermountain West.

## SITLA's Digital Plat Map and Land Ownership service

| | |
|---|---|
| Public viewer (Digital Plat Map) | [platmap.trustlands.utah.gov](https://platmap.trustlands.utah.gov) |
| REST endpoint (Land Ownership) | [gis.trustlands.utah.gov/mapping/rest/services/Land_Ownership/FeatureServer/0](https://gis.trustlands.utah.gov/mapping/rest/services/Land_Ownership/FeatureServer/0) |
| Update cadence | Weekly |
| Aliquot detail | Yes (Township-Range-Section, with quarter and quarter-quarter resolution) |
| Estate fields | Surface and severed-mineral as separate layers |
| Open data integration | Utah Statewide Geographic Information Database (SGID) PostgreSQL endpoint |
| Beneficiary tracking | Yes (which trust each parcel funds — school, university, hospital, etc.) |

The Digital Plat Map is the agency's primary public-facing tool. It combines the agency's contract-and-business records (active leases, sales, easements, rights-of-entry) with spatial data, so a researcher can identify a parcel and immediately see its current encumbrance status. The Land Ownership feature service is the underlying queryable layer. The map and the service are kept in sync on a weekly republish cycle.

The agency also exposes a programmatic interface. A typical workflow that takes seconds in the browser also runs as a single API call:

```bash
# Inspect schema and fields before querying
curl "https://gis.trustlands.utah.gov/mapping/rest/services/Land_Ownership/FeatureServer/0?f=pjson"
```

This is not advertised on the agency's home page, but it is a public-facing endpoint and Utah does not impose terms-of-use restrictions that would limit research use.

## Beneficiary tracking — what makes Utah unusual

Most state trust-land programs concentrate trust assets in a single beneficiary fund (Oregon's Common School Fund, Colorado's Permanent School Fund). Utah's grant supports twelve beneficiaries simultaneously: K–12 common schools (the dominant share by acreage), plus the University of Utah, Utah State University, Utah State Hospital, the Utah State Developmental Center, the Utah Schools for the Deaf and Blind, the Utah State Industrial School, two reservoir endowments, and the Miners' Hospital for Disabled Miners. Each beneficiary's trust assets are tracked separately in the agency's records, and the Digital Plat Map exposes the beneficiary code for every parcel.

This matters for transparency reporting. A researcher asking "what trust lands fund Utah K–12 schools?" gets a different answer than "what trust lands does SITLA manage in total." The agency's data architecture supports both questions.

## Surface vs. mineral estate

Utah's surface-acreage figure (≈3.4 million) and mineral-acreage figure (≈4.5 million) diverge by approximately 1.1 million acres. The agency tracks severed-mineral parcels — locations where the State sold the surface estate to a private party but retained the underlying mineral rights — as a distinct GIS layer accessible via the Digital Plat Map's mineral-estate toggle. Active oil, gas, and mineral lease rights are searchable separately.

For comparison: Oregon's surface/mineral inversion is similar in shape but smaller in scale (681k surface, 769k mineral). New Mexico's inversion is larger (9.1M surface, 12.98M mineral). North Dakota's is the most extreme by ratio (706k surface, 2.6M mineral). Utah's transparency posture on this issue is among the strongest in the country.

## State-specific notes — what to know about Utah

**SITLA's institutional independence.** SITLA was created by the Utah Legislature in 1994 as an independent administration with its own director and policy board, designed to insulate trust-land management from short-term political pressures. The agency reports to a Board of Trustees rather than to the Governor's cabinet. This structural independence has been credited with the agency's reputation for professional, fiduciary-oriented management.

**The "Mighty Five" national parks and trust-land checkerboarding.** Five of Utah's national parks — Arches, Canyonlands, Capitol Reef, Bryce Canyon, and Zion — were carved from public domain in territory that originally included Section 2/16/32/36 trust land grants. The federal government and SITLA have, over decades, executed several large land exchanges to consolidate park boundaries while compensating the trust through equivalent surface and mineral acreage elsewhere. The checkerboarding patterns visible on the Digital Plat Map across southern and central Utah are the residual signature of these exchanges.

**Beneficiary disputes and the Lassen rule.** Utah's enabling-act trust framework has been invoked in several federal cases involving the proper measure of compensation when trust land is transferred. The Lassen full-cash-compensation rule applies to Utah trust transfers; the agency's contract records (visible in the Digital Plat Map) document the appraisal-and-payment basis for every land exchange.

## Citizen-advocate workflow — verifying a Utah parcel

Utah's transparency posture means the verification workflow is shorter than in less-transparent states:

1. **Use the Digital Plat Map to find the parcel.** Search by Township-Range-Section, address, lease number, contract number, or APN. The viewer returns the current ownership status, beneficiary code, surface and mineral status, active leases, and acreage.
2. **Inspect both surface and mineral layers.** Toggle the severed-mineral layer to verify whether the State retains subsurface rights independent of surface ownership.
3. **Pull the original federal patent from BLM-GLO if needed.** At [glorecords.blm.gov](https://glorecords.blm.gov/search/), search by state and county to retrieve the original patent. For Utah, all four sections (2, 16, 32, 36) are subject to patent, with mineral-character exclusions historically narrower than in California.
4. **County recorder/assessor for state-issued deeds.** Where SITLA conveyed the surface and retained the minerals, the recorded deed will memorialize the severance.
5. **SITLA records request.** For lease history, asset-management notes, or non-public business records, contact SITLA directly (see "Managing agency" below).

## Managing agency

| | |
|---|---|
| Agency | School and Institutional Trust Lands Administration (SITLA) |
| Headquarters | 675 East 500 South, Suite 500, Salt Lake City, UT 84102 |
| Communications contact | Marla Kennedy, marlakennedy@utah.gov, 801-538-5102 |
| Director | (Current; check agency page) |
| Board structure | Independent SITLA Board of Trustees |
| Agency homepage | [trustlands.utah.gov](https://trustlands.utah.gov) |

## Sources and further reading

**Primary statutes.** Utah Enabling Act, 28 Stat. 107 (1894) (federal grant and trust framework); Utah Code Title 53C (Trust Lands Administration); Utah Constitution Article X (school fund and trust-land provisions).

**Primary case law.** *Lassen v. Arizona ex rel. Arizona Highway Department*, 385 U.S. 458 (1967); *Branson School District RE-82 v. Romer*, 161 F.3d 619 (10th Cir. 1998); *Ervien v. United States*, 251 U.S. 41 (1919) (enabling-act trust enumeration is exclusive).

**Agency reports.** SITLA Annual Reports; SITLA Asset Management Plans; the agency's Beneficiary Distributions documentation.

**Comparative literature.** Souder & Fairfax, *State Trust Lands: History, Management, and Sustainable Use* (Univ. Press of Kansas, 1996); Lincoln Institute / Sonoran Institute, *State Trust Lands in the West* (Culp et al.); PERC, *Divided Lands*.

---

*Last updated 2026-05-05. Source material drawn from a multi-AI research synthesis ("Locating State School Trust Lands"), filed in the Library's primary-source archive at `L0_Primary_Sources/Research_Reports/`. Corrections or supplements welcome via the Library contact form.*
