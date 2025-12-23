#!/usr/bin/env python3
"""
Test Excel and CSV file extraction
"""
import sys
import os
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import read_file, extract_text_from_excel

def test_csv_reading():
    """Test CSV file reading"""
    print("Test 1: CSV file reading")
    print("-" * 80)

    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='') as f:
        f.write("Name,Age,Department\n")
        f.write("John Doe,30,Engineering\n")
        f.write("Jane Smith,25,Marketing\n")
        f.write("Bob Johnson,35,Sales\n")
        csv_path = f.name

    try:
        content = read_file(Path(csv_path))

        assert "Name,Age,Department" in content, "Should contain CSV headers"
        assert "John Doe" in content, "Should contain CSV data"
        assert "Engineering" in content, "Should contain department data"

        print(f"  ✓ CSV read successfully ({len(content)} chars)")
        print(f"  Content preview: {content[:100]}...")
        return True
    finally:
        os.unlink(csv_path)

def test_excel_extraction():
    """Test Excel file extraction"""
    print("\nTest 2: Excel file extraction")
    print("-" * 80)

    try:
        import pandas as pd

        # Create a test Excel file
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as f:
            excel_path = f.name

        # Create Excel with multiple sheets
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # Sheet 1: Employee data
            df1 = pd.DataFrame({
                'Name': ['Alice', 'Bob', 'Charlie'],
                'Age': [28, 32, 45],
                'Department': ['HR', 'IT', 'Finance']
            })
            df1.to_excel(writer, sheet_name='Employees', index=False)

            # Sheet 2: Compliance data
            df2 = pd.DataFrame({
                'Standard': ['ISO 9001', 'FAA Part 23', 'DO-178C'],
                'Status': ['Compliant', 'In Progress', 'Compliant'],
                'Year': [2024, 2025, 2024]
            })
            df2.to_excel(writer, sheet_name='Compliance', index=False)

        try:
            # Test extraction
            content = extract_text_from_excel(Path(excel_path))

            print(f"  Content length: {len(content)} characters")

            # Verify both sheets are included
            assert "Sheet: Employees" in content, "Should include Employees sheet"
            assert "Sheet: Compliance" in content, "Should include Compliance sheet"

            # Verify data is included
            assert "Alice" in content, "Should include employee names"
            assert "ISO 9001" in content, "Should include compliance standards"
            assert "FAA Part 23" in content, "Should include FAA standards"

            print("  ✓ Excel extraction successful")
            print(f"  Content preview:\n{content[:300]}...")
            return True
        finally:
            # Close any open file handles before deletion
            try:
                os.unlink(excel_path)
            except PermissionError:
                pass  # File still in use, that's OK for test purposes

    except ImportError:
        print("  ⚠ pandas/openpyxl not installed, skipping Excel test")
        return True

def test_excel_via_read_file():
    """Test Excel reading via main read_file function"""
    print("\nTest 3: Excel via read_file()")
    print("-" * 80)

    try:
        import pandas as pd

        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as f:
            excel_path = f.name

        # Create simple Excel file
        df = pd.DataFrame({
            'Product': ['Widget A', 'Widget B'],
            'Price': [100, 150],
            'Stock': [50, 30]
        })
        df.to_excel(excel_path, sheet_name='Inventory', index=False, engine='openpyxl')

        try:
            # Test read_file
            content = read_file(Path(excel_path))

            assert "Widget A" in content, "Should extract Excel data"
            assert "Price" in content, "Should include headers"
            assert not content.startswith("Error"), "Should not have errors"

            print(f"  ✓ read_file() handles Excel correctly")
            print(f"  Content: {content[:200]}...")
            return True
        finally:
            try:
                os.unlink(excel_path)
            except PermissionError:
                pass  # File still in use, that's OK

    except ImportError:
        print("  ⚠ pandas/openpyxl not installed, skipping")
        return True

def run_tests():
    """Run all tests"""
    print("=" * 80)
    print("EXCEL AND CSV SUPPORT TESTS")
    print("=" * 80)
    print()

    tests = [
        test_csv_reading,
        test_excel_extraction,
        test_excel_via_read_file,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            failed += 1
            print(f"  ✗ FAILED: {e}")
            import traceback
            traceback.print_exc()

    print()
    print("=" * 80)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 80)

    if failed == 0:
        print("✓ ALL TESTS PASSED")
        return 0
    else:
        print(f"✗ {failed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())
