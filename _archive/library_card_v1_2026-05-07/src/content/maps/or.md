---
state: Oregon
fips: "41"
abbr: or
tier: Good
title: "Oregon — Map Room"
description: "How Oregon publishes — and where it falls short on — the locations of its school trust lands."
---

# Oregon

**Transparency tier: Good.** Oregon's Department of State Lands publishes a public ArcGIS feature service (the State Land Inventory System, or SLIS) that exposes most current trust-land ownership at parcel level, with a continual update cadence and explicit surface/subsurface estate fields. The agency itself acknowledges, in its own metadata, that "the data layer is currently not normalized" and contains "known errors … resulting from gaps in reporting by agencies about their ownership." For most research and journalistic purposes, SLIS is sufficient. For litigation or appellate-grade verification, primary deeds and surveys remain controlling.

## At a glance

| | |
|---|---|
| Admitted to the Union | February 14, 1859 |
| Original grant statute | Oregon Admission Act, 11 Stat. 383, § 4 |
| Sections granted | 16 and 36 of every township |
| Original grant acreage | ≈3.4 million acres |
| Current trust-land surface acres | ≈681,000 |
| Current trust-land mineral acres | ≈768,550 |
| Beneficiary | Common School Fund (K–12 public schools) |
| FY2025 distribution to schools | $76.8 million (record) |
| Managing agency | Oregon Department of State Lands (DSL) |

## The original grant and its drift

When Oregon was admitted to the Union on February 14, 1859, Section 4 of the Admission Act granted Sections 16 and 36 of every surveyed township to the State "for the use of schools." The grant totaled approximately 3.4 million acres. Approximately eighty percent of that original footprint has since been alienated — primarily through statutory sales to settlers in the late nineteenth and early twentieth centuries, with later disposals through federal-state exchanges, mineral severances, and the 2022 decoupling of the Elliott State Forest. Today, the Department of State Lands manages approximately 681,000 acres of surface trust land and approximately 768,550 acres of subsurface (mineral and energy) rights, distributed across most Oregon counties but concentrated in central and southern parts of the state.

The Common School Fund — the financial counterpart of the trust lands — has grown to approximately $2.5 billion and distributed a record $76.8 million to Oregon K-12 schools in fiscal year 2025. The fund's principal is constitutionally protected; only the income (currently distributed at approximately 3.5 percent of corpus) flows to schools. The remaining trust acres are managed by DSL under a 10-year Asset Management Plan (the current plan was published in 2024) for revenue generation through grazing, forestry, agricultural, mineral, and special-use leases.

## The State Land Inventory System (SLIS)

The single most important public source for Oregon trust-land verification is DSL's State Land Inventory System, an ArcGIS feature service that exposes most state-owned ownership records at parcel level.

