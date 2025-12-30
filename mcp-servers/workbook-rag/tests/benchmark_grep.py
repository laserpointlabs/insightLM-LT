#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Deterministic micro-benchmark + capability comparison for rag_grep.

This is not a unit test (no assertions by default); it's a repeatable harness
to compare:
  - literal search (regex=false) vs regex search (regex=true)
  - case sensitive vs insensitive
  - match counts + elapsed time

Run:
  python mcp-servers/workbook-rag/tests/benchmark_grep.py
"""
import os
import sys
import json
import time
import tempfile
from pathlib import Path

# Add parent directory to path to import server
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import server
from server import handle_request


def _setup_test_data(lines: int = 20000) -> str:
    """Create a deterministic corpus with a mix of literal + regex-friendly patterns."""
    temp_dir = tempfile.mkdtemp(prefix="rag-grep-bench-")
    os.environ["INSIGHTLM_DATA_DIR"] = temp_dir
    server.DATA_DIR = temp_dir  # Override module-level cache of env var

    wb_dir = Path(temp_dir) / "workbooks" / "sample"
    docs_dir = wb_dir / "documents"
    docs_dir.mkdir(parents=True, exist_ok=True)

    # File with many lines (repeatable) and a few injected patterns.
    big = []
    for i in range(lines):
        if i % 1000 == 0:
            big.append(f"MARKER foo.bar line={i}\n")      # literal dot
            big.append(f"MARKER fooXbar line={i}\n")      # regex dot-friendly
            big.append(f"MARKER foo    bar line={i}\n")   # regex whitespace-friendly
            big.append(f"MARKER ERROR_42 line={i}\n")     # regex character class friendly
        else:
            big.append(f"filler line {i} lorem ipsum\n")
    (docs_dir / "big.txt").write_text("".join(big), encoding="utf-8")

    # Smaller file to show case behavior
    (docs_dir / "case.txt").write_text("foo.bar\nFOO.BAR\n", encoding="utf-8")

    workbook_json = {
        "name": "Sample Workbook",
        "documents": [
            {"filename": "big.txt", "path": "documents/big.txt"},
            {"filename": "case.txt", "path": "documents/case.txt"},
        ],
    }
    (wb_dir / "workbook.json").write_text(json.dumps(workbook_json), encoding="utf-8")

    server._document_cache.clear()
    server._cache_timestamp = None

    return temp_dir


def _call_rag_grep(pattern: str, *, regex: bool, case_sensitive: bool, max_results: int = 50, max_matches_per_file: int = 20):
    req = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "rag_grep",
            "arguments": {
                "pattern": pattern,
                "regex": regex,
                "case_sensitive": case_sensitive,
                "max_results": max_results,
                "max_matches_per_file": max_matches_per_file,
            },
        },
    }
    resp = handle_request(req)
    if "error" in resp:
        raise RuntimeError(resp["error"])
    return resp.get("result", {})


def _summarize(result: dict) -> dict:
    files = result.get("results", [])
    total_files = len(files)
    total_matches = sum(int(f.get("match_count", 0)) for f in files)
    return {
        "files": total_files,
        "matches": total_matches,
        "truncated": bool(result.get("truncated", False)),
    }


def main():
    _setup_test_data(lines=20000)

    cases = [
        # literal dot vs regex dot
        ("foo.bar", False, False, "literal: find exact 'foo.bar'"),
        (r"foo.bar", True, False, "regex: '.' matches any char (foo.bar matches fooXbar too)"),
        # whitespace pattern (literal can't express it)
        ("foo    bar", False, False, "literal: exact spaces"),
        (r"foo\s+bar", True, False, r"regex: \s+ matches variable whitespace"),
        # case sensitivity
        ("foo.bar", False, False, "literal insensitive (default)"),
        ("foo.bar", False, True, "literal case-sensitive"),
    ]

    print("=" * 90)
    print("rag_grep benchmark / capability check (deterministic)")
    print("=" * 90)
    print()

    for pattern, regex, case_sensitive, label in cases:
        # Warm cache to reduce IO impact variance
        _call_rag_grep(pattern, regex=regex, case_sensitive=case_sensitive, max_matches_per_file=50)

        start = time.perf_counter()
        result = _call_rag_grep(pattern, regex=regex, case_sensitive=case_sensitive, max_matches_per_file=50)
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        summary = _summarize(result)

        print(f"- {label}")
        print(f"  pattern={pattern!r} regex={regex} case_sensitive={case_sensitive}")
        print(f"  -> files={summary['files']} matches={summary['matches']} truncated={summary['truncated']} time={elapsed_ms:.2f}ms")

    print()
    print("Notes:")
    print("- Literal mode is typically faster for simple substrings and safer for LLM usage by default.")
    print("- Regex mode is strictly more expressive (e.g., \\\\s+, character classes, anchors), but can be slower.")
    print("- For LLM workflows: keep regex=false unless a regex is clearly intended.")


if __name__ == "__main__":
    main()
