#!/usr/bin/env python3
"""
Test the RAG server with actual questions based on the documents.
Tests that the server can read and answer questions correctly.
"""
import json
import sys
from server import handle_request, read_workbook_file, search_workbooks

# Test questions based on actual document content
TEST_CASES = [
    {
        "name": "List all files",
        "request": {"method": "rag/list_files", "params": {}},
        "expected_files": ["aircraft_design_specifications.md", "aircraft_requirements.md", "test_plan.md", "odras_tool_overview.pdf", "ontology_driven_workflow.pdf"],
        "check": lambda result: all(any(f in str(file) for file in result) for f in ["aircraft_design", "aircraft_requirements", "test_plan"])
    },
    {
        "name": "Search for aircraft files",
        "request": {"method": "rag/search", "params": {"query": "aircraft", "limit": 10}},
        "check": lambda result: len(result) >= 2 and any("aircraft" in str(r).lower() for r in result)
    },
    {
        "name": "Read test_plan.md - check for Static Structural Tests",
        "workbook_id": "e5b85750-9a7e-4efe-9b9d-e11b4d190d5d",  # AC-5000 workbook
        "file_path": "documents/test_plan.md",
        "expected_content": ["Static Structural Tests", "Wing up-bending", "ultimate load", "3.5g"]
    },
    {
        "name": "Read aircraft_design_specifications.md - check for wing specs",
        "workbook_id": "e5b85750-9a7e-4efe-9b9d-e11b4d190d5d",
        "file_path": "documents/aircraft_design_specifications.md",
        "expected_content": ["Wing Configuration", "Aspect Ratio", "11.5", "swept wing"]
    },
    {
        "name": "Read aircraft_requirements.md - check for budget",
        "workbook_id": "e5b85750-9a7e-4efe-9b9d-e11b4d190d5d",
        "file_path": "documents/aircraft_requirements.md",
        "expected_content": ["$700M", "Budget", "ALT-X1"]
    },
]

def test_server():
    """Run all tests"""
    print("="* 80)
    print("RAG SERVER TESTS")
    print("=" * 80)
    print()

    passed = 0
    failed = 0

    for i, test in enumerate(TEST_CASES, 1):
        test_name = test["name"]
        print(f"Test {i}: {test_name}")
        print("-" * 80)

        try:
            if "request" in test:
                # Test via JSON request
                response = handle_request(test["request"])

                if "error" in response:
                    print(f"❌ FAILED: {response['error']}")
                    failed += 1
                    continue

                result = response.get("result", [])

                if "check" in test:
                    if test["check"](result):
                        print(f"✅ PASSED")
                        print(f"   Found {len(result) if isinstance(result, list) else 1} result(s)")
                        passed += 1
                    else:
                        print(f"❌ FAILED: Check function returned False")
                        print(f"   Result: {json.dumps(result, indent=2)[:200]}")
                        failed += 1
                else:
                    # Just check we got results
                    if result:
                        print(f"✅ PASSED")
                        passed += 1
                    else:
                        print(f"❌ FAILED: No results")
                        failed += 1

            elif "workbook_id" in test and "file_path" in test:
                # Test file reading
                content = read_workbook_file(test["workbook_id"], test["file_path"])

                if content.startswith("File not found") or content.startswith("Error"):
                    print(f"❌ FAILED: {content}")
                    failed += 1
                    continue

                # Check for expected content
                expected = test.get("expected_content", [])
                missing = []
                for expected_text in expected:
                    if expected_text not in content:
                        missing.append(expected_text)

                if not missing:
                    print(f"✅ PASSED")
                    print(f"   File size: {len(content)} characters")
                    print(f"   All expected content found: {', '.join(expected[:2])}...")
                    passed += 1
                else:
                    print(f"❌ FAILED: Missing expected content: {missing}")
                    print(f"   Content preview: {content[:200]}...")
                    failed += 1

        except Exception as e:
            print(f"❌ FAILED: Exception: {e}")
            failed += 1

        print()

    print("=" * 80)
    print(f"RESULTS: {passed} passed, {failed} failed out of {passed + failed} tests")
    print("=" * 80)

    if failed == 0:
        print("✅ ALL TESTS PASSED")
        return 0
    else:
        print(f"❌ {failed} TEST(S) FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(test_server())

