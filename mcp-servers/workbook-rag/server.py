#!/usr/bin/env python3
"""
Workbook RAG Server - On-Demand Reading with Content Search
Searches document content (PDFs, Word, text) using smart text matching.
"""
import os
import sys
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional

# Get data directory from environment
DATA_DIR = os.environ.get("INSIGHTLM_DATA_DIR", "")

# In-memory cache for documents (keyed by filepath, stores (content, mtime))
_document_cache: Dict[str, tuple[str, float]] = {}
_cache_timestamp: Optional[float] = None

def get_data_dir() -> str:
    """Get application data directory"""
    if DATA_DIR:
        return DATA_DIR

    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA", "")
        if appdata:
            return str(Path(appdata) / "insightLM-LT")
    else:
        home = os.environ.get("HOME", "")
        if home:
            return str(Path(home) / ".config" / "insightLM-LT")

    raise ValueError("Could not determine data directory")


def extract_text_from_pdf(file_path: Path) -> str:
    """Extract text from PDF"""
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(file_path))
        text_parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
        return '\n\n'.join(text_parts) if text_parts else ""
    except Exception as e:
        return f"Error extracting PDF: {e}"


def extract_text_from_docx(file_path: Path) -> str:
    """Extract text from DOCX"""
    try:
        from docx import Document
        doc = Document(str(file_path))
        text_parts = []
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text_parts.append(paragraph.text)
        for table in doc.tables:
            for row in table.rows:
                row_text = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if row_text:
                    text_parts.append(' | '.join(row_text))
        return '\n\n'.join(text_parts) if text_parts else ""
    except Exception as e:
        return f"Error extracting DOCX: {e}"


def extract_text_from_excel(file_path: Path) -> str:
    """Extract text from Excel (XLSX, XLS)"""
    try:
        import pandas as pd

        # Read all sheets
        excel_file = pd.ExcelFile(str(file_path))
        text_parts = []

        for sheet_name in excel_file.sheet_names:
            df = pd.read_excel(excel_file, sheet_name=sheet_name)

            # Add sheet name as header
            text_parts.append(f"=== Sheet: {sheet_name} ===")

            # Convert dataframe to text representation
            # Include column headers and all rows
            text_parts.append(df.to_string(index=False))
            text_parts.append("")  # Empty line between sheets

        return '\n\n'.join(text_parts) if text_parts else ""
    except Exception as e:
        return f"Error extracting Excel: {e}"


def read_file(file_path: Path) -> str:
    """Read any file type"""
    ext = file_path.suffix.lower()

    if ext == '.pdf':
        return extract_text_from_pdf(file_path)
    elif ext in ['.docx', '.doc']:
        return extract_text_from_docx(file_path)
    elif ext in ['.xlsx', '.xls']:
        return extract_text_from_excel(file_path)
    else:
        # Text file (includes .csv, .txt, .md, etc.)
        encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']
        for encoding in encodings:
            try:
                return file_path.read_text(encoding=encoding)
            except UnicodeDecodeError:
                continue
        return f"Could not decode file: {file_path}"


def get_all_workbook_documents() -> List[Dict[str, Any]]:
    """Scan all workbooks and return document metadata with content (cached)"""
    global _document_cache, _cache_timestamp

    documents = []
    data_dir = Path(get_data_dir())
    workbooks_dir = data_dir / "workbooks"

    if not workbooks_dir.exists():
        return []

    # Check if cache is still valid (re-scan if workbooks dir changed)
    try:
        current_mtime = workbooks_dir.stat().st_mtime
        if _cache_timestamp is not None and current_mtime <= _cache_timestamp:
            # Cache is valid, but we still need to rebuild the documents list from cache
            pass
        else:
            # Invalidate cache if directory changed
            _document_cache.clear()
            _cache_timestamp = current_mtime
    except:
        _document_cache.clear()
        _cache_timestamp = None

    for workbook_dir in workbooks_dir.iterdir():
        if not workbook_dir.is_dir():
            continue

        metadata_path = workbook_dir / "workbook.json"
        if not metadata_path.exists():
            continue

        try:
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
        except:
            continue

        workbook_name = metadata.get('name', workbook_dir.name)

        for doc in metadata.get('documents', []):
            filename = doc.get('filename', '')
            relative_path = doc.get('path', f"documents/{filename}")
            file_path = workbook_dir / relative_path

            if not file_path.exists():
                continue

            # Check cache first
            content = ""
            cache_key = str(file_path)
            try:
                file_mtime = file_path.stat().st_mtime

                if cache_key in _document_cache:
                    cached_content, cached_mtime = _document_cache[cache_key]
                    if file_mtime <= cached_mtime:
                        # Cache hit - use cached content
                        content = cached_content
                    else:
                        # File changed - re-extract
                        _document_cache.pop(cache_key, None)
            except:
                file_mtime = 0

            # Extract text if not in cache
            if not content:
                content = read_file(file_path)

                # Cache the extracted content
                if content and not content.startswith("Error"):
                    try:
                        _document_cache[cache_key] = (content, file_mtime)
                    except:
                        pass

            if content and not content.startswith("Error"):
                documents.append({
                    'workbook_id': workbook_dir.name,
                    'workbook_name': workbook_name,
                    'filename': filename,
                    'path': str(relative_path),
                    'filepath': str(file_path),
                    'content': content,
                })

    return documents


