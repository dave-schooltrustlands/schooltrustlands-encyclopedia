#!/usr/bin/env python3
"""
check_public_jargon.py — Audit public pages for substrate-internals leakage.

Crawls a configured list of URLs on https://schooltrusts.net, strips HTML
to visible text, and reports any text containing patterns that look like
build-time / repo-internals / framework jargon. These strings should not
appear in public-facing prose; their presence indicates substrate vocabulary
leaked through an AI-drafting pass or a stale methodology footer.

Output: page-by-page list of suspicious lines with surrounding context.
Exit code: 0 if no hits, 1 if any hits found (useful in CI).

Usage: python3 _tools/check_public_jargon.py
"""

import re
import sys
import urllib.request

BASE = "https://schooltrusts.net"

# Public surfaces to audit. /updates/ is excluded — its audience is
# tolerant of release-notes vocabulary and the page is the shipping log
# by design.
PAGES = [
    "/", "/start/", "/why/", "/explore/",
    "/reading/", "/atlas/", "/maps/", "/counting/",
    "/newsroom/", "/voices/", "/pro/",
    "/about/", "/about/founder/", "/about/how-this-works/",
    "/about/becoming/", "/about/cite/", "/about/rights/", "/about/corrections/",
    "/pro/metadata-schema/", "/pro/bylaws/", "/pro/dispute-resolution/",
    "/pro/governance/", "/pro/editorial-standards/",
    "/pro/collection-development/", "/pro/roles/",
    "/contribute/",
]

# Patterns to flag. Each entry is (pattern, description).
PATTERNS = [
    (r"\bsrc/[a-z0-9_/.*]+", "source-tree file path"),
    (r"\bscripts/[a-z0-9_/.*]+", "scripts-dir file path"),
    (r"\bpublic/[a-z0-9_/.*]+", "public-dir file path"),
    (r"\b[a-z_]+\.mjs\b", ".mjs filename"),
    (r"\b[a-z_]+\.astro\b", ".astro filename"),
    (r"\b[a-z_]+\.json\b", ".json filename"),
    (r"\bbuild[- ]time\b", "'build time' phrase"),
    (r"\bfrontmatter\b", "'frontmatter' jargon"),
    (r"\bsub-agent\b", "'sub-agent' jargon"),
    (r"\bsubstrate v[0-9.]+", "'substrate v…' jargon"),
    (r"\bcategorical bucket\b", "'categorical bucket' jargon"),
    (r"\bMapLibre\b", "'MapLibre' framework name"),
    (r"\bAstro\b(?! Sullivan)", "'Astro' framework name"),
    (r"\bTailwind\b", "'Tailwind' framework name"),
    (r"\bCloudflare Pages\b", "'Cloudflare Pages' product name"),
    (r"\bSupabase\b", "'Supabase' product name"),
    (r"\bderived from substrate\b", "'derived from substrate' phrase"),
]

# Pages where some jargon is contextually acceptable (release notes,
# contributor pages). These are excluded from specific patterns.
EXEMPTIONS = {
    "/about/how-this-works/": [r"\bsubstrate v[0-9.]+"],
    "/pro/metadata-schema/": [r"\.json\b", r"\bsrc/", r"\bscripts/"],
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Cowork-Jargon-Audit/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8", errors="replace")


def visible_text(html):
    html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL)
    html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&[a-z]+;", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def audit_page(url):
    full_url = BASE + url
    try:
        html = fetch(full_url)
    except Exception as e:
        print(f"  [error] {url}: {e}")
        return 0

    text = visible_text(html)
    exemptions = EXEMPTIONS.get(url, [])
    hits = []

    for pattern, description in PATTERNS:
        if any(re.search(ex, pattern) for ex in exemptions):
            continue
        for m in re.finditer(pattern, text, re.IGNORECASE):
            # Skip if the match is itself exempted
            if any(re.search(ex, m.group(0)) for ex in exemptions):
                continue
            start = max(0, m.start() - 60)
            end = min(len(text), m.end() + 60)
            context = text[start:end].strip()
            hits.append(f"  [{description}] …{context}…")

    if hits:
        print(f"=== {url} ===")
        for h in hits:
            print(h)
        print()

    return len(hits)


def main():
    total = 0
    for url in PAGES:
        total += audit_page(url)

    if total == 0:
        print("OK — no public-facing jargon found on audited surfaces.")
        return 0
    print(f"FAIL — {total} jargon hit(s) across audited surfaces.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
