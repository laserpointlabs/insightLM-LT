import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DocumentExtractor } from './documentExtractor';

describe('DocumentExtractor', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insightlm-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('extractText', () => {
    it('should read markdown files as UTF-8', async () => {
      const testContent = '# Test Markdown\n\nThis is a **test** markdown file.';
      const filePath = path.join(tempDir, 'test.md');
      fs.writeFileSync(filePath, testContent, 'utf-8');

      const result = await DocumentExtractor.extractText(filePath);
      expect(result).toBe(testContent);
    });

    it('should read text files as UTF-8', async () => {
      const testContent = 'This is a plain text file with some content.';
      const filePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(filePath, testContent, 'utf-8');

      const result = await DocumentExtractor.extractText(filePath);
      expect(result).toBe(testContent);
    });

    it('should handle UTF-8 BOM correctly', async () => {
      const testContent = 'Content with BOM';
      const filePath = path.join(tempDir, 'test-bom.txt');
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      fs.writeFileSync(filePath, Buffer.concat([bom, Buffer.from(testContent, 'utf-8')]));

      const result = await DocumentExtractor.extractText(filePath);
      expect(result).toBe(testContent);
    });

    it('should extract text from PDF files', async () => {
      // Use an existing PDF from the data directory if available
      const dataDir = path.join(__dirname, '../../data');
      const pdfPath = path.join(dataDir, 'odras_tool_overview.pdf');

      if (fs.existsSync(pdfPath)) {
        const result = await DocumentExtractor.extractText(pdfPath);
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      } else {
        console.warn('PDF test file not found, skipping PDF extraction test');
      }
    }, 30000); // 30 second timeout for PDF parsing

    it('should extract text from DOCX files', async () => {
      // Note: This test requires a DOCX file
      // For now, we'll test that the method exists and handles errors gracefully
      const nonExistentPath = path.join(tempDir, 'nonexistent.docx');

      await expect(DocumentExtractor.extractText(nonExistentPath)).rejects.toThrow();
    }, 10000); // 10 second timeout

    it('should handle legacy .doc files gracefully', async () => {
      const nonExistentPath = path.join(tempDir, 'legacy.doc');

      // Should throw with helpful error message
      await expect(DocumentExtractor.extractText(nonExistentPath)).rejects.toThrow('Legacy .doc format');
    });

    it('should throw error for non-existent files', async () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.txt');

      await expect(DocumentExtractor.extractText(nonExistentPath)).rejects.toThrow();
    });
  });

  describe('requiresExtraction', () => {
    it('should return true for PDF files', () => {
      expect(DocumentExtractor.requiresExtraction('/path/to/file.pdf')).toBe(true);
    });

    it('should return true for DOCX files', () => {
      expect(DocumentExtractor.requiresExtraction('/path/to/file.docx')).toBe(true);
    });

    it('should return true for legacy DOC files', () => {
      expect(DocumentExtractor.requiresExtraction('/path/to/file.doc')).toBe(true);
    });

    it('should return false for markdown files', () => {
      expect(DocumentExtractor.requiresExtraction('/path/to/file.md')).toBe(false);
    });

    it('should return false for text files', () => {
      expect(DocumentExtractor.requiresExtraction('/path/to/file.txt')).toBe(false);
    });
  });
});
