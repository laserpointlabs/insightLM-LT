export async function createSpreadsheet(workbookId: string, name?: string): Promise<string> {
  if (!window.electronAPI?.file) {
    throw new Error("Electron API not available");
  }

  // Use provided name or generate a unique spreadsheet name
  let spreadsheetName: string;
  if (name) {
    // Ensure the name has the .is extension
    spreadsheetName = name.endsWith('.is') ? name : `${name}.is`;
  } else {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    spreadsheetName = `spreadsheet-${timestamp}.is`;
  }

  // Create the spreadsheet file path
  const spreadsheetPath = `documents/${spreadsheetName}`;

  // Create the spreadsheet content (.is format)
  const spreadsheetContent = JSON.stringify(
    {
      version: '1.0',
      metadata: {
        name: name || `Spreadsheet ${new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)}`,
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        workbook_id: workbookId
      },
      sheets: [
        {
          id: 'sheet1',
          name: 'Sheet1',
          cells: {},
          formats: {},
          viewState: {
            columnWidths: {},
            rowHeights: {},
          },
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
