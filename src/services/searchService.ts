import { Workbook } from "../types";

export interface SearchResult {
  workbookId: string;
  workbookName: string;
  documentPath: string;
  filename: string;
  matches: string[];
}

export async function searchWorkbooks(
  query: string,
  workbooks: Workbook[],
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  for (const workbook of workbooks) {
    if (workbook.archived) continue;

    for (const doc of workbook.documents) {
      if (doc.archived) continue;

      // Simple filename search
      if (doc.filename.toLowerCase().includes(lowerQuery)) {
        results.push({
          workbookId: workbook.id,
          workbookName: workbook.name,
          documentPath: doc.path,
          filename: doc.filename,
          matches: [`Filename contains "${query}"`],
        });
      }
    }
  }

  return results;
}
