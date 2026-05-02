#!/usr/bin/env python3
"""
Bulk-migrate state encyclopedia entries from the Schools of the Republic
substrate into src/content/states/{slug}.md.

Reads the substrate's Part II Table of Contents to extract per-state metadata
(admission number, name, admission date, era cohort, era name) and finds each
"# {State} — Encyclopedia Entry" section. Writes one Astro content file per
state with frontmatter and body.

Frontmatter merge policy
------------------------
Authoritative (always overwrite from substrate / ToC):
    name, fips, iso, admissionNumber, admittedDate, eraCohort, eraName,
    substrateVersion
Hand-curated (preserve existing non-null/non-empty value; otherwise default):
    federalGrantAcres, governanceForm, permanentFundCorpus, latestDistribution,
    lastReviewed
Body: always overwritten with the verbatim substrate text.

Run from the repo root: python3 scripts/migrate_states.py
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import yaml

SOURCE = "/mnt/c/Users/drdav/My Drive/Claude Cowork/L4_Deliverables/Book_Revision/Schools_of_the_Republic_v1.3_[INTERNAL].md"
REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "src" / "content" / "states"

SUBSTRATE_VERSION = "1.3"
DEFAULT_LAST_REVIEWED = date(2026, 5, 1)

FIPS = {
    "Alabama": "01", "Alaska": "02", "Arizona": "04", "Arkansas": "05",
    "California": "06", "Colorado": "08", "Connecticut": "09", "Delaware": "10",
    "Florida": "12", "Georgia": "13", "Hawaii": "15", "Idaho": "16",
    "Illinois": "17", "Indiana": "18", "Iowa": "19", "Kansas": "20",
    "Kentucky": "21", "Louisiana": "22", "Maine": "23", "Maryland": "24",
    "Massachusetts": "25", "Michigan": "26", "Minnesota": "27", "Mississippi": "28",
    "Missouri": "29", "Montana": "30", "Nebraska": "31", "Nevada": "32",
    "New Hampshire": "33", "New Jersey": "34", "New Mexico": "35", "New York": "36",
    "North Carolina": "37", "North Dakota": "38", "Ohio": "39", "Oklahoma": "40",
    "Oregon": "41", "Pennsylvania": "42", "Rhode Island": "44", "South Carolina": "45",
    "South Dakota": "46", "Tennessee": "47", "Texas": "48", "Utah": "49",
    "Vermont": "50", "Virginia": "51", "Washington": "53", "West Virginia": "54",
    "Wisconsin": "55", "Wyoming": "56",
}

USPS = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY",
}

MONTHS = {
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12,
}

COHORT_RE = re.compile(r"^####\s+Chapter\s+(\d+)\s+cohort\s+—\s+(.+?)\s*(?:\*\(.*\)\*)?\s*$")
TOC_LINE_RE = re.compile(r"^\*\*(\d+)\.\*\*\s+(.+?)\s+—\s+(\w+)\s+(\d+),\s+(\d{4})\s*$")
ENTRY_HEADER_RE = re.compile(r"^#\s+(.+?)\s+—\s+Encyclopedia Entry\s*$")
FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)

CURATED_FIELDS = (
    "federalGrantAcres",
    "governanceForm",
    "permanentFundCorpus",
    "latestDistribution",
    "lastReviewed",
)


@dataclass
class StateMeta:
    admission_number: int
    name: str
    admitted_date: date
    era_cohort: int
    era_name: str


def parse_toc(text: str) -> dict[str, StateMeta]:
    lines = text.splitlines()
    try:
        start = next(
            i for i, ln in enumerate(lines)
            if ln.startswith("### Part II — Encyclopedia Entries")
        )
        end = next(
            i for i, ln in enumerate(lines[start + 1:], start=start + 1)
            if ln.startswith("### Back Matter")
        )
    except StopIteration:
        sys.exit("ERROR: could not locate Part II ToC bounds in source")

    states: dict[str, StateMeta] = {}
    cur_cohort: int | None = None
    cur_era_name: str | None = None
    for ln in lines[start:end]:
        m = COHORT_RE.match(ln.rstrip())
        if m:
            cur_cohort = int(m.group(1))
            cur_era_name = m.group(2).strip()
            continue
        m = TOC_LINE_RE.match(ln.rstrip())
        if m and cur_cohort is not None and cur_era_name is not None:
            num = int(m.group(1))
            name = m.group(2).strip()
            month = MONTHS[m.group(3)]
            day = int(m.group(4))
            year = int(m.group(5))
            states[name] = StateMeta(
                admission_number=num,
                name=name,
                admitted_date=date(year, month, day),
                era_cohort=cur_cohort,
                era_name=cur_era_name,
            )
    return states


def extract_entries(text: str) -> dict[str, str]:
    lines = text.splitlines(keepends=False)
    headers: list[tuple[int, str]] = []
    for i, ln in enumerate(lines):
        m = ENTRY_HEADER_RE.match(ln)
        if m:
            headers.append((i, m.group(1).strip()))

    h1_positions = [i for i, ln in enumerate(lines) if ln.startswith("# ")]

    entries: dict[str, str] = {}
    for pos, name in headers:
        next_h1 = next((p for p in h1_positions if p > pos), len(lines))
        body_lines = lines[pos + 1:next_h1]
        body = "\n".join(body_lines)
        body = re.sub(r"\n+\\newpage\s*\n*$", "\n", body)
        body = body.rstrip() + "\n"
        body = re.sub(r"\n{3,}", "\n\n", body)
        entries[name] = body
    return entries


def read_existing_frontmatter(path: Path) -> dict:
    if not path.exists():
        return {}
    text = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}
    data = yaml.safe_load(m.group(1)) or {}
    return data if isinstance(data, dict) else {}


def is_missing(value) -> bool:
    """A curated field is 'missing' if it's None, an empty string, or absent."""
    if value is None:
        return True
    if isinstance(value, str) and value == "":
        return True
    return False


