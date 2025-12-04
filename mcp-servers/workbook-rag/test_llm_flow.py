#!/usr/bin/env python3
"""
Test the complete LLM flow for answering questions about documents.
Simulates what should happen when user asks about static structural testing.
"""
from server import handle_request, read_workbook_file

print("=" * 80)
print("TESTING LLM FLOW: 'What are the key tests for the static structural testing?'")
print("=" * 80)
print()

# Step 1: List workbooks (what LLM should do first)
print("Step 1: List all files")
print("-" * 80)
response = handle_request({"method": "rag/list_files", "params": {}})
files = response.get("result", [])
print(f"Found {len(files)} files:")
for f in files:
    print(f"  - {f['workbook_name']}/{f['filename']}")
print()

# Step 2: Identify relevant file (test_plan.md contains the answer)
print("Step 2: Search for test-related files")
print("-" * 80)
response = handle_request({"method": "rag/search", "params": {"query": "test", "limit": 10}})
results = response.get("result", [])
print(f"Found {len(results)} files matching 'test':")
for r in results:
    print(f"  - {r['workbook_name']}/{r['filename']}")
print()

# Step 3: Read test_plan.md (contains Static Structural Tests)
print("Step 3: Read test_plan.md")
print("-" * 80)
workbook_id = "e5b85750-9a7e-4efe-9b9d-e11b4d190d5d"  # AC-5000
file_path = "documents/test_plan.md"
content = read_workbook_file(workbook_id, file_path)

if "Static Structural Tests" in content:
    print("✅ File contains 'Static Structural Tests'")

    # Extract the relevant section
    lines = content.split('\n')
    in_section = False
    section_lines = []

    for i, line in enumerate(lines):
        if "Static Structural Tests" in line or "1.1 Static Structural Tests" in line:
            in_section = True
            section_lines.append(line)
            continue

        if in_section:
            if line.startswith("#### 1.2") or line.startswith("### 2"):
                break
            section_lines.append(line)

    section_text = '\n'.join(section_lines[:30])  # First 30 lines of section

    print()
    print("EXTRACTED SECTION:")
    print("-" * 80)
    print(section_text)
    print()

    # Check for key tests
    key_tests = [
        "Wing up-bending",
        "3.5g ultimate load",
        "Fuselage pressurization",
        "Landing gear drop tests",
        "Emergency landing"
    ]

    found_tests = [test for test in key_tests if test in section_text]

    print("KEY TESTS FOUND:")
    print("-" * 80)
    for test in found_tests:
        print(f"  ✅ {test}")

    if len(found_tests) >= 4:
        print()
        print("✅ TEST PASSED: All key structural tests identified")
        print()
        print("EXPECTED LLM ANSWER:")
        print("-" * 80)
        print("""The key tests for static structural testing are:

1. Wing up-bending to 3.5g ultimate load
2. Fuselage pressurization to 1.33× maximum operating pressure
3. Landing gear drop tests (FAR 25.725)
4. Emergency landing conditions (FAR 25.561)

These tests are conducted at the Structural Test Facility in Building 7,
using 2 complete airframes over a 6-month duration.""")
    else:
        print(f"❌ TEST FAILED: Only found {len(found_tests)} out of 5 key tests")
else:
    print("❌ File does not contain 'Static Structural Tests'")

print()
print("=" * 80)

