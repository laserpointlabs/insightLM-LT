#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Deterministic tests for rag_grep tool (workbooks-only, literal vs regex).
"""
import sys
import os
import json
import tempfile
from pathlib import Path

# Add parent directory to path to import server
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import server
from server import handle_request


def _setup_test_data():
    temp_dir = tempfile.mkdtemp(prefix="rag-grep-test-")
    os.environ["INSIGHTLM_DATA_DIR"] = temp_dir
    server.DATA_DIR = temp_dir  # Override module-level cache of env var

    workbooks_dir = Path(temp_dir) / "workbooks" / "sample"
    docs_dir = workbooks_dir / "documents"
    docs_dir.mkdir(parents=True, exist_ok=True)

    (docs_dir / "a.txt").write_text(
        "alpha\n"
        "foo.bar\n"
        "FOO.BAR\n"
        "end\n",
        encoding="utf-8",
    )
    (docs_dir / "b.md").write_text(
        "This file mentions foobar and fooXbar.\n",
        encoding="utf-8",
    )

    workbook_json = {
        "name": "Sample Workbook",
        "documents": [
            {"filename": "a.txt", "path": "documents/a.txt"},
            {"filename": "b.md", "path": "documents/b.md"},
        ],
    }
    (workbooks_dir / "workbook.json").write_text(json.dumps(workbook_json), encoding="utf-8")

    server._document_cache.clear()
    server._cache_timestamp = None

    return temp_dir


def test_grep_literal_default():
    _setup_test_data()

    req = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": "rag_grep", "arguments": {"pattern": "foo.bar"}},
    }
    resp = handle_request(req)
    assert "error" not in resp, resp
    result = resp.get("result", {})
    files = result.get("results", [])
    assert len(files) == 1, files
    assert files[0]["filename"] == "a.txt"
    assert files[0]["match_count"] == 2  # foo.bar + FOO.BAR (case-insensitive default)


def test_grep_literal_case_sensitive():
    _setup_test_data()

    req = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {"name": "rag_grep", "arguments": {"pattern": "foo.bar", "case_sensitive": True}},
    }
    resp = handle_request(req)
    assert "error" not in resp, resp
    result = resp.get("result", {})
    files = result.get("results", [])
    assert len(files) == 1, files
    assert files[0]["filename"] == "a.txt"
    assert files[0]["match_count"] == 1  # only lowercase foo.bar


def test_grep_regex_mode():
    _setup_test_data()

    # regex: foo.anychar.bar should match "fooXbar" in b.md, but NOT "foobar"
    req = {
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {"name": "rag_grep", "arguments": {"pattern": r"foo.bar", "regex": True}},
    }
    resp = handle_request(req)
    assert "error" not in resp, resp
    result = resp.get("result", {})
    files = result.get("results", [])
    assert len(files) == 2, files
    filenames = sorted([f["filename"] for f in files])
    assert filenames == ["a.txt", "b.md"]


if __name__ == "__main__":
    # allow running standalone without pytest
    test_grep_literal_default()
    test_grep_literal_case_sensitive()
    test_grep_regex_mode()
    print("ok")
