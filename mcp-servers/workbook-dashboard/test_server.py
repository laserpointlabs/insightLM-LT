#!/usr/bin/env python3
"""
Quick test script for the MCP Dashboard Server
"""
import sys
import json

# Mock workbook data for testing
test_workbook = {
    "id": "wb-test-123",
    "name": "Test Workbook",
    "documents": [
        {"id": "1", "filename": "contract1.pdf", "addedAt": "2025-01-01T00:00:00Z", "size": 1024},
        {"id": "2", "filename": "contract2.docx", "addedAt": "2025-01-02T00:00:00Z", "size": 2048},
        {"id": "3", "filename": "notes.md", "addedAt": "2025-01-03T00:00:00Z", "size": 512},
    ]
}

# Test code generation
from server import generate_counter_code, generate_graph_code, generate_table_code, generate_text_code, execute_visualization_code

def test_counter():
    print("Testing Counter...")
    code = generate_counter_code("How many documents?", test_workbook)
    result = execute_visualization_code(code)
    print(f"Result: {json.dumps(result, indent=2)}")
    assert result.get('type') == 'counter'
    assert result.get('value') == 3
    print("✓ Counter test passed!\n")

def test_graph():
    print("Testing Graph (Pie Chart)...")
    code = generate_graph_code("Show document types", test_workbook, "pie")
    result = execute_visualization_code(code)
    print(f"Result type: {result.get('type')}")
    print(f"Chart type: {result.get('chartType')}")
    print(f"Has HTML: {'html' in result}")
    assert result.get('type') == 'graph'
    assert result.get('chartType') == 'pie'
    assert 'html' in result
    print("✓ Graph test passed!\n")

def test_table():
    print("Testing Table...")
    code = generate_table_code("List all documents", test_workbook)
    result = execute_visualization_code(code)
    print(f"Result: {json.dumps(result, indent=2)}")
    assert result.get('type') == 'table'
    assert len(result.get('rows', [])) == 3
    print("✓ Table test passed!\n")

def test_text():
    print("Testing Text Summary...")
    code = generate_text_code("Summarize documents", test_workbook)
    result = execute_visualization_code(code)
    print(f"Result: {json.dumps(result, indent=2)}")
    assert result.get('type') == 'text'
    assert 'content' in result
    print("✓ Text test passed!\n")

if __name__ == "__main__":
    print("=" * 50)
    print("MCP Dashboard Server - Unit Tests")
    print("=" * 50 + "\n")

    try:
        test_counter()
        test_graph()
        test_table()
        test_text()

        print("=" * 50)
        print("All tests passed! ✓")
        print("=" * 50)
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
