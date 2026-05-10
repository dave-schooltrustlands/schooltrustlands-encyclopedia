#!/usr/bin/env python3
"""v25 BETA — Publish Who Steals from Children: Volume 1 — Oregon and the Elliott.

Reads 16 substrate files from the Cowork-side L4_Deliverables directory and
writes each as a Reading-Room essay under src/content/essays/. Each output
file inherits the `essays` collection schema (sourceWork drives series-nav,
seriesLabel drives the pre-pub banner label, order drives prev/next).

Order assignments avoid existing essay orders (SoR 0-9, Eighth Anchor 100-108).
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path("/home/drdav/schooltrustlands-encyclopedia")
SUBSTRATE_DIR = Path(
    "/mnt/c/Users/drdav/My Drive/Claude Cowork/L4_Deliverables/"
    "Who_Steals_From_Children/Vol1_Elliott"
)
OUT_DIR = REPO_ROOT / "src/content/essays"

SOURCE_WORK = "Who Steals from Children: Volume 1 — Oregon and the Elliott"
SERIES_LABEL = "Who Steals from Children: Volume 1 — Oregon and the Elliott"
SOURCE_VERSION = "WSFC_Vol1_Elliott_v1"
LAST_SYNCED = "2026-05-10"

# (substrate filename, repo slug, order, chapterNumber, title)
PLAN: list[tuple[str, str, int, str | int, str]] = [
    ("Foreword_Margaret_Bird_v1_2026-05-10.md",
        "wsfc-vol1-foreword", 200, "Foreword",
        "Foreword — by Margaret Bird"),
    ("Preface_Sullivan_v1_2026-05-10.md",
        "wsfc-vol1-preface", 201, "Preface",
        "Preface — by Dave Sullivan"),
    ("Chapter_01_Theft_in_Plain_Sight_v1_2026-05-10.md",
        "wsfc-vol1-ch01-theft-in-plain-sight", 202, 1,
        "Chapter 1 — The Theft in Plain Sight"),
    ("Chapter_02_What_Oregon_Promised_in_1859_v1_2026-05-10.md",
        "wsfc-vol1-ch02-what-oregon-promised-in-1859", 203, 2,
        "Chapter 2 — What Oregon Promised in 1859"),
    ("Chapter_03_A_Century_of_Drift_v1_2026-05-10.md",
        "wsfc-vol1-ch03-a-century-of-drift", 204, 3,
        "Chapter 3 — A Century of Drift"),
    ("Chapter_04_The_1990s_Capture_v1_2026-05-10.md",
        "wsfc-vol1-ch04-the-1990s-capture", 205, 4,
        "Chapter 4 — The 1990s Capture"),
    ("Chapter_05_The_2017_Sale_and_Reverse_v1_2026-05-10.md",
        "wsfc-vol1-ch05-the-2017-sale-and-reverse", 206, 5,
        "Chapter 5 — The 2017 Sale and Reverse"),
    ("Chapter_06_The_2019_Bond_Substitution_v1_2026-05-10.md",
        "wsfc-vol1-ch06-the-2019-bond-substitution", 207, 6,
        "Chapter 6 — The 2019 Bond Substitution"),
    ("Chapter_07_The_2022_OSU_Plan_v1_2026-05-10.md",
        "wsfc-vol1-ch07-the-2022-osu-plan", 208, 7,
        "Chapter 7 — The 2022 OSU Plan"),
    ("Chapter_08_The_Secret_Meetings_v1_2026-05-10.md",
        "wsfc-vol1-ch08-the-secret-meetings", 209, 8,
        "Chapter 8 — The Secret Meetings"),
    ("Chapter_09_The_2023_Withdrawal_That_Wasnt_v1_2026-05-10.md",
        "wsfc-vol1-ch09-the-2023-withdrawal-that-wasnt", 210, 9,
        "Chapter 9 — The 2023 Withdrawal That Wasn't"),
    ("Chapter_10_OASTL_Forms_The_Standing_Victory_v1_2026-05-10.md",
        "wsfc-vol1-ch10-oastl-forms-the-standing-victory", 211, 10,
        "Chapter 10 — OASTL Forms; The Standing Victory"),
    ("Chapter_11_The_Smoking_Gun_and_The_Discovery_Stonewall_v1_2026-05-10.md",
        "wsfc-vol1-ch11-the-smoking-gun-and-the-discovery-stonewall", 212, 11,
        "Chapter 11 — The Smoking Gun and the Discovery Stonewall"),
    ("Chapter_12_Whats_Been_Stolen_v1_2026-05-10.md",
        "wsfc-vol1-ch12-whats-been-stolen", 213, 12,
        "Chapter 12 — What's Been Stolen"),
    ("Chapter_13_Who_Stops_This_v1_2026-05-10.md",
        "wsfc-vol1-ch13-who-stops-this", 214, 13,
        "Chapter 13 — Who Stops This"),
    ("Documentary_Record_v1_2026-05-10.md",
        "wsfc-vol1-documentary-record", 215, "Documentary Record",
        "Documentary Record"),
]


_METADATA_LINE_RE = re.compile(
    r"^\*(?:Volume\s+1|Draft\s+v\d|From:|Date:|Source:|Back matter|by\s+)"
)


def strip_metadata_block(body: str) -> str:
    """Drop the substrate's leading metadata block.

    The handoff names two specific patterns (`*Volume 1 — ...*`,
    `*Draft v1, ...*`) but the WSFC files use a slightly wider set
    ("*From:*", "*Date:*", "*Source:*", "*by Margaret Bird*", etc.).
    Strip a contiguous run of italic-only metadata lines that follow
    the leading H1, plus the `---` horizontal rule that often closes
    the metadata block. Stop at the first non-italic content line.
    """
    lines = body.splitlines()
    out: list[str] = []
    i = 0
    # Pass the H1 (and any blank line immediately after) through.
    while i < len(lines) and not lines[i].startswith("# "):
        out.append(lines[i])
        i += 1
    if i < len(lines):
        out.append(lines[i])  # the H1 itself
        i += 1
    # Now skip italic metadata + blank lines + a single closing ---.
    saw_metadata = False
    while i < len(lines):
        ln = lines[i].strip()
        if ln == "":
            i += 1
            continue
        if _METADATA_LINE_RE.match(ln):
            saw_metadata = True
            i += 1
            continue
        if saw_metadata and ln == "---":
            i += 1
            continue
        break
    # Re-emit the remainder, leading with a single blank line if needed.
    if out and out[-1].strip() != "":
        out.append("")
    out.extend(lines[i:])
    return "\n".join(out).rstrip() + "\n"


def word_count(body: str) -> int:
    return sum(1 for w in re.split(r"\s+", body) if w)


def render(plan_row: tuple[str, str, int, str | int, str]) -> tuple[Path, str]:
    sub_name, slug, order, chap_no, title = plan_row
    raw = (SUBSTRATE_DIR / sub_name).read_text(encoding="utf-8")
    body = strip_metadata_block(raw)
    wc = word_count(body)
    chap_no_yaml = (
        str(chap_no) if isinstance(chap_no, int) else f'"{chap_no}"'
    )
    frontmatter = (
        f"---\n"
        f'title: "{title}"\n'
        f'sourceWork: "{SOURCE_WORK}"\n'
        f'seriesLabel: "{SERIES_LABEL}"\n'
        f'slug: "{slug}"\n'
        f"order: {order}\n"
        f"chapterNumber: {chap_no_yaml}\n"
        f"wordCount: {wc}\n"
        f'sourceVersion: "{SOURCE_VERSION}"\n'
        f"lastSynced: {LAST_SYNCED}\n"
        f"---\n\n"
    )
    return OUT_DIR / f"{slug}.md", frontmatter + body


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for row in PLAN:
        out_path, content = render(row)
        out_path.write_text(content, encoding="utf-8")
        print(f"wrote {out_path.relative_to(REPO_ROOT)} ({row[1]})")


if __name__ == "__main__":
    main()
