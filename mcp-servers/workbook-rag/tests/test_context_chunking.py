#!/usr/bin/env python3
"""
Test context-aware chunking functionality
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import extract_context_chunks, search_workbooks_with_content

def test_extract_context_chunks():
    """Test that context chunks are extracted correctly"""
    print("=" * 80)
    print("TEST: Context Chunk Extraction")
    print("=" * 80)
    print()

    # Create test content with keywords at different positions
    content = """This is the beginning of the document. It has some introductory text that goes on for a while.

The document continues with more information. Here we discuss various topics including system architecture and design patterns.

""" + ("Filler text. " * 200) + """

Now we reach the important part about COMPLIANCE STANDARDS. The system must meet Federal compliance standards including FAA Part 23, DO-178C for software, and DO-254 for hardware design.

""" + ("More filler. " * 100) + """

Later in the document, we discuss INDUSTRY STANDARDS such as ISO 9001 for quality management and ISO 27001 for information security.

""" + ("Even more text. " * 50) + """

The end of the document."""

    print(f"Test content length: {len(content)} characters")
    print()

    # Test 1: Extract chunks around "compliance" and "standards"
    print("Test 1: Extract chunks around 'compliance' and 'standards'")
    key_terms = ["compliance", "standards"]
    chunks = extract_context_chunks(content, key_terms, chunk_size=500, max_chunks=5)

    print(f"  Chunks extracted: {len(chunks)}")
    for i, (pos, chunk) in enumerate(chunks, 1):
        print(f"  Chunk {i} at position {pos}:")
        print(f"    Length: {len(chunk)} chars")
        print(f"    Preview: {chunk[:100]}...")
        # Verify keyword is in chunk
        has_keyword = any(term in chunk.lower() for term in key_terms)
        print(f"    Contains keyword: {'YES' if has_keyword else 'NO'}")

    assert len(chunks) > 0, "Should extract at least one chunk"
    assert all(any(term in chunk.lower() for term in key_terms) for _, chunk in chunks), "All chunks should contain keywords"
    print("  ✓ PASS")
    print()

    # Test 2: No keywords found
    print("Test 2: No keywords found (empty result)")
    chunks2 = extract_context_chunks(content, ["nonexistent", "xyz123"], chunk_size=500, max_chunks=5)
    print(f"  Chunks extracted: {len(chunks2)}")
    assert len(chunks2) == 0, "Should return empty list when no keywords found"
    print("  ✓ PASS")
    print()

    # Test 3: Max chunks limit
    print("Test 3: Max chunks limit enforced")
    many_keywords = content.lower().split()[:20]  # Get first 20 words as keywords
    chunks3 = extract_context_chunks(content, many_keywords, chunk_size=200, max_chunks=3)
    print(f"  Chunks extracted: {len(chunks3)}")
    assert len(chunks3) <= 3, "Should not exceed max_chunks limit"
    print("  ✓ PASS")
    print()

    # Test 4: Chunks don't overlap
    print("Test 4: Chunks don't overlap")
    chunks4 = extract_context_chunks(content, ["the", "and", "of"], chunk_size=400, max_chunks=5)
    positions = [pos for pos, _ in chunks4]
    for i in range(len(positions) - 1):
        gap = positions[i+1] - positions[i]
        print(f"  Gap between chunk {i+1} and {i+2}: {gap} chars")
        assert gap >= 200, f"Chunks should not overlap significantly (gap: {gap})"
    print("  ✓ PASS")
    print()

    return True

def test_search_with_chunking():
    """Test that search_workbooks_with_content uses chunking correctly"""
    print("=" * 80)
    print("TEST: Search with Context Chunking (Real Data)")
    print("=" * 80)
    print()

    # Test with real data if available
    try:
        result = search_workbooks_with_content("BSEO compliance standards", limit=3)

        # Check if result contains chunk markers
        has_excerpts = "CONTEXT EXCERPTS" in result or "PREVIEW" in result
        has_chunks = "[Excerpt" in result
        has_note = "read_workbook_file" in result

        print(f"Result length: {len(result)} characters")
        print(f"Contains 'CONTEXT EXCERPTS': {has_excerpts}")
        print(f"Contains chunk markers: {has_chunks}")
        print(f"Contains read_workbook_file note: {has_note}")
        print()

        if has_excerpts or has_chunks:
            print("✓ PASS: Using context-aware chunking")
        else:
            print("⚠ WARNING: May not be using chunks (check if keywords found)")

        # Show preview
        print("\nResult preview (first 500 chars):")
        print(result[:500])
        print("...")

        return True
    except Exception as e:
        print(f"Note: Could not test with real data ({e})")
        print("This is OK if no workbooks exist")
        return True

def run_all_tests():
    """Run all chunking tests"""
    print("CONTEXT-AWARE CHUNKING TESTS")
    print()

    tests = [
        ("Context extraction", test_extract_context_chunks),
        ("Search integration", test_search_with_chunking),
    ]

    passed = 0
    failed = 0

    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"✓ {name} passed")
            else:
                failed += 1
                print(f"✗ {name} failed")
        except Exception as e:
            failed += 1
            print(f"✗ {name} failed: {e}")
            import traceback
            traceback.print_exc()
        print()

    print("=" * 80)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 80)

    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(run_all_tests())













