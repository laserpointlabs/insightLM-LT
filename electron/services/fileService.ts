import * as fs from "fs";
import * as path from "path";
import { WorkbookService } from "./workbookService";
import { DocumentExtractor } from "./documentExtractor";

export class FileService {
  private workbookService: WorkbookService;

  constructor(workbookService: WorkbookService) {
    this.workbookService = workbookService;
  }

  addDocument(workbookId: string, sourcePath: string, filename?: string): Promise<void> {
    const workbook = this.workbookService.getWorkbook(workbookId);
    if (!workbook) {
      throw new Error(`Workbook not found: ${workbookId}`);
    }

    const workbookPath = path.join(
      this.workbookService["workbooksDir"],
      workbookId,
    );
    const documentsPath = path.join(workbookPath, "documents");
    this.ensureDirectoryExists(documentsPath);

    const finalFilename = filename || path.basename(sourcePath);
    const destPath = path.join(documentsPath, finalFilename);

    fs.copyFileSync(sourcePath, destPath);

    const metadataPath = path.join(workbookPath, "workbook.json");
    const content = fs.readFileSync(metadataPath, "utf-8");
    const metadata = JSON.parse(content);

    const existingIndex = metadata.documents.findIndex(
      (doc: any) => doc.filename === finalFilename,
    );

    if (existingIndex >= 0) {
      metadata.documents[existingIndex].addedAt = new Date().toISOString();
    } else {
      metadata.documents.push({
        filename: finalFilename,
        path: `documents/${finalFilename}`,
        addedAt: new Date().toISOString(),
      });
    }

    metadata.updated = new Date().toISOString();
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    return Promise.resolve();
  }

  async readDocument(workbookId: string, relativePath: string): Promise<string> {
    const workbookPath = path.join(
      this.workbookService["workbooksDir"],
      workbookId,
    );
    const filePath = path.join(workbookPath, relativePath);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${relativePath}`);
    }

    // Use DocumentExtractor to handle PDF, Word, and text files
    return await DocumentExtractor.extractText(filePath);
  }

  getFilePath(workbookId: string, relativePath: string): string {
    const workbookPath = path.join(
      this.workbookService["workbooksDir"],
      workbookId,
    );
    const filePath = path.join(workbookPath, relativePath);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${relativePath}`);
    }

    return filePath;
  }

  readBinary(workbookId: string, relativePath: string): Buffer {
    const workbookPath = path.join(
      this.workbookService["workbooksDir"],
      workbookId,
    );
    const filePath = path.join(workbookPath, relativePath);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${relativePath}`);
    }

    return fs.readFileSync(filePath);
  }

  writeDocument(
    workbookId: string,
    relativePath: string,
    content: string,
  ): Promise<void> {
    const workbookPath = path.join(
      this.workbookService["workbooksDir"],
      workbookId,
    );
    const filePath = path.join(workbookPath, relativePath);

    // Ensure the directory exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, content, "utf-8");

    // Update workbook metadata
    this.updateWorkbookMetadata(workbookId, (metadata) => {
      metadata.updated = new Date().toISOString();

      // Add the document to the workbook metadata if it's not already there
      const existingIndex = metadata.documents.findIndex(
        (doc: any) => doc.filename === path.basename(relativePath),
      );

      if (existingIndex < 0) {
        metadata.documents.push({
          filename: path.basename(relativePath),
          path: relativePath,
          addedAt: new Date().toISOString(),
        });
      }

      return metadata;
    });

    return Promise.resolve();
  }

  renameDocument(
    workbookId: string,
    oldRelativePath: string,
    newName: string,
  ): Promise<void> {
    const workbookPath = path.join(
      this.workbookService["workbooksDir"],
      workbookId,
    );
    const oldPath = path.join(workbookPath, oldRelativePath);
    const parentDir = path.dirname(oldPath);
    const newPath = path.join(parentDir, newName);

    if (!fs.existsSync(oldPath)) {
      throw new Error(`File not found: ${oldRelativePath}`);
    }

    if (fs.existsSync(newPath)) {
      throw new Error(`File already exists: ${newName}`);
    }

    fs.renameSync(oldPath, newPath);

    this.updateWorkbookMetadata(workbookId, (metadata) => {
      const doc = metadata.documents.find(
        (d: any) => d.path === oldRelativePath,
      );
      if (doc) {
        doc.filename = newName;
        doc.path = path
          .join(path.dirname(oldRelativePath), newName)
          .replace(/\\/g, "/");
      }
      return metadata;
    });

    return Promise.resolve();
  }

  deleteDocument(workbookId: string, relativePath: string): Promise<void> {
    const workbookPath = path.join(
      this.workbookService["workbooksDir"],
      workbookId,
    );
    const filePath = path.join(workbookPath, relativePath);

    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }

    this.updateWorkbookMetadata(workbookId, (metadata) => {
      const filename = path.basename(relativePath);
      metadata.documents = metadata.documents.filter(
        (d: any) => d.filename !== filename && d.path !== relativePath,
      );
      return metadata;
    });

    return Promise.resolve();
  }

  moveDocument(
    sourceWorkbookId: string,
    relativePath: string,
    targetWorkbookId: string,
  ): void {
    const sourcePath = path.join(
      this.workbookService["workbooksDir"],
      sourceWorkbookId,
      relativePath,
    );
    const filename = path.basename(relativePath);
    const targetPath = path.join(
      this.workbookService["workbooksDir"],
      targetWorkbookId,
      "documents",
      filename,
    );

    const targetDocsDir = path.join(
      this.workbookService["workbooksDir"],
      targetWorkbookId,
      "documents",
    );
    this.ensureDirectoryExists(targetDocsDir);

    fs.renameSync(sourcePath, targetPath);

    this.updateWorkbookMetadata(sourceWorkbookId, (metadata) => {
      metadata.documents = metadata.documents.filter(
        (d: any) => d.path !== relativePath,
      );
      return metadata;
    });

    this.updateWorkbookMetadata(targetWorkbookId, (metadata) => {
      metadata.documents.push({
        filename,
        path: `documents/${filename}`,
        addedAt: new Date().toISOString(),
      });
      return metadata;
    });
  }

  private ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private updateWorkbookMetadata(
    workbookId: string,
    updater: (metadata: any) => any,
  ): void {
    const workbookPath = path.join(
      this.workbookService["workbooksDir"],
      workbookId,
    );
    const metadataPath = path.join(workbookPath, "workbook.json");
    const content = fs.readFileSync(metadataPath, "utf-8");
    const metadata = updater(JSON.parse(content));
    metadata.updated = new Date().toISOString();
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }
}
