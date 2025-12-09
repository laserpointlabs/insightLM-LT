import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileService } from './fileService';
import { WorkbookService } from './workbookService';

describe('FileService - readDocument', () => {
  let tempDir: string;
  let workbookService: WorkbookService;
  let fileService: FileService;
  let workbookId: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insightlm-test-'));

    // Initialize workbook service with temp directory
    workbookService = new WorkbookService();
    (workbookService as any).workbooksDir = path.join(tempDir, 'workbooks');
    workbookService.initialize((workbookService as any).workbooksDir);

    fileService = new FileService(workbookService);

    // Create a test workbook
    const workbook = workbookService.createWorkbook('Test Workbook');
    workbookId = workbook.id;
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should read markdown files correctly', async () => {
    const testContent = '# Test Document\n\nThis is a **test** markdown file.';
    const fileName = 'test.md';
    const filePath = path.join((workbookService as any).workbooksDir, workbookId, 'documents', fileName);

    // Ensure directory exists
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, testContent, 'utf-8');

    const result = await fileService.readDocument(workbookId, `documents/${fileName}`);
    expect(result).toBe(testContent);
  });

  it('should read text files correctly', async () => {
    const testContent = 'Plain text content here.';
    const fileName = 'test.txt';
    const filePath = path.join((workbookService as any).workbooksDir, workbookId, 'documents', fileName);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, testContent, 'utf-8');

    const result = await fileService.readDocument(workbookId, `documents/${fileName}`);
    expect(result).toBe(testContent);
  });

  it('should extract text from PDF files', async () => {
    // Copy a test PDF from data directory if available
    const dataDir = path.join(__dirname, '../../data');
    const sourcePdf = path.join(dataDir, 'odras_tool_overview.pdf');

    if (fs.existsSync(sourcePdf)) {
      const fileName = 'test.pdf';
      const filePath = path.join((workbookService as any).workbooksDir, workbookId, 'documents', fileName);

      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.copyFileSync(sourcePdf, filePath);

      const result = await fileService.readDocument(workbookId, `documents/${fileName}`);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // PDF should have extracted text
      expect(result).not.toContain('Error');
    } else {
      console.warn('PDF test file not found, skipping PDF reading test');
    }
  }, 30000);

  it('should throw error for non-existent files', async () => {
    await expect(
      fileService.readDocument(workbookId, 'documents/nonexistent.md')
    ).rejects.toThrow('File not found');
  });

  it('should throw error for non-existent workbook', async () => {
    await expect(
      fileService.readDocument('nonexistent-workbook-id', 'documents/test.md')
    ).rejects.toThrow('File not found');
  });

  it('should handle files with special characters in content', async () => {
    const testContent = 'Content with special chars: émojis 🎉, unicode 中文, and symbols ©®™';
    const fileName = 'special.md';
    const filePath = path.join((workbookService as any).workbooksDir, workbookId, 'documents', fileName);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, testContent, 'utf-8');

    const result = await fileService.readDocument(workbookId, `documents/${fileName}`);
    expect(result).toBe(testContent);
  });
});
