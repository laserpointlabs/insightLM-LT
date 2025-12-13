import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMService } from './llmService';
import { WorkbookService } from './workbookService';
import { FileService } from './fileService';

vi.mock('./workbookService');
vi.mock('./fileService');

describe('LLMService - Source Tracking', () => {
  let llmService: LLMService;
  let mockWorkbookService: any;
  let mockFileService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWorkbookService = {
      getWorkbook: vi.fn().mockResolvedValue({
        id: 'wb-1',
        name: 'NDAs',
      }),
      getWorkbooks: vi.fn().mockResolvedValue([]),
    };

    mockFileService = {
      readDocument: vi.fn().mockResolvedValue('Mock file content'),
    };

    const mockConfig = {
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'test-key',
    };

    llmService = new LLMService(
      mockConfig as any,
      mockWorkbookService,
      mockFileService,
    );
  });

  it('should track files when read_workbook_file is called', async () => {
    const executeTool = (llmService as any).executeTool.bind(llmService);

    await executeTool('read_workbook_file', {
      workbookId: 'wb-1',
      filePath: 'documents/test.pdf',
    });

    const filesRead = (llmService as any).filesReadInCurrentChat;
    expect(filesRead.length).toBe(1);
    expect(filesRead[0]).toEqual({
      workbookId: 'wb-1',
      workbookName: 'NDAs',
      filePath: 'documents/test.pdf',
      filename: 'test.pdf',
    });
  });

  it('should track files from RAG response', () => {
    const ragResponse = `**Vallen Distribution, Inc._Signed NDA_Expires July 2028.pdf** (NDAs)
Workbook ID: 9a050ab2-1ae8-45bb-96d1-34d62d4efd95
Path: documents/Vallen Distribution, Inc._Signed NDA_Expires July 2028.pdf
Relevance Score: 37

=== FULL CONTENT ===
Content here...
---`;

    const trackMethod = (llmService as any).trackFilesFromRAGResponse.bind(llmService);
    trackMethod(ragResponse);

    const filesRead = (llmService as any).filesReadInCurrentChat;
    expect(filesRead.length).toBe(1);
    expect(filesRead[0].filename).toContain('Vallen');
    expect(filesRead[0].workbookId).toBe('9a050ab2-1ae8-45bb-96d1-34d62d4efd95');
  });

  it('should track multiple files from RAG response', () => {
    const ragResponse = `**file1.pdf** (Workbook1)
Workbook ID: wb-1
Path: documents/file1.pdf
Relevance Score: 25

=== FULL CONTENT ===
Content...
---

**file2.pdf** (Workbook2)
Workbook ID: wb-2
Path: documents/file2.pdf
Relevance Score: 20

=== FULL CONTENT ===
Content...
---`;

    const trackMethod = (llmService as any).trackFilesFromRAGResponse.bind(llmService);
    trackMethod(ragResponse);

    const filesRead = (llmService as any).filesReadInCurrentChat;
    expect(filesRead.length).toBe(2);
    expect(filesRead[0].filename).toBe('file1.pdf');
    expect(filesRead[1].filename).toBe('file2.pdf');
  });

  it('should avoid duplicate files', () => {
    const ragResponse = `**test.pdf** (Test)
Workbook ID: wb-1
Path: documents/test.pdf
Relevance Score: 25

=== FULL CONTENT ===
Content...
---

**test.pdf** (Test)
Workbook ID: wb-1
Path: documents/test.pdf
Relevance Score: 25

=== FULL CONTENT ===
Content...
---`;

    const trackMethod = (llmService as any).trackFilesFromRAGResponse.bind(llmService);
    trackMethod(ragResponse);

    const filesRead = (llmService as any).filesReadInCurrentChat;
    expect(filesRead.length).toBe(1); // Should only track once
  });

  it('should handle RAG response with no files', () => {
    const ragResponse = `No matches found for 'xyz'.`;

    const trackMethod = (llmService as any).trackFilesFromRAGResponse.bind(llmService);
    trackMethod(ragResponse);

    const filesRead = (llmService as any).filesReadInCurrentChat;
    expect(filesRead.length).toBe(0);
  });
});



