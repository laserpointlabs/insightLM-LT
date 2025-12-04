#!/usr/bin/env python3
"""
Workbook RAG Server - On-Demand Reading (Continue.dev approach)
No pre-indexing. Reads files directly when needed.
"""
import os
import sys
import json
from pathlib import Path
from typing import List, Dict, Any

# Get data directory from environment
DATA_DIR = os.environ.get("INSIGHTLM_DATA_DIR", "")

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


def read_file(file_path: Path) -> str:
    """Read any file type"""
    ext = file_path.suffix.lower()

    if ext == '.pdf':
        return extract_text_from_pdf(file_path)
    elif ext in ['.docx', '.doc']:
        return extract_text_from_docx(file_path)
    else:
        # Text file
        encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252']
        for encoding in encodings:
            try:
                return file_path.read_text(encoding=encoding)
            except UnicodeDecodeError:
                continue
        return f"Could not decode file: {file_path}"


def search_workbooks(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Search for files matching query"""
    results = []
    data_dir = Path(get_data_dir())
    workbooks_dir = data_dir / "workbooks"

    if not workbooks_dir.exists():
        return []

    query_lower = query.lower()

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

            # Match by filename or content search
            if query_lower in filename.lower():
                file_path = workbook_dir / relative_path
                results.append({
                    'workbook_id': workbook_dir.name,
                    'workbook_name': workbook_name,
                    'filename': filename,
                    'path': str(relative_path),
                    'full_path': str(file_path),
                    'match_type': 'filename'
                })

                if len(results) >= limit:
                    return results

    return results


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
            query = params.get('query', '')
            limit = params.get('limit', 20)
            results = search_workbooks(query, limit)
            return {'result': results}

        elif method == 'rag/read_file':
            workbook_id = params.get('workbook_id', '')
            file_path = params.get('file_path', '')
            content = read_workbook_file(workbook_id, file_path)
            return {'result': {'content': content}}

        elif method == 'rag/list_files':
            files = list_all_files()
            return {'result': files}

        elif method == 'rag/health':
            return {'result': {'status': 'healthy', 'mode': 'on-demand'}}

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
