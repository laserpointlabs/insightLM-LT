/**
 * Sheet CRUD operations for spreadsheets
 */

export interface Sheet {
  id: string;
  name: string;
  cells: Record<string, any>;
  formats?: Record<string, any>;
}

export interface SpreadsheetData {
  version: string;
  metadata: {
    name: string;
    created_at: string;
    modified_at: string;
    workbook_id: string;
  };
  sheets: Sheet[];
}

/**
 * Read a spreadsheet file and parse it
 */
async function readSpreadsheet(
  workbookId: string,
  spreadsheetPath: string,
): Promise<SpreadsheetData> {
  if (!window.electronAPI?.file) {
    throw new Error("Electron API not available");
  }

  const content = await window.electronAPI.file.read(workbookId, spreadsheetPath);
  return JSON.parse(content) as SpreadsheetData;
}

/**
 * Write a spreadsheet file
 */
async function writeSpreadsheet(
  workbookId: string,
  spreadsheetPath: string,
  data: SpreadsheetData,
): Promise<void> {
  if (!window.electronAPI?.file) {
    throw new Error("Electron API not available");
  }

  data.metadata.modified_at = new Date().toISOString();
  const content = JSON.stringify(data, null, 2);
  await window.electronAPI.file.write(workbookId, spreadsheetPath, content);
}

/**
 * Create a new sheet in a spreadsheet
 */
export async function createSheet(
  workbookId: string,
  spreadsheetPath: string,
  sheetName: string,
): Promise<string> {
  const data = await readSpreadsheet(workbookId, spreadsheetPath);
  
  // Generate unique sheet ID
  const sheetId = `sheet${data.sheets.length + 1}`;
  
  const newSheet: Sheet = {
    id: sheetId,
    name: sheetName,
    cells: {},
    formats: {},
  };

  data.sheets.push(newSheet);
  await writeSpreadsheet(workbookId, spreadsheetPath, data);

  return sheetId;
}

/**
 * Rename a sheet in a spreadsheet
 */
export async function renameSheet(
  workbookId: string,
  spreadsheetPath: string,
  sheetId: string,
  newName: string,
): Promise<void> {
  const data = await readSpreadsheet(workbookId, spreadsheetPath);
  
  const sheet = data.sheets.find((s) => s.id === sheetId);
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetId}`);
  }

  sheet.name = newName;
  await writeSpreadsheet(workbookId, spreadsheetPath, data);
}

/**
 * Delete a sheet from a spreadsheet
 */
export async function deleteSheet(
  workbookId: string,
  spreadsheetPath: string,
  sheetId: string,
): Promise<void> {
  const data = await readSpreadsheet(workbookId, spreadsheetPath);
  
  if (data.sheets.length <= 1) {
    throw new Error("Cannot delete the last sheet in a spreadsheet");
  }

  const index = data.sheets.findIndex((s) => s.id === sheetId);
  if (index === -1) {
    throw new Error(`Sheet not found: ${sheetId}`);
  }

  data.sheets.splice(index, 1);
  await writeSpreadsheet(workbookId, spreadsheetPath, data);
}

/**
 * Get all sheets from a spreadsheet
 */
export async function getSheets(
  workbookId: string,
  spreadsheetPath: string,
): Promise<Sheet[]> {
  const data = await readSpreadsheet(workbookId, spreadsheetPath);
  return data.sheets;
}





