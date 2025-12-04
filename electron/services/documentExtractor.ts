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
