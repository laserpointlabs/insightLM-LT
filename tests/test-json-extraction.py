#!/usr/bin/env python3
"""
Test JSON extraction from various LLM response formats
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'mcp-servers', 'workbook-dashboard'))

from server import parse_llm_response

# Test cases with various formats the LLM might return
test_cases = [
    {
        "name": "Clean JSON",
        "response": '{"value": 0.24, "label": "Main Gear MOS", "unit": ""}',
        "tile_type": "counter"
    },
    {
        "name": "JSON with explanation after",
        "response": '{"value": 2, "label": "Tests Due"}\n\nThis means there are 2 tests due soon.',
        "tile_type": "counter"
    },
    {
        "name": "JSON with text before",
        "response": 'Based on the documents, I found: {"value": 5, "label": "Components"}',
        "tile_type": "counter"
    },
    {
        "name": "JSON in markdown code block",
        "response": '```json\n{"value": 10, "label": "NDAs"}\n```',
        "tile_type": "counter"
    },
    {
        "name": "Nested JSON (warning with items)",
        "response": '{"value": 2, "label": "Tests", "severity": "medium", "items": ["Test 1", "Test 2"]}',
        "tile_type": "counter_warning"
    },
    {
        "name": "Multi-line JSON",
        "response": '''Here's the data:
{
  "value": 3,
  "label": "Documents",
  "unit": "files"
}

Hope this helps!''',
        "tile_type": "counter"
    }
]

print("=" * 70)
print("JSON Extraction Tests")
print("=" * 70)

passed = 0
failed = 0

for test in test_cases:
    print(f"\nTest: {test['name']}")
    print(f"Response: {test['response'][:80]}...")

    try:
        result = parse_llm_response(test['response'], {}, test['tile_type'])

        if result.get('success'):
            print(f"✅ PASS - Extracted: {result['result']}")
            passed += 1
        else:
            print(f"❌ FAIL - {result.get('error')}")
            failed += 1
    except Exception as e:
        print(f"❌ EXCEPTION - {e}")
        failed += 1

print("\n" + "=" * 70)
print(f"Results: {passed} passed, {failed} failed")
print("=" * 70)

sys.exit(0 if failed == 0 else 1)
