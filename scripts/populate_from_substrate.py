#!/usr/bin/env python3
"""
Populate hand-curated frontmatter fields (federalGrantAcres, governanceForm,
permanentFundCorpus, latestDistribution) for state entries in
src/content/states/ from the v0.4 Fifty States substrate.

Source of truth: /mnt/c/Users/drdav/My Drive/Claude Cowork/L4_Deliverables/Fifty_States/States/
The substrate is read-only — the populator never modifies it.

Merge-preserving: for each website file, only fills a field if the existing
value is null/empty. Never overwrites a non-null hand-curated value. Oregon's
existing curated values are guaranteed to round-trip unchanged.

No fabrication: a substrate value is only used when it appears in a clean,
labeled YAML scalar. Year-only qualifiers ("as of 2025") are NOT extrapolated
into a calendar date; they leave asOf null. Substrate values flagged as
non-school-trust (Alaska's APFC, Texas's biennium distribution) are skipped.

Usage:
    python3 scripts/populate_from_substrate.py            # write changes
    python3 scripts/populate_from_substrate.py --dry-run  # show manifest only
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import date
from pathlib import Path

import yaml

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))
import migrate_states as ms

REPO_ROOT = SCRIPTS_DIR.parent
SUBSTRATE_DIR = Path(
    "/mnt/c/Users/drdav/My Drive/Claude Cowork/L4_Deliverables/Fifty_States/States"
)
WEB_DIR = REPO_ROOT / "src" / "content" / "states"

# Per Phase 1 flags — these states' substrate values are explicitly NOT
# school-trust quantities; populating them would mislead readers.
SKIP_CORPUS = {"Alaska"}            # AK substrate: "NOT a school trust"
SKIP_DIST = {"Alaska", "Texas"}     # AK same; TX is a biennium figure


def find_substrate_file(state_name: str) -> Path | None:
    name_compact = state_name.replace(" ", "")
    pat = re.compile(rf"^\d+_[A-Z]{{2}}_{re.escape(name_compact)}_v0\.4_\[INTERNAL\]\.md$")
    for f in SUBSTRATE_DIR.iterdir():
        if pat.match(f.name):
            return f
    return None


def load_section_yaml(text: str, section: str) -> dict:
    """Pull the fenced YAML block under '## {section}'."""
    pat = re.compile(
        rf"^##\s+{re.escape(section)}\s*\n+```yaml\s*\n(.*?)\n```",
        re.M | re.S,
    )
    m = pat.search(text)
    if not m:
        return {}
    try:
        data = yaml.safe_load(m.group(1)) or {}
        return data if isinstance(data, dict) else {}
    except yaml.YAMLError:
        return {}


def line_comment_for(text: str, key: str) -> str:
    """Return the trailing # comment on the line where `key:` is defined,
    or '' if absent."""
    pat = re.compile(rf"^{re.escape(key)}:\s*[^\s#].*?#\s*(.+)$", re.M)
    m = pat.search(text)
    return m.group(1).strip() if m else ""


def extract_fiscal_year(comment: str) -> int | None:
    """Conservative: only return a year when the comment pins it explicitly."""
    if not comment:
        return None
    m = re.search(r"\bFY\s*(\d{4})\b", comment)
    if m:
        return int(m.group(1))
    m = re.search(r"\bFY\s*(\d{2})\b", comment)
    if m:
        yy = int(m.group(1))
        return 2000 + yy if yy < 70 else 1900 + yy
    m = re.search(r"\bfiscal year\s+(\d{4})\b", comment, re.I)
    if m:
        return int(m.group(1))
    return None


def extract_asof_date(comment: str) -> date | None:
    """Only accept a fully-pinned ISO date in the comment. Year-only
    ('as of 2025') stays None — we don't fabricate a month/day."""
    if not comment:
        return None
    m = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", comment)
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def is_int(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def extract_substrate(state_name: str) -> dict:
    """Return {field_name: value or None} for the four target fields,
    plus diagnostic 'reasons' so the manifest can explain skips."""
    out: dict = {
        "federalGrantAcres": None,
        "governanceForm": None,
        "permanentFundCorpus": None,
        "latestDistribution": None,
        "_reasons": {},
    }

    src = find_substrate_file(state_name)
    if not src:
        out["_reasons"]["__file__"] = "no v0.4 substrate file found"
        return out

    text = src.read_text(encoding="utf-8")
    school = load_section_yaml(text, "school_grant")
    mgmt = load_section_yaml(text, "current_management")

    # federalGrantAcres — 0 is meaningful (Original 13 had no federal grant);
    # only skip when the substrate value is missing or non-numeric.
    acres = school.get("total_acres_granted_estimate")
    if is_int(acres) and acres >= 0:
        out["federalGrantAcres"] = acres
    else:
        out["_reasons"]["federalGrantAcres"] = "substrate value missing/non-numeric"

    # governanceForm — use the prose `governing_board` (not the rarely-populated
    # enum `governance_form`). Verbatim, stripped.
    gov = mgmt.get("governing_board")
    if isinstance(gov, str) and gov.strip():
        out["governanceForm"] = gov.strip()
    else:
        out["_reasons"]["governanceForm"] = "substrate governing_board missing/empty"

    # permanentFundCorpus
    if state_name in SKIP_CORPUS:
        out["_reasons"]["permanentFundCorpus"] = (
            "substrate value flagged as NOT a school-trust corpus; skipped"
        )
    else:
        corpus_val = mgmt.get("permanent_fund_corpus_estimate_usd")
        if is_int(corpus_val) and corpus_val > 0:
            comment = line_comment_for(text, "permanent_fund_corpus_estimate_usd")
            asof = extract_asof_date(comment)
            out["permanentFundCorpus"] = {"value": corpus_val, "asOf": asof}
            if asof is None:
                out["_reasons"]["permanentFundCorpus.asOf"] = (
                    f"substrate comment did not pin a calendar date "
                    f"(comment: {comment[:80]!r}); asOf left null"
                )
        else:
            out["_reasons"]["permanentFundCorpus"] = (
                "substrate explicitly null (no consolidated state-level corpus or unpinned)"
            )

    # latestDistribution
    if state_name in SKIP_DIST:
        out["_reasons"]["latestDistribution"] = (
            "substrate value is biennial / non-annual; skipped"
            if state_name == "Texas"
            else "substrate value flagged as non-school-trust; skipped"
        )
    else:
        dist_val = mgmt.get("annual_distribution_estimate_usd")
        if is_int(dist_val) and dist_val > 0:
            comment = line_comment_for(text, "annual_distribution_estimate_usd")
            fy = extract_fiscal_year(comment)
            out["latestDistribution"] = {"value": dist_val, "fiscalYear": fy}
            if fy is None:
                out["_reasons"]["latestDistribution.fiscalYear"] = (
                    f"substrate comment did not pin a fiscal year "
                    f"(comment: {comment[:80]!r}); fiscalYear left null"
                )
        else:
            out["_reasons"]["latestDistribution"] = (
                "substrate explicitly null (no annual distribution figure)"
            )

    return out


def has_value(v) -> bool:
    """A curated field 'has a value' (and must be preserved) if it's not
    None, not an empty string, and not an empty dict."""
    if v is None:
        return False
    if isinstance(v, str) and v == "":
        return False
    if isinstance(v, dict) and not v:
        return False
    return True


def merge_curated_with_substrate(existing: dict, substrate: dict) -> tuple[dict, dict]:
    """Returns (merged_curated_dict, action_log_per_field).

    For each of the four hand-curated fields:
      - existing value present → preserve, log 'preserved'
      - existing missing AND substrate has a value → adopt, log 'populated'
      - existing missing AND substrate empty → leave null, log 'left_null'
    """
    actions: dict = {}
    merged: dict = {}

    field_map = [
        ("federalGrantAcres", "federalGrantAcres"),
        ("governanceForm", "governanceForm"),
        ("permanentFundCorpus", "permanentFundCorpus"),
        ("latestDistribution", "latestDistribution"),
    ]

    for ek, sk in field_map:
        ev = existing.get(ek)
        if has_value(ev):
            merged[ek] = ev
            actions[ek] = ("preserved", _short(ev))
            continue
        sv = substrate.get(sk)
        if has_value(sv):
            merged[ek] = sv
            actions[ek] = ("populated", _short(sv))
        else:
            # Default null/empty per migrate_states.merged_curated convention
            if ek == "governanceForm":
                merged[ek] = ""
            else:
                merged[ek] = None
            reason = substrate.get("_reasons", {}).get(ek, "no substrate value")
            actions[ek] = ("left_null", reason)

    # lastReviewed: preserve existing if it's a date; otherwise default
    lr = existing.get("lastReviewed")
    merged["lastReviewed"] = lr if isinstance(lr, date) else ms.DEFAULT_LAST_REVIEWED
    return merged, actions


def _short(v) -> str:
    if isinstance(v, dict):
        parts = []
        for k, vv in v.items():
            if isinstance(vv, date):
                parts.append(f"{k}={vv.isoformat()}")
            elif vv is None:
                parts.append(f"{k}=null")
            else:
                parts.append(f"{k}={vv}")
        return "{" + ", ".join(parts) + "}"
    if isinstance(v, str):
        return v if len(v) < 70 else v[:67] + "..."
    if isinstance(v, date):
        return v.isoformat()
    return str(v)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="show manifest, do not write any files")
    args = ap.parse_args()

    book_text = Path(ms.SOURCE).read_text(encoding="utf-8")
    toc = ms.parse_toc(book_text)

    summary = {"populated": 0, "preserved": 0, "left_null": 0}
    file_changes = 0

    print("=" * 78)
    print(f"POPULATE MANIFEST   (mode: {'DRY-RUN' if args.dry_run else 'WRITE'})")
    print("=" * 78)

    for name in sorted(toc.keys(), key=lambda n: toc[n].admission_number):
        meta = toc[name]
        slug = f"us-{ms.USPS[name].lower()}"
        web_path = WEB_DIR / f"{slug}.md"
        if not web_path.exists():
            print(f"\n[skip] {slug}: no website file found")
            continue

        existing = ms.read_existing_frontmatter(web_path)
        substrate = extract_substrate(name)
        merged, actions = merge_curated_with_substrate(existing, substrate)

        # Read body (everything after closing '---' of frontmatter)
        web_text = web_path.read_text(encoding="utf-8")
        m = re.match(r"^---\n.*?\n---\n", web_text, re.S)
        body = web_text[m.end():] if m else web_text

        new_content = ms.render_frontmatter(meta, merged) + body
        will_change = new_content != web_text

        # Per-state line
        flag = "*" if will_change else " "
        print(f"\n{flag} {slug:8s}  {name}")
        for field, (action, detail) in actions.items():
            symbol = {"populated": "+", "preserved": "=", "left_null": "·"}[action]
            print(f"     {symbol} {field:24s}  {action:9s}  {detail}")
            summary[action] += 1

        if will_change and not args.dry_run:
            web_path.write_text(new_content, encoding="utf-8")
            file_changes += 1
        elif will_change:
            file_changes += 1  # would-change count for dry-run

    print()
    print("=" * 78)
    print("SUMMARY")
    print("=" * 78)
    print(f"  Field actions:  populated={summary['populated']}  "
          f"preserved={summary['preserved']}  left_null={summary['left_null']}")
    print(f"  Files {'that would change' if args.dry_run else 'changed'}: {file_changes}")
    print(f"  Mode: {'DRY-RUN — no writes performed' if args.dry_run else 'WRITE'}")
    print("=" * 78)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