def yaml_str(s: str) -> str:
    if re.search(r"[:\#\-\[\]\{\},&\*\!\|\>\'\"%@`]", s) or s.strip() != s:
        return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return s


def fmt_scalar(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, str):
        return yaml_str(v) if v else '""'
    raise TypeError(f"unsupported scalar type: {type(v)}")


def render_object_block(obj: dict, indent: str = "  ") -> list[str]:
    lines = []
    for k, v in obj.items():
        lines.append(f"{indent}{k}: {fmt_scalar(v)}")
    return lines


def render_frontmatter(meta: StateMeta, curated: dict) -> str:
    iso = f"US-{USPS[meta.name]}"
    fips = FIPS[meta.name]

    lines = [
        "---",
        f"name: {yaml_str(meta.name)}",
        f'fips: "{fips}"',
        f"iso: {iso}",
        f"admissionNumber: {meta.admission_number}",
        f"admittedDate: {meta.admitted_date.isoformat()}",
        f"eraCohort: {meta.era_cohort}",
        f"eraName: {yaml_str(meta.era_name)}",
    ]

    grant = curated.get("federalGrantAcres")
    lines.append(f"federalGrantAcres: {fmt_scalar(grant) if grant is not None else 'null'}")

    gov = curated.get("governanceForm")
    lines.append(f"governanceForm: {fmt_scalar(gov) if not is_missing(gov) else '\"\"'}")

    corpus = curated.get("permanentFundCorpus")
    if isinstance(corpus, dict) and corpus:
        lines.append("permanentFundCorpus:")
        lines.extend(render_object_block(corpus))
    else:
        lines.append("permanentFundCorpus: null")

    dist = curated.get("latestDistribution")
    if isinstance(dist, dict) and dist:
        lines.append("latestDistribution:")
        lines.extend(render_object_block(dist))
    else:
        lines.append("latestDistribution: null")

    lines.append(f'substrateVersion: "{SUBSTRATE_VERSION}"')

    last_reviewed = curated.get("lastReviewed")
    if not isinstance(last_reviewed, date):
        last_reviewed = DEFAULT_LAST_REVIEWED
    lines.append(f"lastReviewed: {last_reviewed.isoformat()}")

    lines.append("---")
    lines.append("")
    return "\n".join(lines)


def merged_curated(existing: dict) -> dict:
    """Build the curated-field dict that render_frontmatter will use, preserving
    any existing non-missing values."""
    out: dict = {}
    for f in CURATED_FIELDS:
        v = existing.get(f)
        if f in ("federalGrantAcres",):
            out[f] = v if v is not None else None
        elif f == "governanceForm":
            out[f] = v if not is_missing(v) else ""
        elif f in ("permanentFundCorpus", "latestDistribution"):
            out[f] = v if isinstance(v, dict) and v else None
        elif f == "lastReviewed":
            out[f] = v if isinstance(v, date) else None
    return out


def main() -> int:
    text = Path(SOURCE).read_text(encoding="utf-8")
    toc = parse_toc(text)
    entries = extract_entries(text)

    if len(toc) != 50:
        print(f"WARNING: ToC parsed {len(toc)} states (expected 50)", file=sys.stderr)
    missing_in_entries = [n for n in toc if n not in entries]
    if missing_in_entries:
        print(f"WARNING: missing Part II entries for: {missing_in_entries}", file=sys.stderr)
    extra_in_entries = [n for n in entries if n not in toc]
    if extra_in_entries:
        print(f"WARNING: entries present without ToC metadata: {extra_in_entries}", file=sys.stderr)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    created: list[str] = []
    updated: list[str] = []
    unchanged: list[str] = []

    for name in sorted(toc.keys(), key=lambda n: toc[n].admission_number):
        meta = toc[name]
        body = entries.get(name)
        if body is None:
            continue
        slug = f"us-{USPS[name].lower()}"
        out_path = OUT_DIR / f"{slug}.md"

        existing_fm = read_existing_frontmatter(out_path)
        curated = merged_curated(existing_fm)
        new_content = render_frontmatter(meta, curated) + body

        if out_path.exists():
            old_content = out_path.read_text(encoding="utf-8")
            if old_content == new_content:
                unchanged.append(slug)
            else:
                out_path.write_text(new_content, encoding="utf-8")
                updated.append(slug)
        else:
            out_path.write_text(new_content, encoding="utf-8")
            created.append(slug)

    print()
    print("=" * 60)
    print("MIGRATION MANIFEST")
    print("=" * 60)
    print(f"Source:   {SOURCE}")
    print(f"Output:   {OUT_DIR.relative_to(REPO_ROOT)}/")
    print(f"ToC parsed: {len(toc)} states; Part II entries found: {len(entries)}")
    print()
    print(f"Created   ({len(created)}):")
    for s in created:
        print(f"  + {s}.md")
    print(f"Updated   ({len(updated)}):")
    for s in updated:
        print(f"  ~ {s}.md")
    print(f"Unchanged ({len(unchanged)}):")
    for s in unchanged:
        print(f"  = {s}.md")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
