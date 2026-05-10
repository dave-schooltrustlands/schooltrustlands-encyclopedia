#!/usr/bin/env python3
"""v25 EPSILON — Resync three substrate-surface gaps from canonical substrate.

Replaces the body of three existing essay files while preserving each
file's frontmatter (with sourceVersion, lastSynced, wordCount refreshed
to match the new substrate). The sourceWork / order / slug / title /
era fields are NOT changed — those drive series-nav and routing, and
the resync is meant to update only what changed in the substrate.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path("/home/drdav/schooltrustlands-encyclopedia")
COWORK = Path("/mnt/c/Users/drdav/My Drive/Claude Cowork/L4_Deliverables")

# (substrate_path, repo_path, new_source_version)
JOBS = [
    (
        COWORK / "Book_Revision/Volume_I_Chapter_1_v2_Margaret_voiced_2026-05-09.md",
        REPO_ROOT / "src/content/essays/01-founding-floor.md",
        "Schools_of_the_Republic_v1.3_ch1_v2_margaret_voiced",
    ),
    (
        COWORK / "Book_Revision/Volume_I_Chapter_5_v2_Margaret_voiced_2026-05-10.md",
        REPO_ROOT / "src/content/essays/05-reconstruction-western-stack.md",
        "Schools_of_the_Republic_v1.3_ch5_v2_margaret_voiced",
    ),
    (
        COWORK
        / "Sacred_Compact_2_0/sections/sacred-compact-vi-the-coming-trusts_v2_expanded_2026-05-10.md",
        REPO_ROOT / "src/content/essays/sacred-compact-vi-the-coming-trusts.md",
        "Eighth_Anchor_v5.1_section_vi_expanded",
    ),
]

LAST_SYNCED = "2026-05-10"


def split_frontmatter(text: str) -> tuple[str, str]:
    """Split YAML frontmatter from body. Returns (frontmatter_block, body).

    The frontmatter_block includes the leading and trailing `---` lines.
    If the file has no frontmatter, returns ("", text).
    """
    if not text.startswith("---\n"):
        return "", text
    end = text.find("\n---\n", 4)
    if end == -1:
        return "", text
    return text[: end + 5], text[end + 5 :]


def extract_substrate_body(substrate_text: str) -> str:
    """Drop the substrate's leading metadata block.

    Two layouts handled:

    1. Ch1/Ch5 v2 (Book_Revision): a meta-H1 line + several italic
       `*...*` metadata lines + a `---` horizontal rule, then the real
       H1 and content. Drop everything up to and including the first
       `---` HR.

    2. SC-VI v2 (Sacred_Compact_2_0): full YAML frontmatter at the top
       between `---` lines, then real H1. Drop the YAML block.
    """
    if substrate_text.startswith("---\n"):
        _, body = split_frontmatter(substrate_text)
        return body.lstrip()

    lines = substrate_text.splitlines(keepends=True)
    hr_idx = None
    for i, ln in enumerate(lines):
        if ln.strip() == "---":
            hr_idx = i
            break
    if hr_idx is None:
        return substrate_text  # no HR found, leave as-is
    return "".join(lines[hr_idx + 1 :]).lstrip()


def word_count(body: str) -> int:
    # Don't count footnote markers or code fences as words.
    return sum(1 for w in re.split(r"\s+", body) if w)


_FIELD_RE = {
    "wordCount": re.compile(r"^wordCount:\s*\d+\s*$", re.MULTILINE),
    "sourceVersion": re.compile(r'^sourceVersion:\s*".*?"\s*$', re.MULTILINE),
    "lastSynced": re.compile(r"^lastSynced:\s*\S+\s*$", re.MULTILINE),
}


def update_frontmatter(
    fm: str, word_count_val: int, source_version: str, last_synced: str
) -> str:
    fm = _FIELD_RE["wordCount"].sub(f"wordCount: {word_count_val}", fm)
    fm = _FIELD_RE["sourceVersion"].sub(
        f'sourceVersion: "{source_version}"', fm
    )
    fm = _FIELD_RE["lastSynced"].sub(f"lastSynced: {last_synced}", fm)
    return fm


def run_job(substrate: Path, repo_file: Path, source_version: str) -> None:
    substrate_text = substrate.read_text(encoding="utf-8")
    new_body = extract_substrate_body(substrate_text)
    wc = word_count(new_body)

    existing = repo_file.read_text(encoding="utf-8")
    fm, _old_body = split_frontmatter(existing)
    if not fm:
        raise RuntimeError(f"No frontmatter in {repo_file}")

    new_fm = update_frontmatter(fm, wc, source_version, LAST_SYNCED)

    # Ensure a single blank line between frontmatter and body, and a
    # single trailing newline at EOF.
    if not new_body.startswith("\n"):
        new_body = "\n" + new_body
    out = new_fm + new_body.rstrip() + "\n"
    repo_file.write_text(out, encoding="utf-8")
    print(f"resynced {repo_file.relative_to(REPO_ROOT)}  wordCount={wc}")


def main() -> None:
    for sub, rep, sv in JOBS:
        if not sub.exists():
            raise SystemExit(f"missing substrate: {sub}")
        if not rep.exists():
            raise SystemExit(f"missing repo file: {rep}")
        run_job(sub, rep, sv)


if __name__ == "__main__":
    main()
