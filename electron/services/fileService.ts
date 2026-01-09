import * as fs from "fs";
import * as path from "path";
import { WorkbookService } from "./workbookService";
import { DocumentExtractor } from "./documentExtractor";
import { v4 as uuidv4 } from "uuid";

export class FileService {
  private workbookService: WorkbookService;

  constructor(workbookService: WorkbookService) {
    this.workbookService = workbookService;
  }

  private toPosixPath(p: string): string {
    return p.replace(/\\/g, "/");
  }

  /**
   * Resolve a workbook-scoped relative path safely.
   * Enforces the Project data boundary by preventing:
   * - absolute paths
   * - path traversal (`..`)
   * - symlink escape (best-effort via realpath of the workbook root)
   */
  private resolveWithinWorkbook(workbookId: string, relativePath: string): { workbookPath: string; filePath: string; relPosix: string } {
    const wbRoot = path.join(this.workbookService["workbooksDir"], workbookId);
    const relPosix = this.toPosixPath(String(relativePath || "")).replace(/^\/+/, "").replace(/^\.\//, "");

    if (!relPosix) {
      throw new Error("Path not allowed: empty path");
    }
    // Reject absolute paths (including Windows drive paths).
    if (path.isAbsolute(relativePath) || /^[a-zA-Z]:[\\/]/.test(String(relativePath || ""))) {
      throw new Error("Path not allowed: absolute path");
    }
    // Reject traversal segments.
    const segs = relPosix.split("/").filter(Boolean);
    if (segs.some((s) => s === "..")) {
      throw new Error("Path not allowed: traversal");
    }

    // Resolve to absolute.
    const candidate = path.resolve(wbRoot, ...segs);

    // Best-effort symlink escape prevention: compare against real workbook root.
    let wbReal = wbRoot;
    try {
      wbReal = fs.realpathSync(wbRoot);
    } catch {
      wbReal = path.resolve(wbRoot);
    }
    const prefix = wbReal.endsWith(path.sep) ? wbReal : wbReal + path.sep;

    // If target exists, realpath it before checking prefix to avoid symlink escapes.
    let candToCheck = candidate;
    try {
      if (fs.existsSync(candidate)) candToCheck = fs.realpathSync(candidate);
    } catch {
      candToCheck = candidate;
    }

    if (!(candToCheck === wbReal || candToCheck.startsWith(prefix))) {
      throw new Error("Path not allowed: outside workbook");
    }

    return { workbookPath: wbRoot, filePath: candidate, relPosix };
  }

  private getFileStats(filePath: string): { modifiedAt?: string; size?: number } {
    try {
      if (!fs.existsSync(filePath)) return {};
      const st = fs.statSync(filePath);
      if (!st.isFile()) return {};
      return { modifiedAt: st.mtime.toISOString(), size: st.size };
    } catch {
      return {};
    }
  }

  private ensureDocumentEntry(metadata: any, entry: any): void {
    if (!Array.isArray(metadata.documents)) metadata.documents = [];
    metadata.documents.push(entry);
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

    const fileType = path.extname(finalFilename).toLowerCase().replace(/^\./, "");
    const stats = this.getFileStats(destPath);
    const canonicalPath = `documents/${finalFilename}`;

    if (existingIndex >= 0) {
      metadata.documents[existingIndex].addedAt = new Date().toISOString();
      metadata.documents[existingIndex].path = canonicalPath;
      metadata.documents[existingIndex].fileType = fileType;
      if (stats.modifiedAt) metadata.documents[existingIndex].modifiedAt = stats.modifiedAt;
      if (typeof stats.size === "number") metadata.documents[existingIndex].size = stats.size;
      if (!metadata.documents[existingIndex].docId) metadata.documents[existingIndex].docId = uuidv4();
    } else {
      this.ensureDocumentEntry(metadata, {
        docId: uuidv4(),
        filename: finalFilename,
        path: canonicalPath,
        addedAt: new Date().toISOString(),
        fileType,
        ...stats,
      });
    }

    metadata.updated = new Date().toISOString();
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    return Promise.resolve();
  }

  async readDocument(workbookId: string, relativePath: string): Promise<string> {
    const { workbookPath, filePath } = this.resolveWithinWorkbook(workbookId, relativePath);

    // Debug logging for troubleshooting
    console.log(`[FileService] readDocument called:`);
    console.log(`  workbookId: ${workbookId}`);
    console.log(`  relativePath: ${relativePath}`);
    console.log(`  workbooksDir: ${this.workbookService["workbooksDir"]}`);
    console.log(`  workbookPath: ${workbookPath}`);
    console.log(`  filePath: ${filePath}`);
    console.log(`  filePath exists: ${fs.existsSync(filePath)}`);

    if (!fs.existsSync(filePath)) {
      // Check if workbook directory exists
      const workbookExists = fs.existsSync(workbookPath);
      const workbooksDirExists = fs.existsSync(this.workbookService["workbooksDir"]);
      console.error(`[FileService] File not found. Debug info:`);
      console.error(`  workbooksDir exists: ${workbooksDirExists}`);
      console.error(`  workbookPath exists: ${workbookExists}`);
      if (workbookExists) {
        const documentsPath = path.join(workbookPath, "documents");
        const documentsExists = fs.existsSync(documentsPath);
        console.error(`  documents directory exists: ${documentsExists}`);
        if (documentsExists) {
          const files = fs.readdirSync(documentsPath);
          console.error(`  Files in documents directory: ${files.join(", ")}`);
        }
      }
      throw new Error(`File not found: ${relativePath}`);
    }

    // Use DocumentExtractor to handle PDF, Word, and text files
    return await DocumentExtractor.extractText(filePath);
  }

  getFilePath(workbookId: string, relativePath: string): string {
    const { filePath } = this.resolveWithinWorkbook(workbookId, relativePath);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${relativePath}`);
    }

    return filePath;
  }

  readBinary(workbookId: string, relativePath: string): Buffer {
    const { filePath } = this.resolveWithinWorkbook(workbookId, relativePath);

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
    const { filePath } = this.resolveWithinWorkbook(workbookId, relativePath);

    // Ensure the directory exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, content, "utf-8");

    // Update workbook metadata
    this.updateWorkbookMetadata(workbookId, (metadata) => {
      metadata.updated = new Date().toISOString();

      const canonicalRel = this.toPosixPath(relativePath).replace(/^\.\//, "");
      const filename = path.basename(canonicalRel);
      const fileType = path.extname(filename).toLowerCase().replace(/^\./, "");
      const stats = this.getFileStats(filePath);

      // Add the document to the workbook metadata if it's not already there
      const existingIndex = metadata.documents.findIndex(
        (doc: any) => doc.path === canonicalRel || doc.filename === filename,
      );

      if (existingIndex < 0) {
        this.ensureDocumentEntry(metadata, {
          docId: uuidv4(),
          filename,
          path: canonicalRel,
          addedAt: new Date().toISOString(),
          fileType,
          ...stats,
        });
      } else {
        // Ensure docId + canonical path + stats are present
        const doc = metadata.documents[existingIndex];
        if (!doc.docId) doc.docId = uuidv4();
        doc.filename = filename;
        doc.path = canonicalRel;
        doc.fileType = fileType;
        if (stats.modifiedAt) doc.modifiedAt = stats.modifiedAt;
        if (typeof stats.size === "number") doc.size = stats.size;
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
    const { filePath: oldPath } = this.resolveWithinWorkbook(workbookId, oldRelativePath);
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
        if (!doc.docId) doc.docId = uuidv4();
        doc.fileType = path.extname(newName).toLowerCase().replace(/^\./, "");
        const st = this.getFileStats(newPath);
        if (st.modifiedAt) doc.modifiedAt = st.modifiedAt;
        if (typeof st.size === "number") doc.size = st.size;
      }
      return metadata;
    });

    return Promise.resolve();
  }

  deleteDocument(workbookId: string, relativePath: string): Promise<void> {
    const { filePath } = this.resolveWithinWorkbook(workbookId, relativePath);

    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }

    this.updateWorkbookMetadata(workbookId, (metadata) => {
      const canonicalRel = this.toPosixPath(relativePath).replace(/^\.\//, "");
      metadata.documents = metadata.documents.filter(
        (d: any) => d.path !== canonicalRel,
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
    this.moveDocumentToFolder(sourceWorkbookId, relativePath, targetWorkbookId);
  }

  moveDocumentToFolder(
    sourceWorkbookId: string,
    relativePath: string,
    targetWorkbookId: string,
    targetFolder?: string,
    options?: { overwrite?: boolean; destFilename?: string },
  ): void {
    const canonicalRel = this.toPosixPath(relativePath).replace(/^\.\//, "");
    const sourcePath = this.resolveWithinWorkbook(sourceWorkbookId, canonicalRel).filePath;
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`File not found: ${canonicalRel}`);
    }

    const filename = path.posix.basename(canonicalRel);
    const folder = (targetFolder || "").trim();
    const destFilename = (options?.destFilename || "").trim() || filename;
    const destRel = folder ? `documents/${folder}/${destFilename}` : `documents/${destFilename}`;

    const targetDocsDir = path.join(
      this.workbookService["workbooksDir"],
      targetWorkbookId,
      "documents",
      ...(folder ? [folder] : []),
    );
    this.ensureDirectoryExists(targetDocsDir);

    const targetPath = this.resolveWithinWorkbook(targetWorkbookId, destRel).filePath;
    if (fs.existsSync(targetPath)) {
      if (options?.overwrite) {
        const st = fs.statSync(targetPath);
        if (st.isDirectory()) fs.rmSync(targetPath, { recursive: true, force: true });
        else fs.unlinkSync(targetPath);
        // Remove any existing metadata entry at destRel to avoid dupes
        this.updateWorkbookMetadata(targetWorkbookId, (metadata) => {
          const canonicalDest = this.toPosixPath(destRel).replace(/^\.\//, "");
          metadata.documents = (metadata.documents || []).filter((d: any) => d?.path !== canonicalDest);
          return metadata;
        });
      } else {
        throw new Error(`Target file already exists: ${destRel}`);
      }
    }

    fs.renameSync(sourcePath, targetPath);

    let movedDoc: any | null = null;
    this.updateWorkbookMetadata(sourceWorkbookId, (metadata) => {
      movedDoc =
        metadata.documents.find((d: any) => d.path === canonicalRel) ||
        metadata.documents.find((d: any) => d.filename === filename) ||
        null;
      metadata.documents = metadata.documents.filter(
        (d: any) => d.path !== canonicalRel && d.docId !== movedDoc?.docId,
      );
      return metadata;
    });

    this.updateWorkbookMetadata(targetWorkbookId, (metadata) => {
      const stats = this.getFileStats(targetPath);
      const fileType = path.extname(destFilename).toLowerCase().replace(/^\./, "");

      // Preserve stable identity if available; otherwise assign.
      const docId = movedDoc?.docId || uuidv4();

      this.ensureDocumentEntry(metadata, {
        ...(movedDoc || {}),
        docId,
        filename: destFilename,
        path: destRel,
        folder: folder || undefined,
        fileType,
        ...stats,
        // Keep existing addedAt if present; otherwise set now
        addedAt: movedDoc?.addedAt || new Date().toISOString(),
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
