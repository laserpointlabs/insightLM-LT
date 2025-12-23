import * as fs from "fs";
import * as path from "path";
import { WorkbookService } from "./workbookService";

export class ArchiveService {
  private archiveDir: string = "";
  private workbookService: WorkbookService;

  constructor(workbookService: WorkbookService) {
    this.workbookService = workbookService;
  }

  initialize(dataDir: string) {
    this.archiveDir = path.join(dataDir, "archive");
    this.ensureDirectoryExists(this.archiveDir);
  }

  private ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  archiveWorkbook(workbookId: string): void {
    const workbook = this.workbookService.getWorkbook(workbookId);
    if (!workbook) {
      throw new Error(`Workbook not found: ${workbookId}`);
    }

    const sourcePath = path.join(
      this.workbookService["workbooksDir"],
      workbookId,
    );
    const targetPath = path.join(this.archiveDir, workbookId);

    if (fs.existsSync(sourcePath)) {
      fs.renameSync(sourcePath, targetPath);
    }

    const metadataPath = path.join(targetPath, "workbook.json");
    if (fs.existsSync(metadataPath)) {
      const content = fs.readFileSync(metadataPath, "utf-8");
      const metadata = JSON.parse(content);
      metadata.archived = true;
      metadata.updated = new Date().toISOString();
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    }
  }

  unarchiveWorkbook(workbookId: string): void {
    const sourcePath = path.join(this.archiveDir, workbookId);
    const targetPath = path.join(
      this.workbookService["workbooksDir"],
      workbookId,
    );

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Archived workbook not found: ${workbookId}`);
    }

    fs.renameSync(sourcePath, targetPath);

    const metadataPath = path.join(targetPath, "workbook.json");
    if (fs.existsSync(metadataPath)) {
      const content = fs.readFileSync(metadataPath, "utf-8");
      const metadata = JSON.parse(content);
      metadata.archived = false;
      metadata.updated = new Date().toISOString();
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    }
  }

  archiveFile(workbookId: string, relativePath: string): void {
    const workbookPath = path.join(
      this.workbookService["workbooksDir"],
      workbookId,
    );
    const archivePath = path.join(workbookPath, "archive");
    this.ensureDirectoryExists(archivePath);

    const sourcePath = path.join(workbookPath, relativePath);
    const filename = path.basename(relativePath);
    const targetPath = path.join(archivePath, filename);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`File not found: ${relativePath}`);
    }

    fs.renameSync(sourcePath, targetPath);

    this.updateWorkbookMetadata(workbookId, (metadata) => {
      const doc = metadata.documents.find((d: any) => d.path === relativePath);
      if (doc) {
        doc.archived = true;
      }
      return metadata;
    });
  }

  unarchiveFile(workbookId: string, filename: string): void {
    const workbookPath = path.join(
      this.workbookService["workbooksDir"],
      workbookId,
    );
    const archivePath = path.join(workbookPath, "archive");
    const sourcePath = path.join(archivePath, filename);
    const targetPath = path.join(workbookPath, "documents", filename);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Archived file not found: ${filename}`);
    }

    const documentsPath = path.join(workbookPath, "documents");
    this.ensureDirectoryExists(documentsPath);

    fs.renameSync(sourcePath, targetPath);

    this.updateWorkbookMetadata(workbookId, (metadata) => {
      const doc = metadata.documents.find((d: any) => d.filename === filename);
      if (doc) {
        doc.archived = false;
        doc.path = `documents/${filename}`;
      }
      return metadata;
    });
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
