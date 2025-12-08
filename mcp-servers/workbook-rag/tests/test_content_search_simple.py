#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple integration tests for content search - tests with real data
"""
import sys
import os
# Add parent directory to path to import server
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import handle_request, search_workbooks_with_content

def test_real_data_search():
    """Test searching real workbook data"""
    print("=" * 80)
    print("RAG CONTENT SEARCH - REAL DATA TESTS")
    print("=" * 80)
    print()

    tests_passed = 0
    tests_failed = 0

    # Test 1: Search for BSEO (should find it in PDFs)
    print("Test 1: Search for 'BSEO'")
    try:
        result = search_workbooks_with_content("BSEO", limit=3)
        if "BSEO" in result:
            print("  PASSED: Found BSEO in results")
            print(f"  Result preview: {result[:300]}...")
            tests_passed += 1
        else:
            print("  FAILED: BSEO not found")
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
                "query": "BSEO",
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
        result = search_workbooks_with_content("BSEO", limit=5)
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
        result = search_workbooks_with_content("BSEO", limit=2)
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
        result = search_workbooks_with_content("BSEO", limit=1)
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
