export interface Workbook {
  id: string;
  name: string;
  created: string;
  updated: string;
  archived: boolean;
  documents: Document[];
}

export interface Document {
  filename: string;
  path: string;
  addedAt: string;
  archived?: boolean;
}

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
