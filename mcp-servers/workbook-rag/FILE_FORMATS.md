# Supported File Formats

This document lists all file formats supported by the RAG indexing system.

## Text Files (Direct Reading)

These files are read directly as text with encoding detection:

### Code Files
- `.py` - Python
- `.js`, `.jsx` - JavaScript
- `.ts`, `.tsx` - TypeScript
- `.java` - Java
- `.cpp`, `.c`, `.h`, `.hpp` - C/C++
- `.cs` - C#
- `.go` - Go
- `.rs` - Rust
- `.rb` - Ruby
- `.php` - PHP
- `.swift` - Swift
- `.kt` - Kotlin
- `.scala` - Scala
- `.pl` - Perl
- `.lua` - Lua
- `.vim` - Vim script

### Markup & Data
- `.md`, `.markdown` - Markdown
- `.html`, `.htm` - HTML
- `.xml` - XML
- `.json` - JSON
- `.yaml`, `.yml` - YAML
- `.csv` - CSV (comma-separated values)
- `.tsv` - TSV (tab-separated values)
- `.txt` - Plain text

### Configuration
- `.conf`, `.config` - Configuration files
- `.ini` - INI files
- `.toml` - TOML
- `.env` - Environment files
- `.sh`, `.bash`, `.zsh` - Shell scripts
- `.ps1` - PowerShell scripts

### Other
- `.log` - Log files
- `.sql` - SQL
- `.r`, `.m` - R/MATLAB
- `.css`, `.scss`, `.less` - Stylesheets

## Binary Formats (Text Extraction)

These formats require special libraries to extract text:

### PDF Documents
- **Format**: `.pdf`
- **Library**: `pypdf`
- **Extraction**: Extracts text from all pages
- **Notes**: Handles multi-page documents, preserves basic formatting

### Microsoft Word
- **Formats**: `.docx`, `.doc`
- **Library**: `python-docx`
- **Extraction**:
  - Extracts all paragraph text
  - Extracts table content
  - Preserves document structure
- **Notes**: `.doc` (legacy format) support may be limited

### Microsoft Excel
- **Formats**: `.xlsx`, `.xls`
- **Library**: `pandas` + `openpyxl`
- **Extraction**:
  - Extracts all sheets
  - Converts cells to text representation
  - Preserves sheet names
- **Notes**: Formulas are not evaluated, only displayed values

### Microsoft PowerPoint
- **Formats**: `.pptx`, `.ppt`
- **Library**: `python-pptx`
- **Extraction**:
  - Extracts text from all slides
  - Preserves slide order
  - Includes text from shapes and text boxes
- **Notes**: Images and embedded objects are not extracted

## File Size Limits

- **Text Files**: No hard limit, but very large files (>100MB) may take longer to process
- **PDFs**: Handles multi-page PDFs efficiently
- **Excel**: All sheets are processed, large spreadsheets may take time
- **Chunking**: Files are automatically chunked at 8000 tokens (~32KB) with 200 token overlap

## Encoding Support

Text files are read with automatic encoding detection:
1. UTF-8 (with/without BOM)
2. Latin-1
3. Windows-1252 (CP1252)

## Future Formats

Planned support for:
- OpenDocument formats (`.odt`, `.ods`, `.odp`)
- RTF (`.rtf`)
- EPUB (`.epub`)
- Markdown with embedded images
- Other formats as requested

## Error Handling

If a file cannot be processed:
- The error is logged
- The file is skipped
- Indexing continues with other files
- No partial data is stored

## Performance Notes

- **PDFs**: Text extraction is fast, but very large PDFs (>1000 pages) may take time
- **Excel**: Large spreadsheets with many sheets may take longer
- **Word**: Complex documents with many tables may take longer
- **PowerPoint**: Presentations with many slides are processed efficiently

## Testing

To test file format support:
1. Add files of various formats to a workbook
2. Run the indexing script
3. Check the output for any errors
4. Search for content from each file type to verify indexing

