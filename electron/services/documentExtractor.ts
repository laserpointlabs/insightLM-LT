import * as fs from "fs";
import * as path from "path";

/**
 * Document Extractor Service
 * Extracts text from various document formats (PDF, Word, etc.)
 * Falls back to UTF-8 text reading for text-based formats
 */
export class DocumentExtractor {
  /**
   * Extract text from a file based on its extension
   * @param filePath Full path to the file
   * @returns Extracted text content
   */
  static async extractText(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();

    try {
      switch (ext) {
        case ".pdf":
          return await this.extractFromPDF(filePath);
        case ".docx":
          return await this.extractFromDOCX(filePath);
        case ".doc":
          // Legacy Word format - try DOCX extraction first, fallback to error
          try {
            return await this.extractFromDOCX(filePath);
          } catch (error) {
            throw new Error("Legacy .doc format not fully supported. Please convert to .docx");
          }
        case ".is":
          // Insight Sheet files are JSON - for display, return raw JSON (not extracted text)
          // The extracted text format is only for RAG indexing, not for editing/display
          return fs.readFileSync(filePath, "utf-8");
        default:
          // For text files (markdown, txt, etc.), read as UTF-8
          return this.readTextFile(filePath);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to extract text from ${path.basename(filePath)}: ${errorMsg}`);
    }
  }

  /**
   * Extract text from PDF file
   */
  private static async extractFromPDF(filePath: string): Promise<string> {
    try {
      // pdf-parse v1.x works directly in Node.js without browser APIs
      const pdfParse = require("pdf-parse");
      const dataBuffer = fs.readFileSync(filePath);

      // pdf-parse v1.x exports a function directly
      const data = await pdfParse(dataBuffer);
      return data.text || "";
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract text from DOCX file
   */
  private static async extractFromDOCX(filePath: string): Promise<string> {
    try {
      // Check if file exists first
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${path.basename(filePath)}`);
      }

      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });

      // Extract text from paragraphs
      let text = result.value;

      // Also try to extract table content if available
      // Mammoth can extract tables, but extractRawText gives us the text
      // For better table extraction, we could use extractTextWithMarkup
      // but for MVP, raw text is sufficient

      return text || "";
    } catch (error) {
      if (error instanceof Error && error.message.includes("Cannot find module")) {
        throw new Error("DOCX extraction requires 'mammoth' package. Please install it.");
      }
      throw new Error(`DOCX extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract text from Insight Sheet (.is) file
   * Uses the same logic as the Python RAG server for consistency
   */
  private static extractFromInsightSheet(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      
      const textParts: string[] = [];
      textParts.push(`Spreadsheet: ${path.basename(filePath)}`);
      
      if (data.metadata) {
        if (data.metadata.name) {
          textParts.push(`Name: ${data.metadata.name}`);
        }
        if (data.metadata.workbook_id) {
          textParts.push(`Workbook ID: ${data.metadata.workbook_id}`);
        }
      }
      
      textParts.push(""); // Empty line
      
      // Process each sheet
      const sheets = data.sheets || [];
      for (const sheet of sheets) {
        const sheetName = sheet.name || "Sheet1";
        const cells = sheet.cells || {};
        
        textParts.push(`=== Sheet: ${sheetName} ===`);
        
        if (Object.keys(cells).length === 0) {
          textParts.push("(Empty sheet)");
          textParts.push("");
          continue;
        }
        
        // Extract all cell data with formulas visible
        const cellData: string[] = [];
        for (const [cellRef, cellInfo] of Object.entries(cells)) {
          if (typeof cellInfo === "object" && cellInfo !== null) {
            const cell = cellInfo as any;
            let value: any = null;
            let formula: string | null = null;
            
            // Handle nested value structure from Luckysheet format
            if (cell.value && typeof cell.value === "object" && cell.value !== null) {
              const valueObj = cell.value;
              value = valueObj.v !== undefined ? valueObj.v : (valueObj.m !== undefined ? valueObj.m : null);
              formula = valueObj.f || null;
            } else {
              value = cell.value;
              formula = cell.formula || null;
            }
            
            if (formula) {
              cellData.push(`Cell ${cellRef}: ${formula} (formula, calculated value: ${value})`);
            } else {
              cellData.push(`Cell ${cellRef}: ${value}`);
            }
          } else {
            cellData.push(`Cell ${cellRef}: ${cellInfo}`);
          }
        }
        
        // Sort cells by reference (A1, A2, B1, etc.)
        cellData.sort((a, b) => {
          const matchA = a.match(/Cell ([A-Z]+)(\d+)/);
          const matchB = b.match(/Cell ([A-Z]+)(\d+)/);
          if (!matchA || !matchB) return 0;
          
          const colA = matchA[1];
          const rowA = parseInt(matchA[2]);
          const colB = matchB[1];
          const rowB = parseInt(matchB[2]);
          
          // Convert column to number (A=1, B=2, etc.)
          const colNumA = colA.split("").reduce((acc, c) => acc * 26 + (c.charCodeAt(0) - 64), 0);
          const colNumB = colB.split("").reduce((acc, c) => acc * 26 + (c.charCodeAt(0) - 64), 0);
          
          if (rowA !== rowB) return rowA - rowB;
          return colNumA - colNumB;
        });
        
        textParts.push(...cellData);
        textParts.push(""); // Empty line between sheets
      }
      
      // Add formula dependencies summary
      const formulaCells: string[] = [];
      for (const sheet of sheets) {
        const cells = sheet.cells || {};
        for (const [cellRef, cellInfo] of Object.entries(cells)) {
          if (typeof cellInfo === "object" && cellInfo !== null) {
            const cell = cellInfo as any;
            let formula: string | null = null;
            
            if (cell.value && typeof cell.value === "object" && cell.value !== null) {
              formula = cell.value.f || "";
            } else {
              formula = cell.formula || "";
            }
            
            if (formula) {
              // Extract cell references from formula
              const cellRefPattern = /\b([A-Z]+)(\d+)\b/g;
              const dependencies: string[] = [];
              let match;
              while ((match = cellRefPattern.exec(formula)) !== null) {
                dependencies.push(match[0]);
              }
              
              if (dependencies.length > 0) {
                formulaCells.push(`${cellRef}: ${formula} (depends on: ${dependencies.join(", ")})`);
              }
            }
          }
        }
      }
      
      if (formulaCells.length > 0) {
        textParts.push("=== Formulas ===");
        textParts.push(...formulaCells);
      }
      
      return textParts.join("\n");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to extract text from Insight Sheet: ${errorMsg}`);
    }
  }

  /**
   * Read text file with encoding detection
   */
  private static readTextFile(filePath: string): string {
    // Read as buffer first to detect BOM
    const buffer = fs.readFileSync(filePath);

    // Check for UTF-8 BOM
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return buffer.toString("utf-8", 3);
    }

    // Try UTF-8 first (most common)
    try {
      return buffer.toString("utf-8");
    } catch (error) {
      // Try latin1 as fallback (handles most other cases)
      try {
        return buffer.toString("latin1");
      } catch (error2) {
        throw new Error(`Could not decode file: ${path.basename(filePath)}`);
      }
    }
  }

  /**
   * Check if a file type requires extraction (not plain text)
   */
  static requiresExtraction(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return [".pdf", ".docx", ".doc"].includes(ext);
  }
}
