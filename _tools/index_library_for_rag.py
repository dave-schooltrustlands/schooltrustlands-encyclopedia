#!/usr/bin/env python3
"""
index_library_for_rag.py — Build the Library's RAG index for the AI Librarian.

Walks the substrate-content directories under src/content/ (states, essays,
founders_library, scholarship), strips frontmatter and HTML, chunks the
text into ~400-token pieces with 50-token overlap, embeds each chunk via
OpenAI text-embedding-3-small, and inserts the rows into the
public.librarian_chunks table on Supabase.

Hello World scope (v57): truncate-and-rebuild on every run. Re-indexing
the whole corpus is cheap (low thousands of chunks, single-digit dollars
of embedding cost) and correctness matters more than incremental updates
at this stage. v57b can layer in change-detection later.

URL mapping — these are the canonical reader-facing URLs the Librarian
will cite back to in her answers:
  * src/content/states/us-XX.md          -> /reading/us-XX/
  * src/content/essays/<n>-<slug>.md     -> /reading/<slug>/
    (numeric prefix stripped; matches src/pages/reading/[slug].astro)
  * src/content/founders_library/<s>.md  -> /reading/founders-library/<s>/
  * src/content/scholarship/<s>.md       -> /reading/scholarship/<s>/

Usage:
    OPENAI_API_KEY=sk-... \
    SUPABASE_URL=https://<ref>.supabase.co \
    SUPABASE_SERVICE_KEY=<service-role-key> \
        python3 _tools/index_library_for_rag.py

The SUPABASE_SERVICE_KEY must be the service-role key (not the anon
key) because this script writes through RLS-protected tables.
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

try:
    OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
    SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
    SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
except KeyError as exc:
    sys.exit(
        f"Missing required environment variable: {exc.args[0]}. "
        "Set OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY."
    )

CHUNK_TOKENS = 400
CHUNK_OVERLAP = 50
EMBED_BATCH = 50
INSERT_BATCH = 100
EMBED_MODEL = "text-embedding-3-small"

# (glob, source_room, url_fn(Path) -> str, title_fn(Path) -> str)
SOURCES = [
    (
        "src/content/states/us-*.md",
        "atlas",
        lambda p: f"/reading/{p.stem}/",
        lambda p: p.stem.upper().replace("US-", "") + " state dossier",
    ),
    (
        "src/content/essays/*.md",
        "reading",
        lambda p: f"/reading/{re.sub(r'^[0-9]+-', '', p.stem)}/",
        lambda p: re.sub(r"^[0-9]+-", "", p.stem).replace("-", " ").title(),
    ),
    (
        "src/content/founders_library/*.md",
        "reading",
        lambda p: f"/reading/founders-library/{p.stem}/",
        lambda p: p.stem.replace("-", " ").title(),
    ),
    (
        "src/content/scholarship/*.md",
        "reading",
        lambda p: f"/reading/scholarship/{p.stem}/",
        lambda p: p.stem.replace("-", " ").title(),
    ),
]


def strip_frontmatter_and_tags(text: str) -> str:
    """Remove leading --- frontmatter --- block, then strip simple HTML."""
    text = re.sub(r"^---\s*\n.*?\n---\s*\n", "", text, count=1, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def chunk_text(text: str, chunk_tokens: int = CHUNK_TOKENS, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Word-window chunker. Words ~ tokens for prose; good enough for v57."""
    words = text.split()
    if not words:
        return []
    step = chunk_tokens - overlap
    chunks: list[str] = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_tokens])
        if chunk.strip():
            chunks.append(chunk)
        if i + chunk_tokens >= len(words):
            break
        i += step
    return chunks


def http_post_json(url: str, headers: dict, body: dict) -> dict:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    for k, v in headers.items():
        req.add_header(k, v)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} on {url}: {body_text}") from None


def http_delete(url: str, headers: dict) -> None:
    req = urllib.request.Request(url, method="DELETE")
    for k, v in headers.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} on {url}: {body_text}") from None


def embed_batch(texts: list[str]) -> list[list[float]]:
    payload = {"model": EMBED_MODEL, "input": texts}
    data = http_post_json(
        "https://api.openai.com/v1/embeddings",
        {"Authorization": f"Bearer {OPENAI_API_KEY}"},
        payload,
    )
    return [item["embedding"] for item in data["data"]]


def truncate_chunks_table() -> None:
    # PostgREST does not support TRUNCATE, but a DELETE with a permissive
    # filter is good enough for a low-thousands-row Hello World table.
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    url = f"{SUPABASE_URL}/rest/v1/librarian_chunks?id=gte.0"
    http_delete(url, headers)


def insert_chunks(rows: list[dict]) -> None:
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Prefer": "return=minimal",
    }
    for i in range(0, len(rows), INSERT_BATCH):
        batch = rows[i:i + INSERT_BATCH]
        http_post_json(f"{SUPABASE_URL}/rest/v1/librarian_chunks", headers, batch)


def main() -> None:
    print(f"v57 RAG indexer — repo root: {REPO_ROOT}")
    print("Truncating librarian_chunks table on Supabase…")
    truncate_chunks_table()

    all_rows: list[dict] = []
    files_seen = 0
    chunks_total = 0

    for glob_pattern, source_room, url_fn, title_fn in SOURCES:
        matches = sorted(REPO_ROOT.glob(glob_pattern))
        if not matches:
            print(f"  ⚠ no files matched {glob_pattern}")
            continue
        for path in matches:
            files_seen += 1
            text = strip_frontmatter_and_tags(path.read_text(encoding="utf-8"))
            chunks = chunk_text(text)
            if not chunks:
                print(f"  · {path.name}: empty after strip — skipping")
                continue

            source_url = url_fn(path)
            source_title = title_fn(path)

            for batch_start in range(0, len(chunks), EMBED_BATCH):
                batch_chunks = chunks[batch_start:batch_start + EMBED_BATCH]
                embeddings = embed_batch(batch_chunks)
                for idx, (chunk, embedding) in enumerate(zip(batch_chunks, embeddings)):
                    all_rows.append({
                        "source_url": source_url,
                        "source_title": source_title,
                        "source_room": source_room,
                        "chunk_index": batch_start + idx,
                        "chunk_text": chunk,
                        "embedding": embedding,
                    })
                # Gentle pacing — OpenAI tier-1 rate limits are forgiving but
                # not infinite. Avoid back-to-back bursts of 100k tokens.
                time.sleep(0.1)
            chunks_total += len(chunks)
            print(f"  · {path.name}: {len(chunks)} chunks -> {source_url}")

    print(f"\nFiles processed: {files_seen}")
    print(f"Total chunks: {chunks_total}")
    print(f"Rows to insert: {len(all_rows)}")
    print("Inserting into librarian_chunks…")
    insert_chunks(all_rows)
    print("Done.")


if __name__ == "__main__":
    main()