def search_workbooks(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Search for files matching query - returns file metadata only (for backward compatibility)"""
    documents = get_all_workbook_documents()

    if not documents:
        return []

    query_lower = query.lower()
    matching_docs = []

    for doc in documents:
        # Calculate relevance score (simple text matching)
        score = 0
        content_lower = doc["content"].lower()

        # Exact phrase match in content (high score)
        if query_lower in content_lower:
            score += 20

        # Word matching - each word adds points
        query_words = query_lower.split()
        word_matches = sum(1 for word in query_words if len(word) > 2 and word in content_lower)
        score += word_matches * 3

        # Filename match (medium score)
        filename_matches = sum(1 for word in query_words if word in doc["filename"].lower())
        score += filename_matches * 5

        # Workbook name match (low score)
        workbook_matches = sum(1 for word in query_words if word in doc["workbook_name"].lower())
        score += workbook_matches * 2

        # Special boost for PDFs (they often have important docs)
        if doc["filename"].lower().endswith(".pdf") and score > 0:
            score += 2

        if score > 0:
            matching_docs.append((score, doc))

    # Sort by relevance score
    matching_docs.sort(key=lambda x: x[0], reverse=True)

    # Return top results (file metadata only for backward compatibility)
    results = []
    for score, doc in matching_docs[:limit]:
        results.append({
            'workbook_id': doc['workbook_id'],
            'workbook_name': doc['workbook_name'],
            'filename': doc['filename'],
            'path': doc['path'],
            'full_path': doc['filepath'],
            'match_type': 'content',
            'relevance_score': score
        })

    return results


def extract_context_chunks(content: str, key_terms: List[str], chunk_size: int = 1000, max_chunks: int = 5) -> List[tuple[int, str]]:
    """
    Extract context chunks around keyword matches in document content.
    Returns chunks of text surrounding where keywords are found.

    Args:
        content: Full document content
        key_terms: List of keywords to search for
        chunk_size: Size of chunk (chars before + after keyword)
        max_chunks: Maximum number of chunks to return

    Returns:
        List of (position, chunk_text) tuples
    """
    content_lower = content.lower()
    chunks = []
    positions_covered = set()

    # Find all keyword positions
    for term in key_terms:
        if not term or len(term) < 3:
            continue

        # Find all occurrences of this term
        pattern = r'\b' + re.escape(term) + r'\b'
        for match in re.finditer(pattern, content_lower):
            pos = match.start()

            # Skip if we already have a chunk covering this position
            if any(abs(pos - covered) < chunk_size // 2 for covered in positions_covered):
                continue

            # Extract chunk around this position
            start = max(0, pos - chunk_size // 2)
            end = min(len(content), pos + chunk_size // 2)

            # Try to break at word boundaries
            if start > 0:
                # Find previous space
                space_before = content.rfind(' ', start - 100, start)
                if space_before > 0:
                    start = space_before + 1

            if end < len(content):
                # Find next space
                space_after = content.find(' ', end, end + 100)
                if space_after > 0:
                    end = space_after

            chunk_text = content[start:end].strip()

            # Add ellipsis if not at document boundaries
            if start > 0:
                chunk_text = "..." + chunk_text
            if end < len(content):
                chunk_text = chunk_text + "..."

            chunks.append((pos, chunk_text))
            positions_covered.add(pos)

            if len(chunks) >= max_chunks:
                break

        if len(chunks) >= max_chunks:
            break

    # Sort chunks by position in document
    chunks.sort(key=lambda x: x[0])

    return chunks


def search_workbooks_with_content(query: str, limit: int = 5) -> str:
    """Search workbook documents using text matching and return FULL content.
    Returns only files that match the query (score >= 3) plus up to 2 relevant sibling files per workbook.
    Limits to 5 files per workbook to avoid overwhelming results.
    """
    documents = get_all_workbook_documents()

    if not documents:
        return "No workbook documents found."

    # Extract key terms from query (remove common words and punctuation)
    query_lower = query.lower()
    # Remove punctuation from query
    query_clean = re.sub(r'[^\w\s]', ' ', query_lower)
    common_words = {'who', 'are', 'the', 'in', 'a', 'an', 'and', 'or', 'but', 'is', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'what', 'when', 'where', 'why', 'how'}
    query_words = [w for w in query_clean.split() if w not in common_words and len(w) > 2]

    # If we have key terms, require at least one key term match for a file to be included
    # Also include word stems for better matching (e.g., "cabins" -> "cabin")
    key_terms = query_words if query_words else [query_lower]
    # Add stemmed versions (simple: remove trailing 's')
    stemmed_terms = []
    for term in key_terms:
        stemmed_terms.append(term)
        if term.endswith('s') and len(term) > 3:
            stemmed_terms.append(term[:-1])  # "cabins" -> "cabin"
    key_terms = list(set(stemmed_terms))  # Remove duplicates

    matching_docs = []

    for doc in documents:
        # Calculate relevance score
        score = 0
        content_lower = doc["content"].lower()
        filename_lower = doc["filename"].lower()

        # Check if document contains at least one key term (required for inclusion)
        has_key_term = False
        for term in key_terms:
            if term in content_lower or term in filename_lower:
                has_key_term = True
                break

        # Skip documents that don't contain any key terms
        if not has_key_term:
            continue

        # Exact phrase match in content (high score)
        if query_lower in content_lower:
            score += 20
        elif any(term in content_lower for term in key_terms):
            # Key term match (but not exact phrase)
            score += 15

        # Word matching - use key terms with word boundaries
        if key_terms:
            word_matches = sum(1 for word in key_terms if re.search(r'\b' + re.escape(word) + r'\b', content_lower))
            score += word_matches * 5  # Higher weight for key terms

        # Filename match (very important - boost significantly)
        filename_matches = sum(1 for term in key_terms if term in filename_lower)
        score += filename_matches * 10  # Strong filename match boost

        # Workbook name match
        workbook_matches = sum(1 for term in key_terms if term in doc["workbook_name"].lower())
        score += workbook_matches * 3

        # Special boost for PDFs
        if doc["filename"].lower().endswith(".pdf") and score > 0:
            score += 2

        # Only include files with meaningful matches (score >= 8 for stricter filtering)
        # This ensures we only get files that really match the query
        if score >= 8:
            matching_docs.append((score, doc))

    # Sort by relevance score
    matching_docs.sort(key=lambda x: x[0], reverse=True)

    if not matching_docs:
        available = "\n".join([f"- {d['filename']} ({d['workbook_name']})" for d in documents[:20]])
        return f"No matches found for '{query}'.\n\nAvailable documents:\n{available}"

    # Only return files with scores close to the top score
    # This prevents returning all NDAs when only one matches
    top_score = matching_docs[0][0]
    score_threshold = top_score * 0.9  # Must be within 90% of top score (stricter)

    filtered_docs = [(score, doc) for score, doc in matching_docs if score >= score_threshold]

    # If no files pass 90% threshold, return only the top file
    if len(filtered_docs) == 0:
        filtered_docs = [matching_docs[0]]

    # Limit total results
    MAX_TOTAL_FILES = 2  # Return at most 2 files total
    filtered_docs = filtered_docs[:MAX_TOTAL_FILES]

    # Format results with context-aware chunks
    results = []
    for score, doc in filtered_docs:
        # Extract context chunks around keywords instead of returning full content
        chunks = extract_context_chunks(doc["content"], key_terms, chunk_size=1000, max_chunks=5)

        if len(chunks) == 0:
            # No specific keyword positions found, return beginning of file
            max_chars = 2000
            content_preview = doc["content"][:max_chars]
            if len(doc["content"]) > max_chars:
                content_preview += f"\n\n[Preview only - document is {len(doc['content'])} characters total. Use read_workbook_file to get the complete document.]"

            results.append(f"""**{doc['filename']}** ({doc['workbook_name']})
Workbook ID: {doc['workbook_id']}
Path: {doc['path']}
Relevance Score: {score}
Total Length: {len(doc['content'])} characters

=== PREVIEW (first 2,000 chars) ===
{content_preview}

---
""")
        else:
            # Return context chunks around keyword matches
            chunks_text = "\n\n".join([f"[Excerpt {i+1} - Position {pos:,}]\n{chunk}"
                                        for i, (pos, chunk) in enumerate(chunks)])

            total_chunk_chars = sum(len(chunk) for _, chunk in chunks)

            results.append(f"""**{doc['filename']}** ({doc['workbook_name']})
Workbook ID: {doc['workbook_id']}
Path: {doc['path']}
Relevance Score: {score}
Total Length: {len(doc['content'])} characters
Chunks: {len(chunks)} excerpts ({total_chunk_chars} characters total)

=== CONTEXT EXCERPTS (around keywords: {', '.join(key_terms[:5])}) ===
{chunks_text}

[NOTE: This shows only relevant excerpts. To read the complete document, use read_workbook_file with the workbook ID and path above.]

---
""")

    return "\n".join(results)


def read_workbook_file(workbook_id: str, file_path: str) -> str:
    """Read a specific file from a workbook"""
    data_dir = Path(get_data_dir())
    full_path = data_dir / "workbooks" / workbook_id / file_path

    if not full_path.exists():
        return f"File not found: {file_path}"

    return read_file(full_path)


def list_all_files() -> List[Dict[str, Any]]:
    """List all files in all workbooks"""
    files = []
    data_dir = Path(get_data_dir())
    workbooks_dir = data_dir / "workbooks"

    if not workbooks_dir.exists():
        return []

    for workbook_dir in workbooks_dir.iterdir():
        if not workbook_dir.is_dir():
            continue

        metadata_path = workbook_dir / "workbook.json"
        if not metadata_path.exists():
            continue

        try:
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
        except:
            continue

        workbook_name = metadata.get('name', workbook_dir.name)

        for doc in metadata.get('documents', []):
            files.append({
                'workbook_id': workbook_dir.name,
                'workbook_name': workbook_name,
                'filename': doc.get('filename', ''),
                'path': doc.get('path', ''),
                'added_at': doc.get('addedAt', '')
            })

    return files


def handle_request(request: dict) -> dict:
    """Handle MCP requests"""
    method = request.get('method', '')
    params = request.get('params', {})

    try:
        if method == 'rag/search':
            # Backward compatible: returns file metadata only
            query = params.get('query', '')
            limit = params.get('limit', 20)
            results = search_workbooks(query, limit)
            return {'result': results}

        elif method == 'rag/search_content':
            # New: returns full content of matching files
            query = params.get('query', '')
            limit = params.get('limit', 5)
            results = search_workbooks_with_content(query, limit)
            return {'result': {'content': results}}

        elif method == 'rag/read_file':
            workbook_id = params.get('workbook_id', '')
            file_path = params.get('file_path', '')
            content = read_workbook_file(workbook_id, file_path)
            return {'result': {'content': content}}

        elif method == 'rag/list_files':
            files = list_all_files()
            return {'result': files}

        elif method == 'rag/health':
            return {'result': {'status': 'healthy', 'mode': 'on-demand-with-content-search'}}

        else:
            return {'error': f'Unknown method: {method}'}

    except Exception as e:
        return {'error': str(e)}


if __name__ == '__main__':
    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            response = handle_request(request)
            print(json.dumps(response))
            sys.stdout.flush()
        except Exception as e:
            error_response = {'error': str(e)}
            print(json.dumps(error_response))
            sys.stdout.flush()
