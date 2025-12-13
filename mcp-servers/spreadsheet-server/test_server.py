#!/usr/bin/env python3
"""
Test script for spreadsheet-server MCP server
"""
import json
import sys
from server import handle_request

def test_calculate_cell():
    """Test basic formula calculation"""
    print("=" * 80)
    print("TESTING SPREADSHEET SERVER - Formula Calculation")
    print("=" * 80)
    print()
    
    tests = [
        {
            "name": "Simple addition",
            "request": {
                "method": "spreadsheet/calculate_cell",
                "params": {
                    "sheet_id": "sheet1",
                    "cell_ref": "B1",
                    "formula": "=A1+10",
                    "context": {"A1": 100}
                }
            },
            "expected_value": 110
        },
        {
            "name": "Multiplication",
            "request": {
                "method": "spreadsheet/calculate_cell",
                "params": {
                    "sheet_id": "sheet1",
                    "cell_ref": "B1",
                    "formula": "=A1*2",
                    "context": {"A1": 50}
                }
            },
            "expected_value": 100
        },
        {
            "name": "Multiple dependencies",
            "request": {
                "method": "spreadsheet/calculate_cell",
                "params": {
                    "sheet_id": "sheet1",
                    "cell_ref": "C1",
                    "formula": "=A1+B1",
                    "context": {"A1": 10, "B1": 20}
                }
            },
            "expected_value": 30
        },
        {
            "name": "Missing dependency",
            "request": {
                "method": "spreadsheet/calculate_cell",
                "params": {
                    "sheet_id": "sheet1",
                    "cell_ref": "B1",
                    "formula": "=A1*2",
                    "context": {}  # A1 missing
                }
            },
            "expected_error": True
        },
        {
            "name": "Health check",
            "request": {
                "method": "spreadsheet/health",
                "params": {}
            },
            "expected_status": "healthy"
        }
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        print(f"Test: {test['name']}")
        try:
            response = handle_request(test['request'])
            print(f"  Request: {json.dumps(test['request'], indent=2)}")
            print(f"  Response: {json.dumps(response, indent=2)}")
            
            if 'expected_value' in test:
                if response.get('result', {}).get('value') == test['expected_value']:
                    print(f"  [PASS]")
                    passed += 1
                else:
                    print(f"  [FAIL] Expected {test['expected_value']}, got {response.get('result', {}).get('value')}")
                    failed += 1
            elif 'expected_error' in test and test['expected_error']:
                if response.get('result', {}).get('error'):
                    print(f"  [PASS] (error as expected)")
                    passed += 1
                else:
                    print(f"  [FAIL] Expected error, got {response.get('result', {})}")
                    failed += 1
            elif 'expected_status' in test:
                if response.get('result', {}).get('status') == test['expected_status']:
                    print(f"  [PASS]")
                    passed += 1
                else:
                    print(f"  [FAIL] Expected status {test['expected_status']}")
                    failed += 1
            else:
                print(f"  [SKIP] (no expected value)")
        except Exception as e:
            print(f"  [FAIL] Exception: {e}")
            failed += 1
        
        print()
    
    print("=" * 80)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 80)
    
    return 0 if failed == 0 else 1

if __name__ == '__main__':
    sys.exit(test_calculate_cell())
