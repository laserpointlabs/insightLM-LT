export async function createSpreadsheet(workbookId: string): Promise<string> {
  if (!window.electronAPI?.file) {
    throw new Error("Electron API not available");
  }

  // Generate a unique spreadsheet name
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const spreadsheetName = `spreadsheet-${timestamp}.is`;

  // Create the spreadsheet file path
  const spreadsheetPath = `documents/${spreadsheetName}`;

  // Create the spreadsheet content (.is format)
  const spreadsheetContent = JSON.stringify(
    {
      version: '1.0',
      metadata: {
        name: `Spreadsheet ${timestamp}`,
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        workbook_id: workbookId
      },
      sheets: [
        {
          id: 'sheet1',
          name: 'Sheet1',
          cells: {},
          formats: {}
        }
      ]
    },
    null,
    2,
  );

  // Write the spreadsheet file
  await window.electronAPI.file.write(workbookId, spreadsheetPath, spreadsheetContent);

  return spreadsheetName;
}