| | |
|---|---|
| Public viewer | [maps.dsl.state.or.us/slis/](https://maps.dsl.state.or.us/slis/) |
| REST endpoint | [maps.dsl.state.or.us/arcgis/rest/services/SlisPublic/FeatureServer/0](https://maps.dsl.state.or.us/arcgis/rest/services/SlisPublic/FeatureServer/0) |
| AGOL web map | "State Lands Inventory 2021" |
| Last published | June 17, 2024 |
| Update cadence | Continual (declared) |
| Total polygons | 14,378 |
| Aliquot detail | Yes (Township, Range, SecNumber, Quarter, QuarterQuarter, MapTaxlot) |
| Estate fields | SURF_OWNER, SUB_OWNER (surface and subsurface separately tracked) |

The viewer is free, public, and does not require a login. A researcher can search by address, Township-Range-Section, or county. The interactive map exposes the underlying parcel layer with full attribute access (the agency, surface and subsurface ownership codes, deed references, tax-lot identifiers, and any "Anomaly" flags for split sections).

DSL's published metadata is candid about the limits of the data:

> *"There are known errors in the data, resulting from gaps in reporting by agencies about their ownership. … The data layer is currently not normalized."*

That candor is itself a useful transparency feature. A researcher who relies on SLIS knows what the data is and is not — and can supplement it with deed and survey records where legal certainty matters.

## Other state spatial resources

| Resource | URL | What it adds |
|---|---|---|
| Oregon GEOHub | [geohub.oregon.gov](https://geohub.oregon.gov) | Statewide framework data; the successor to the former Oregon Spatial Data Library |
| Oregon Explorer | [oregonexplorer.info](https://oregonexplorer.info) | Multi-agency natural-resource portal |
| ORMAP | [ormap.net](https://ormap.net) | Statewide cadastral / tax-lot framework administered by the Department of Revenue |
| ODF Managed Lands | [ArcGIS Hub](https://oregon-department-of-forestry-geo.hub.arcgis.com/datasets/geo::odf-managed-lands) | Forested trust lands (Common School Fund-coded), including fund type and acreage |
| BLM Oregon-Washington Geospatial Hub | [gbp-blm-egis.hub.arcgis.com/pages/oregon](https://gbp-blm-egis.hub.arcgis.com/pages/oregon) | Cadastral PLSS, master title plats, federal land records |

## Surface versus mineral estate

Oregon's trust holdings are unusual in that mineral acreage exceeds surface acreage by approximately 87,500 acres (768,550 vs. 681,000). The mineral estate is largely severed from the surface — the State retains mineral and geothermal rights underlying lands whose surface was sold or exchanged out of the trust over the preceding 165 years. SLIS exposes this through the SUB_OWNER field, which a researcher should always check independently of SURF_OWNER. Reporting "Oregon's trust lands amount to 681,000 acres" without acknowledging the additional 768,550 mineral acres collapses two distinct legal estates and understates the trust portfolio by more than half.

DSL is also responsible for managing the leasing and sale of state-owned mineral rights on over 3 million additional acres held by other state agencies under ORS 273.780, including approximately 2.5 million acres of subsurface rights beneath agency-managed surface estate.

## State-specific quirks — what to know about Oregon

**The Elliott State Forest decoupling.** Oregon's largest single block of Common School Fund land — approximately 82,500 acres in the Elliott State Forest, originally established in 1930 from a combination of original CSF lands and 1930s-era federal-exchange acquisitions — was formally decoupled from the trust on December 13, 2022. The State paid the appraised value ($221 million, funded through $100 million in 2019 bond proceeds and $121 million in 2022 general-fund appropriation under SB 1546) into the Common School Fund and removed the Elliott from the trust portfolio. The Elliott now operates under the Elliott State Research Forest Authority, an independent state agency partnered with the OSU College of Forestry. *The 82,500 acres are no longer trust land*, although they appear in some legacy datasets. The 2024 DSL Asset Management Plan explicitly excludes them from the Real Property Program inventory.

**Constitutional vs. statutory trust lands.** Approximately 96 percent of DSL's Real Property Program lands are constitutional trust lands (descended from the 1859 Section 16/36 grant). The remaining 4 percent are statutory trust lands — held under ORS 327.405 statutory CSF authority and originating from the 1841 internal-improvement grant or the 1860 Swamp Lands Act. The fiduciary obligations and disposition rules differ between the two categories, and any single-figure acreage claim about Oregon trust lands that does not separate them is vulnerable to challenge.

**The pre-1973 entitlement excess.** A 1973 BLM audit found that Oregon had received public lands in excess of its school-land entitlement under the 1859 Admission Act. The Ninth Circuit affirmed the audit's pro-rata methodology in *Oregon v. BLM*, 876 F.2d 1419 (9th Cir. 1989). Any Oregon advocacy position predicated on unfulfilled federal trust delivery must engage with this finding directly.

## Citizen-advocate workflow — verifying an Oregon parcel

To establish with appellate-grade confidence that a specific parcel is or was Oregon school trust land, a six-step chain of authority applies:

1. **Convert address or tax-lot to PLSS.** Use the county assessor parcel viewer, ORMAP, or the BLM Oregon Ownership map service to translate an address into Township-Range-Section-aliquot coordinates.
2. **Query SLIS for current ownership of both estates.** Filter by SecNumber 16 or 36 within the relevant Township and Range, or by MapTaxlot. Inspect both SURF_OWNER and SUB_OWNER. Do not assume the two are jointly held.
3. **Pull the original federal patent from BLM-GLO.** At [glorecords.blm.gov](https://glorecords.blm.gov/search/), search by state, county, or township-range to retrieve the original patent conveying the section from the United States to the State of Oregon at statehood. A patent issued to the State confirms grant compliance; a patent issued to a private party (Donation Land Claim, Homestead, mining) confirms the section was disposed of pre-vesting and indemnity may have been substituted.
4. **Confirm at the county recorder/assessor.** For current taxlot status and any state-issued deed of conveyance. DSL is the central repository for state real-property transactions under ORS 273.099.
5. **DSL leasing and asset records.** Active grazing, mineral, communications, oil-and-gas, geothermal, and special-use authorizations are not all online. Obtain via Public Records Request.
6. **DSL Public Records Request.** At [oregon.gov/DSL/Pages/PRR.aspx](https://www.oregon.gov/DSL/Pages/PRR.aspx) under ORS Chapter 192. Fee waivers are available where disclosure benefits the general public.

## Managing agency

| | |
|---|---|
| Agency | Oregon Department of State Lands (DSL) |
| Director | Vicki L. Walker |
| Headquarters | 775 Summer St. NE, Suite 100, Salem, OR |
| Real Property / trust-land program | Bend Field Office, 951 SW Simpson Ave. #104 |
| State Land Board | Governor (chair), Secretary of State, State Treasurer |
| Communications contact | Alyssa Rash, alyssa.rash@dsl.oregon.gov, 971-900-7708 |
| Ownership Specialist | Erin Serra, erin.serra@dsl.oregon.gov, 971-707-8105 |
| Public Records Request coordinator | April Gomez, april.gomez@dsl.oregon.gov |
| Agency homepage | [oregon.gov/dsl](https://www.oregon.gov/dsl) |

The State Land Board, created by Article VIII, § 5 of the Oregon Constitution, comprises the Governor (currently Tina Kotek), the Secretary of State (currently Tobias Read), and the State Treasurer (currently Elizabeth Steiner). The constitutional management standard at Article VIII, § 5(2) requires action "with the object of obtaining the greatest benefit for the people of this state, consistent with the conservation of this resource under sound techniques of land management." DSL is the Land Board's administrative arm, codified at ORS 273.041.

## Sources and further reading

**Primary statutes and regulations.** ORS Chapter 273 (Public Lands); ORS Chapter 327, §§ 405–480 (Common School Fund administration); OAR Chapter 141 (DSL administrative rules, especially Divisions 67 (sale/exchange/purchase), 70 (oil-and-gas leasing), 71 (mineral prospecting and leasing), 82–85, 89–90 (submerged/submersible authorizations), and 110 (rangeland forage management)).

**Primary case law.** *Wood v. Honeyman*, 178 Or. 484, 173 P.2d 56 (1946) (foundational trustee-duty doctrine); *United States v. Morrison*, 240 U.S. 192 (1916) (timing of title vesting in school sections); *Oregon v. BLM*, 876 F.2d 1419 (9th Cir. 1989) (pro-rata indemnity rule and 1973 audit affirmation).

**Agency reports.** DSL [2024 Asset Management Plan](https://www.oregon.gov/dsl/lands/Documents/2024_Asset_Management_Plan.pdf); DSL biennial reports to the Legislature; Common School Fund annual financial reports.

**Decoupling history.** SB 1546 (2022); State Land Board minutes, December 13, 2022; Elliott State Research Forest Authority establishment (effective January 1, 2024).

---

*Last updated 2026-05-05. Source material drawn from a multi-AI research synthesis ("Locating State School Trust Lands"), filed in the Library's primary-source archive at `L0_Primary_Sources/Research_Reports/`. Corrections or supplements welcome via the Library contact form.*
