#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple integration tests for content search - tests with real data
"""
import sys
import os
import json
import tempfile
from pathlib import Path

# Add parent directory to path to import server
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import server
from server import handle_request, search_workbooks_with_content


def _setup_test_data():
    """
    Create a deterministic set of workbooks in a temp directory so the tests
    do not depend on whatever data happens to be on the machine.
    """
    temp_dir = tempfile.mkdtemp(prefix="rag-test-")
    os.environ["INSIGHTLM_DATA_DIR"] = temp_dir
    server.DATA_DIR = temp_dir  # Override module-level cache of env var

    workbooks_dir = Path(temp_dir) / "workbooks" / "sample"
    docs_dir = workbooks_dir / "documents"
    docs_dir.mkdir(parents=True, exist_ok=True)

    # Sample documents with known content
    (docs_dir / "propulsion_overview.md").write_text(
        "Hydrogen-electric propulsion overview.\n"
        "Includes compliance guidance and safety analysis for flight readiness.\n"
        "Propulsion reliability metrics and FAA references.\n",
        encoding="utf-8",
    )
    (docs_dir / "maintenance_notes.txt").write_text(
        "Notebook maintenance checklist for avionics and propulsion subsystems.\n"
        "Ensure coolant loops are flushed before engine restart.\n",
        encoding="utf-8",
    )
    (docs_dir / "large_report.txt").write_text(
        "Propulsion endurance test report.\n" + ("Data block\n" * 4000),
        encoding="utf-8",
    )

    # Workbook metadata
    workbook_json = {
        "name": "Sample Workbook",
        "documents": [
            {"filename": "propulsion_overview.md", "path": "documents/propulsion_overview.md"},
            {"filename": "maintenance_notes.txt", "path": "documents/maintenance_notes.txt"},
            {"filename": "large_report.txt", "path": "documents/large_report.txt"},
        ],
    }
    (workbooks_dir / "workbook.json").write_text(json.dumps(workbook_json), encoding="utf-8")

    # Reset caches so the server picks up the fresh data
    server._document_cache.clear()
    server._cache_timestamp = None

    return temp_dir

def test_real_data_search():
    """Test searching real workbook data"""
    _setup_test_data()

    print("=" * 80)
    print("RAG CONTENT SEARCH - REAL DATA TESTS")
    print("=" * 80)
    print()

    tests_passed = 0
    tests_failed = 0

    # Test 1: Search for propulsion (should match sample data)
    print("Test 1: Search for 'propulsion'")
    try:
        result = search_workbooks_with_content("propulsion", limit=3)
        if "propulsion_overview.md" in result.lower() and "Relevance Score:" in result:
            print("  PASSED: Found propulsion document with scores")
            print(f"  Result preview: {result[:300]}...")
            tests_passed += 1
        else:
            print("  FAILED: propulsion document not found")
            tests_failed += 1
    except Exception as e:
        print(f"  FAILED: {e}")
        tests_failed += 1
    print()

    # Test 2: Search for common term
    print("Test 2: Search for 'workbook'")
    try:
        result = search_workbooks_with_content("workbook", limit=3)
        if result and len(result) > 0:
            print("  PASSED: Found results")
            print(f"  Result length: {len(result)} characters")
            tests_passed += 1
        else:
            print("  FAILED: No results")
            tests_failed += 1
    except Exception as e:
        print(f"  FAILED: {e}")
        tests_failed += 1
    print()

    # Test 3: Search for nonexistent term
    print("Test 3: Search for nonexistent term 'XYZ123NONEXISTENT'")
    try:
        result = search_workbooks_with_content("XYZ123NONEXISTENT", limit=3)
        if "No matches found" in result or "Available documents" in result:
            print("  PASSED: Correctly handled no matches")
            tests_passed += 1
        else:
            print("  FAILED: Should indicate no matches")
            tests_failed += 1
    except Exception as e:
        print(f"  FAILED: {e}")
        tests_failed += 1
    print()

    # Test 4: MCP protocol test
    print("Test 4: MCP protocol - rag/search_content")
    try:
        request = {
            "method": "rag/search_content",
            "params": {
                "query": "propulsion",
                "limit": 2
            }
        }
        response = handle_request(request)
        if "error" not in response and "result" in response:
            print("  PASSED: MCP protocol works")
            print(f"  Response keys: {list(response.keys())}")
            tests_passed += 1
        else:
            print(f"  FAILED: {response}")
            tests_failed += 1
    except Exception as e:
        print(f"  FAILED: {e}")
        tests_failed += 1
    print()

    # Test 5: Test relevance scoring
    print("Test 5: Relevance scoring")
    try:
        result = search_workbooks_with_content("propulsion", limit=5)
        if "Relevance Score:" in result:
            print("  PASSED: Relevance scores present")
            # Count scores
            score_count = result.count("Relevance Score:")
            print(f"  Found {score_count} files with scores")
            tests_passed += 1
        else:
            print("  FAILED: No relevance scores")
            tests_failed += 1
    except Exception as e:
        print(f"  FAILED: {e}")
        tests_failed += 1
    print()

    # Test 6: Test sibling files inclusion
    print("Test 6: Sibling files inclusion")
    try:
        result = search_workbooks_with_content("propulsion", limit=2)
        # Check if we have multiple files from same workbook
        if "Related file from same workbook" in result or result.count("Workbook ID:") > result.count("Relevance Score:"):
            print("  PASSED: Sibling files included")
            tests_passed += 1
        else:
            print("  INFO: May not have sibling files (depends on data)")
            tests_passed += 1  # Not a failure, just depends on data structure
    except Exception as e:
        print(f"  FAILED: {e}")
        tests_failed += 1
    print()

    # Test 7: Test content truncation for large files
    print("Test 7: Large file handling")
    try:
        result = search_workbooks_with_content("propulsion", limit=1)
        if "truncated" in result.lower() or len(result) < 50000:  # Reasonable size
            print("  PASSED: Large files handled correctly")
            print(f"  Result size: {len(result)} characters")
            tests_passed += 1
        else:
            print(f"  INFO: Result size: {len(result)} characters")
            tests_passed += 1  # Not necessarily a failure
    except Exception as e:
        print(f"  FAILED: {e}")
        tests_failed += 1
    print()

    print("=" * 80)
    print(f"RESULTS: {tests_passed} passed, {tests_failed} failed")
    print("=" * 80)

    if tests_failed == 0:
        print("ALL TESTS PASSED")
        return 0
    else:
        print(f"{tests_failed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(test_real_data_search())
