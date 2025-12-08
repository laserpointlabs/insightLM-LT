import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

export interface WorkbookMetadata {
  id: string;
  name: string;
  created: string;
  updated: string;
  archived?: boolean;
  documents: Array<{
    filename: string;
    path: string;
    addedAt: string;
  }>;
}

export class WorkbookService {
  private workbooksDir: string = "";

  initialize(dataDir: string) {
    this.workbooksDir = path.join(dataDir, "workbooks");
    this.ensureDirectoryExists(this.workbooksDir);
  }

  private ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  createWorkbook(name: string): WorkbookMetadata {
    const workbookId = uuidv4();
    const workbookPath = path.join(this.workbooksDir, workbookId);
    const documentsPath = path.join(workbookPath, "documents");

    fs.mkdirSync(workbookPath, { recursive: true });
    fs.mkdirSync(documentsPath, { recursive: true });

    const now = new Date().toISOString();
    const workbook: WorkbookMetadata = {
      id: workbookId,
      name,
      created: now,
      updated: now,
      documents: [],
    };

    const metadataPath = path.join(workbookPath, "workbook.json");
    fs.writeFileSync(metadataPath, JSON.stringify(workbook, null, 2));

    return workbook;
  }

  getWorkbooks(): WorkbookMetadata[] {
    if (!fs.existsSync(this.workbooksDir)) {
      return [];
    }

    const workbooks: WorkbookMetadata[] = [];
    const entries = fs.readdirSync(this.workbooksDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const workbookPath = path.join(this.workbooksDir, entry.name);
      const metadataPath = path.join(workbookPath, "workbook.json");

      if (fs.existsSync(metadataPath)) {
        try {
          const content = fs.readFileSync(metadataPath, "utf-8");
          const metadata = JSON.parse(content) as WorkbookMetadata;
          workbooks.push(metadata);
        } catch (error) {
          console.error(`Failed to read workbook ${entry.name}:`, error);
        }
      }
    }

    return workbooks;
  }

  getWorkbook(id: string): WorkbookMetadata | null {
    const workbookPath = path.join(this.workbooksDir, id);
    const metadataPath = path.join(workbookPath, "workbook.json");

    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(metadataPath, "utf-8");
      return JSON.parse(content) as WorkbookMetadata;
    } catch (error) {
      console.error(`Failed to read workbook ${id}:`, error);
      return null;
    }
  }

  renameWorkbook(id: string, newName: string): void {
    const workbook = this.getWorkbook(id);
    if (!workbook) {
      throw new Error(`Workbook not found: ${id}`);
    }

    const workbookPath = path.join(this.workbooksDir, id);
    const metadataPath = path.join(workbookPath, "workbook.json");

    workbook.name = newName;
    workbook.updated = new Date().toISOString();

    fs.writeFileSync(metadataPath, JSON.stringify(workbook, null, 2));
  }

  deleteWorkbook(id: string): void {
    const workbookPath = path.join(this.workbooksDir, id);
    if (fs.existsSync(workbookPath)) {
      fs.rmSync(workbookPath, { recursive: true, force: true });
    }
  }
}
