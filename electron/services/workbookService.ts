import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

export interface WorkbookMetadata {
  id: string;
  name: string;
  created: string;
  updated: string;
  archived?: boolean;
  folders?: string[]; // Array of folder names within this workbook
  documents: Array<{
    /**
     * Stable identifier for a file entry. Must not change across rename/move.
     * This enables CMS + RAG to reference the same file robustly.
     */
    docId?: string;
    filename: string;
    path: string;
    addedAt: string;
    folder?: string;
    modifiedAt?: string;
    fileType?: string;
    size?: number;
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
      folders: [],
    };

    const metadataPath = path.join(workbookPath, "workbook.json");
    fs.writeFileSync(metadataPath, JSON.stringify(workbook, null, 2));

    return workbook;
  }

  /**
   * Normalize persisted workbook metadata so downstream systems (CMS/RAG/UI) can rely on:
   * - canonical, folder-aware `path` (posix, under `documents/`)
   * - stable `docId` per document
   * - best-effort file stats (`modifiedAt`, `size`, `fileType`, `folder`)
   *
   * If normalization changes the metadata, it is persisted back to `workbook.json`.
   */
  private normalizeAndPersistMetadata(workbookId: string, workbookPath: string, metadata: any): WorkbookMetadata {
    let changed = false;

    if (!metadata || typeof metadata !== "object") {
      metadata = {};
      changed = true;
    }

    if (!Array.isArray(metadata.folders)) {
      metadata.folders = [];
      changed = true;
    }

    if (!Array.isArray(metadata.documents)) {
      metadata.documents = [];
      changed = true;
    }

    const toPosix = (p: string) => p.replace(/\\/g, "/");

    // Drop any document entries whose backing file is missing to prevent stale ("legacy") data
    // from showing up in the UI or downstream systems.
    const existingDocs: any[] = [];

    for (const doc of metadata.documents) {
      if (!doc || typeof doc !== "object") continue;

      // Ensure filename/path exist
      if (!doc.filename && typeof doc.path === "string") {
        doc.filename = path.posix.basename(toPosix(doc.path));
        changed = true;
      }

      if (!doc.path && doc.filename) {
        doc.path = `documents/${doc.filename}`;
        changed = true;
      }

      if (typeof doc.path === "string") {
        const original = doc.path;
        // Canonicalize slashes and remove leading "./"
        doc.path = toPosix(doc.path).replace(/^\.\//, "");
        if (doc.path !== original) changed = true;

        // Ensure path is under documents/
        if (!doc.path.startsWith("documents/")) {
          doc.path = `documents/${doc.filename || path.posix.basename(doc.path)}`;
          changed = true;
        }
      }

      if (!doc.addedAt) {
        doc.addedAt = new Date().toISOString();
        changed = true;
      }

      // Stable identity
      if (!doc.docId) {
        doc.docId = uuidv4();
        changed = true;
      }

      // Derived metadata
      const posixPath = typeof doc.path === "string" ? toPosix(doc.path) : "";
      const parts = posixPath.split("/").filter(Boolean);
      const folderName = parts.length >= 3 && parts[0] === "documents" ? parts[1] : undefined;
      if (doc.folder !== folderName) {
        doc.folder = folderName;
        changed = true;
      }

      const ext = doc.filename ? path.extname(doc.filename).toLowerCase().replace(/^\./, "") : "";
      if (doc.fileType !== ext) {
        doc.fileType = ext;
        changed = true;
      }

      // Best-effort file stats (skip if file missing)
      try {
        if (posixPath) {
          const abs = path.join(workbookPath, ...posixPath.split("/"));
          if (fs.existsSync(abs)) {
            const st = fs.statSync(abs);
            if (st.isFile()) {
              const m = st.mtime.toISOString();
              if (doc.modifiedAt !== m) {
                doc.modifiedAt = m;
                changed = true;
              }
              if (doc.size !== st.size) {
                doc.size = st.size;
                changed = true;
              }
            }
            // Keep this document entry (file exists)
            existingDocs.push(doc);
          } else {
            changed = true;
          }
        }
      } catch {
        // ignore stat failures; don't block load
      }
    }

    if (existingDocs.length !== metadata.documents.length) {
      metadata.documents = existingDocs;
      changed = true;
    }

    if (changed) {
      metadata.updated = new Date().toISOString();
      const metadataPath = path.join(workbookPath, "workbook.json");
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    }

    return metadata as WorkbookMetadata;
  }

  createFolder(workbookId: string, folderName: string): void {
    const workbook = this.getWorkbook(workbookId);
    if (!workbook) {
      throw new Error(`Workbook not found: ${workbookId}`);
    }

    // Validate folder name
    if (!folderName || folderName.trim() === "") {
      throw new Error("Folder name cannot be empty");
    }

    // Check if folder already exists
    if (workbook.folders && workbook.folders.includes(folderName)) {
      throw new Error(`Folder "${folderName}" already exists`);
    }

    // Create folder directory
    const workbookPath = path.join(this.workbooksDir, workbookId);
    const folderPath = path.join(workbookPath, "documents", folderName);
    fs.mkdirSync(folderPath, { recursive: true });

    // Update metadata
    if (!workbook.folders) {
      workbook.folders = [];
    }
    workbook.folders.push(folderName);
    workbook.updated = new Date().toISOString();

    const metadataPath = path.join(workbookPath, "workbook.json");
    fs.writeFileSync(metadataPath, JSON.stringify(workbook, null, 2));
  }

  deleteFolder(workbookId: string, folderName: string): void {
    const workbook = this.getWorkbook(workbookId);
    if (!workbook) {
      throw new Error(`Workbook not found: ${workbookId}`);
    }

    if (!workbook.folders || !workbook.folders.includes(folderName)) {
      throw new Error(`Folder "${folderName}" not found`);
    }

    // Delete folder directory
    const workbookPath = path.join(this.workbooksDir, workbookId);
    const folderPath = path.join(workbookPath, "documents", folderName);
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true });
    }

    // Update metadata
    workbook.folders = workbook.folders.filter((f) => f !== folderName);
    // Remove any document entries that lived under that folder so there is no stale/legacy metadata.
    const prefix = `documents/${folderName}/`;
    workbook.documents = (workbook.documents || []).filter((d) => {
      const p = typeof d?.path === "string" ? d.path.replace(/\\/g, "/") : "";
      const inFolder = p.startsWith(prefix) || String(d?.folder || "").trim() === folderName;
      return !inFolder;
    });
    workbook.updated = new Date().toISOString();

    const metadataPath = path.join(workbookPath, "workbook.json");
    fs.writeFileSync(metadataPath, JSON.stringify(workbook, null, 2));
  }

  renameFolder(workbookId: string, oldName: string, newName: string): void {
    const workbook = this.getWorkbook(workbookId);
    if (!workbook) {
      throw new Error(`Workbook not found: ${workbookId}`);
    }

    const fromName = (oldName || "").trim();
    const toName = (newName || "").trim();
    if (!fromName) throw new Error("Old folder name cannot be empty");
    if (!toName) throw new Error("New folder name cannot be empty");
    if (fromName === toName) return;

    if (!workbook.folders || !workbook.folders.includes(fromName)) {
      throw new Error(`Folder "${fromName}" not found`);
    }
    if (workbook.folders.includes(toName)) {
      throw new Error(`Folder "${toName}" already exists`);
    }

    // Rename folder directory
    const workbookPath = path.join(this.workbooksDir, workbookId);
    const fromPath = path.join(workbookPath, "documents", fromName);
    const toPath = path.join(workbookPath, "documents", toName);

    if (!fs.existsSync(fromPath)) {
      throw new Error(`Folder directory not found: ${fromName}`);
    }
    if (fs.existsSync(toPath)) {
      throw new Error(`Target folder directory already exists: ${toName}`);
    }

    fs.renameSync(fromPath, toPath);

    // Update metadata: folder list + any doc paths under that folder
    workbook.folders = workbook.folders.map((f) => (f === fromName ? toName : f));
    for (const doc of workbook.documents || []) {
      if (!doc || typeof doc.path !== "string") continue;
      const posixPath = doc.path.replace(/\\/g, "/");
      const prefix = `documents/${fromName}/`;
      if (posixPath.startsWith(prefix)) {
        doc.path = `documents/${toName}/` + posixPath.slice(prefix.length);
        doc.folder = toName;
      }
    }

    workbook.updated = new Date().toISOString();
    const metadataPath = path.join(workbookPath, "workbook.json");
    fs.writeFileSync(metadataPath, JSON.stringify(workbook, null, 2));
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
          const parsed = JSON.parse(content);
          const normalized = this.normalizeAndPersistMetadata(entry.name, workbookPath, parsed);
          workbooks.push(normalized);
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
      const parsed = JSON.parse(content);
      return this.normalizeAndPersistMetadata(id, workbookPath, parsed);
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
    const workbook = this.getWorkbook(id);
    if (!workbook) {
      throw new Error(`Workbook not found: ${id}`);
    }

    // Delete the workbook directory (folders are inside, so they'll be deleted recursively)
    const workbookPath = path.join(this.workbooksDir, id);
    if (fs.existsSync(workbookPath)) {
      fs.rmSync(workbookPath, { recursive: true, force: true });
    }
  }
}
