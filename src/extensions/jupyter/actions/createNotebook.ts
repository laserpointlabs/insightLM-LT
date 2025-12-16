export async function createNotebook(workbookId: string, name?: string): Promise<string> {
  if (!window.electronAPI?.file) {
    throw new Error("Electron API not available");
  }

  // Use provided name or generate a unique notebook name
  let notebookName: string;
  if (name) {
    // Ensure the name has the .ipynb extension
    notebookName = name.endsWith('.ipynb') ? name : `${name}.ipynb`;
  } else {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
    notebookName = `notebook-${timestamp}.ipynb`;
  }

  // Create the notebook file path
  const notebookPath = `documents/${notebookName}`;

  // Create the notebook content
  const notebookContent = JSON.stringify(
    {
      cells: [
        {
          cell_type: "code",
          source: '# Welcome to your new notebook!\nprint("Hello, World!")',
          metadata: {},
          outputs: [],
          execution_count: null,
        },
      ],
      metadata: {
        kernelspec: {
          name: "python3",
          display_name: "Python 3",
          language: "python",
        },
      },
      nbformat: 4,
      nbformat_minor: 2,
    },
    null,
    2,
  );

  // Write the notebook file
  await window.electronAPI.file.write(workbookId, notebookPath, notebookContent);

  return notebookName;
}
