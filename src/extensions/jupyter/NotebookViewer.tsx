import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NotebookDocument, NotebookCell, NotebookOutput } from '../../types';
import { testIds } from '../../testing/testIds';

interface NotebookViewerProps {
  content: string;
  filename: string;
  workbookId?: string;
  path?: string;
  onContentChange?: (content: string) => void;
}

export function NotebookViewer({ content, filename, workbookId, path, onContentChange }: NotebookViewerProps) {
  console.log('NotebookViewer: Component rendered with props:', { content: content.substring(0, 100) + '...', filename, workbookId, path });

  const [notebook, setNotebook] = useState<NotebookDocument | null>(null);
  const [executingCells, setExecutingCells] = useState<Set<number>>(new Set());
  const [kernelStatus, setKernelStatus] = useState<'idle' | 'busy' | 'error'>('idle');
  const [editingCells, setEditingCells] = useState<Set<number>>(new Set());
  const [focusedCellIndex, setFocusedCellIndex] = useState<number | null>(null);
  const cellTextareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map());
  const cellContainerRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    console.log('NotebookViewer: Parsing notebook content, length:', content.length);
    try {
      const parsed = JSON.parse(content);
      console.log('NotebookViewer: Successfully parsed notebook with', parsed.cells?.length || 0, 'cells');
      setNotebook(parsed);
    } catch (error) {
      console.error('NotebookViewer: Failed to parse notebook:', error);
      console.log('NotebookViewer: Content preview:', content.substring(0, 200));
      // Create a basic notebook if parsing fails
      setNotebook({
        cells: [{
          cell_type: 'markdown',
          source: '# Error Loading Notebook\n\nFailed to parse notebook content.',
          metadata: {}
        }],
        metadata: {
          kernelspec: {
            name: 'python3',
            display_name: 'Python 3',
            language: 'python'
          }
        },
        nbformat: 4,
        nbformat_minor: 2
      });
    }
  }, [content]);

  const updateNotebook = (updatedNotebook: NotebookDocument) => {
    setNotebook(updatedNotebook);
    onContentChange?.(JSON.stringify(updatedNotebook, null, 2));
  };

  const handleCellChange = (cellIndex: number, newSource: string) => {
    if (!notebook) return;

    const updatedNotebook = {
      ...notebook,
      cells: notebook.cells.map((cell, index) =>
        index === cellIndex ? { ...cell, source: newSource } : cell
      )
    };

    updateNotebook(updatedNotebook);
  };

  const handleExecuteCell = async (cellIndex: number, moveToNext: boolean = false) => {
    if (!notebook || !path || !workbookId) return;

    const cell = notebook.cells[cellIndex];
    if (cell.cell_type !== 'code') return;

    setExecutingCells(prev => new Set(prev).add(cellIndex));
    setKernelStatus('busy');

    try {
      // Use the proper MCP integration via electron API
      console.log('Executing cell:', cellIndex, 'with code:', cell.source.substring(0, 50) + '...');

      const result = await window.electronAPI.mcp.jupyterExecuteCell(
        workbookId,
        path,
        cellIndex,
        cell.source
      );

      console.log('Cell execution result:', JSON.stringify(result, null, 2));

      // Handle successful execution
      const executionCount = (cell.execution_count || 0) + 1;

      // Process the MCP result into proper Jupyter outputs
      let outputs: NotebookOutput[] = [];

      // Handle different possible result formats from MCP
      let resultData = result;

      // If result is the full MCP response, extract the inner result
      if (result && result.jsonrpc && result.result) {
        resultData = result.result;
      }

      console.log('Extracted result data:', JSON.stringify(resultData, null, 2));

      if (resultData && resultData.outputs && Array.isArray(resultData.outputs)) {
        // Convert MCP outputs to Jupyter format
        outputs = resultData.outputs.map((output: any) => {
          console.log('Processing output:', output);
          switch (output.output_type) {
            case 'stream':
              return {
                output_type: 'stream',
                name: output.name || 'stdout',
                text: output.text
              };
            case 'execute_result':
              return {
                output_type: 'execute_result',
                data: output.data,
                execution_count: output.execution_count || executionCount
              };
            case 'display_data':
              return {
                output_type: 'display_data',
                data: output.data
              };
            case 'error':
              return {
                output_type: 'error',
                ename: output.ename || 'ExecutionError',
                evalue: output.evalue || 'Unknown error',
                traceback: output.traceback || []
              };
            default:
              console.log('Unknown output type:', output.output_type);
              return output;
          }
        });
      } else {
        // Fallback for simple string results or unexpected format
        console.log('Using fallback output processing');
        outputs = [{
          output_type: 'stream',
          name: 'stdout',
          text: typeof resultData === 'string' ? resultData : JSON.stringify(resultData)
        }];
      }

      console.log('Final outputs:', JSON.stringify(outputs, null, 2));

      const updatedNotebook = {
        ...notebook,
        cells: notebook.cells.map((c, index) =>
          index === cellIndex
            ? {
                ...c,
                outputs: outputs,
                execution_count: executionCount
              }
            : c
        )
      };

      updateNotebook(updatedNotebook);
    } catch (error) {
      console.error('Failed to execute cell:', error);

      // Show error in the cell
      const errorOutput: NotebookOutput = {
        output_type: 'error',
        ename: 'ExecutionError',
        evalue: error instanceof Error ? error.message : 'Unknown execution error',
        traceback: [error instanceof Error ? error.message : 'Unknown execution error']
      };

      const updatedNotebook = {
        ...notebook,
        cells: notebook.cells.map((c, index) =>
          index === cellIndex
            ? { ...c, outputs: [errorOutput], execution_count: (c.execution_count || 0) + 1 }
            : c
        )
      };

      updateNotebook(updatedNotebook);
    } finally {
      setExecutingCells(prev => {
        const next = new Set(prev);
        next.delete(cellIndex);
        return next;
      });
      setKernelStatus('idle');

      // Move to next cell if requested (Shift+Enter)
      if (moveToNext) {
        moveToNextCell(cellIndex, 'code');
      }
    }
  };

  const addCell = (afterIndex: number, cellType: 'code' | 'markdown' = 'code') => {
    if (!notebook) return;

    const newCell: NotebookCell = {
      cell_type: cellType,
      source: cellType === 'code' ? '' : '# New Cell',
      metadata: {},
      outputs: cellType === 'code' ? [] : undefined,
      execution_count: cellType === 'code' ? null : undefined
    };

    const updatedNotebook = {
      ...notebook,
      cells: [
        ...notebook.cells.slice(0, afterIndex + 1),
        newCell,
        ...notebook.cells.slice(afterIndex + 1)
      ]
    };

    updateNotebook(updatedNotebook);
  };

  const deleteCell = (cellIndex: number) => {
    if (!notebook) return;

    const updatedNotebook = {
      ...notebook,
      cells: notebook.cells.filter((_, index) => index !== cellIndex)
    };

    updateNotebook(updatedNotebook);
  };

  const moveToNextCell = (currentIndex: number, cellType: 'code' | 'markdown' = 'code') => {
    if (!notebook) return;

    const nextIndex = currentIndex + 1;

    // Update focused cell index and scroll into view
    setFocusedCellIndex(nextIndex);

    if (nextIndex < notebook.cells.length) {
      // Focus next cell's textarea
      setTimeout(() => {
        const nextTextarea = cellTextareaRefs.current.get(nextIndex);
        const nextContainer = cellContainerRefs.current.get(nextIndex);

        // Scroll cell into view
        if (nextContainer) {
          nextContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        if (nextTextarea) {
          nextTextarea.focus();
        } else {
          // If next cell is markdown and not in edit mode, enter edit mode first
          const nextCell = notebook.cells[nextIndex];
          if (nextCell && nextCell.cell_type === 'markdown' && !editingCells.has(nextIndex)) {
            const newEditing = new Set(editingCells);
            newEditing.add(nextIndex);
            setEditingCells(newEditing);
            // Try to focus again after state update
            setTimeout(() => {
              const textarea = cellTextareaRefs.current.get(nextIndex);
              if (textarea) {
                textarea.focus();
              }
            }, 50);
          }
        }
      }, 100);
    } else {
      // Create new cell and focus it
      addCell(currentIndex, cellType);
      // Wait for React to re-render with the new cell
      setTimeout(() => {
        const newTextarea = cellTextareaRefs.current.get(nextIndex);
        const newContainer = cellContainerRefs.current.get(nextIndex);

        // Scroll new cell into view
        if (newContainer) {
          newContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        if (newTextarea) {
          newTextarea.focus();
        }
      }, 200);
    }
  };

  const renderCellOutput = (output: NotebookOutput, index: number) => {
    switch (output.output_type) {
      case 'stream':
        return (
          <div key={index} className="px-4 py-2 bg-gray-50 border-l-4 border-gray-400">
            <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap overflow-x-auto">
              {Array.isArray(output.text) ? output.text.join('') : output.text}
            </pre>
          </div>
        );

      case 'execute_result':
        return (
          <div key={index} className="px-4 py-2 bg-gray-50 border-l-4 border-blue-400">
            <div className="text-xs text-gray-500 mb-1 font-mono">
              Out [{output.execution_count || '?'}]:
            </div>
            <div className="text-sm">
              {renderOutputData(output.data)}
            </div>
          </div>
        );

      case 'display_data':
        return (
          <div key={index} className="px-4 py-2 bg-gray-50 border-l-4 border-green-400">
            <div className="text-sm">
              {renderOutputData(output.data)}
            </div>
          </div>
        );

      case 'error':
        return (
          <div key={index} className="px-4 py-2 bg-red-50 border-l-4 border-red-500">
            <div className="text-red-800 font-semibold text-sm mb-1">
              {output.ename}: {output.evalue}
            </div>
            {output.traceback && (
              <pre className="text-red-700 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
                {output.traceback.join('\n')}
              </pre>
            )}
          </div>
        );

      default:
        return (
          <div key={index} className="px-4 py-2 bg-gray-50 border-l-4 border-gray-400">
            <pre className="text-xs font-mono text-gray-600 overflow-x-auto">
              {JSON.stringify(output, null, 2)}
            </pre>
          </div>
        );
    }
  };

  const renderOutputData = (data: any) => {
    if (!data) return null;

    // Handle image data
    if (data['image/png'] || data['image/jpeg'] || data['image/svg+xml']) {
      const imageData = data['image/png'] || data['image/jpeg'] || data['image/svg+xml'];
      const mimeType = data['image/png'] ? 'image/png' : data['image/jpeg'] ? 'image/jpeg' : 'image/svg+xml';
      return (
        <img
          src={`data:${mimeType};base64,${imageData}`}
          alt="Output"
          className="max-w-full h-auto"
        />
      );
    }

    // Handle text data
    if (data['text/plain']) {
      return (
        <pre className="text-sm font-mono whitespace-pre-wrap overflow-x-auto">
          {data['text/plain']}
        </pre>
      );
    }

    // Handle HTML data
    if (data['text/html']) {
      return (
        <div
          className="text-sm"
          dangerouslySetInnerHTML={{ __html: data['text/html'] }}
        />
      );
    }

    // Handle LaTeX/MathJax
    if (data['text/latex']) {
      return (
        <div className="text-sm font-mono bg-gray-50 p-2 rounded">
          {data['text/latex']}
        </div>
      );
    }

    // Fallback
    return (
      <pre className="text-xs overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  const renderCell = (cell: NotebookCell, index: number) => {
    const isExecuting = executingCells.has(index);
    const isFocused = focusedCellIndex === index;

    return (
      <div
        key={index}
        ref={(el) => {
          if (el) {
            cellContainerRefs.current.set(index, el);
          } else {
            cellContainerRefs.current.delete(index);
          }
        }}
        className={`group border rounded-sm mb-2 overflow-hidden transition-all ${
          isFocused
            ? 'border-blue-500 shadow-md ring-2 ring-blue-200'
            : 'border-gray-200 hover:border-gray-300'
        }`}
        data-testid={testIds.notebook.cell(index)}
      >
        {/* Cell Input Area */}
        <div className="flex">
          {/* Cell Toolbar - Left Side */}
          <div className="flex flex-col items-center bg-gray-50 border-r border-gray-200 px-2 py-3 min-w-[60px]">
            {cell.cell_type === 'code' && (
              <button
                onClick={() => handleExecuteCell(index)}
                disabled={isExecuting}
                className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors ${
                  isExecuting
                    ? 'bg-orange-500 text-white cursor-not-allowed'
                    : 'bg-transparent hover:bg-green-500 hover:text-white text-gray-600'
                }`}
                title="Run cell (Ctrl+Enter)"
                data-testid={testIds.notebook.runCell(index)}
              >
                ▶️
              </button>
            )}
            {cell.cell_type === 'markdown' && (
              <button
                onClick={() => {
                  const newEditing = new Set(editingCells);
                  if (newEditing.has(index)) {
                    newEditing.delete(index);
                  } else {
                    newEditing.add(index);
                  }
                  setEditingCells(newEditing);
                }}
                className="w-6 h-6 rounded flex items-center justify-center text-xs bg-transparent hover:bg-gray-500 hover:text-white text-gray-600 transition-colors"
                title="Toggle edit/preview"
              >
                ✏️
              </button>
            )}

            {/* Cell type indicator */}
            <div className="mt-2 text-xs text-gray-500 font-mono">
              {cell.cell_type === 'code' ? '[ ]' : '[M]'}
            </div>

            {/* Execution count for code cells */}
            {cell.cell_type === 'code' && cell.execution_count && (
              <div className="mt-1 text-xs text-gray-500 font-mono">
                [{cell.execution_count}]
              </div>
            )}
          </div>

          {/* Cell Content */}
          <div className="flex-1">
            <div className="p-4">
              {cell.cell_type === 'markdown' ? (
                editingCells.has(index) ? (
                  <textarea
                    ref={(el) => {
                      if (el) {
                        cellTextareaRefs.current.set(index, el);
                      } else {
                        cellTextareaRefs.current.delete(index);
                      }
                    }}
                    value={cell.source}
                    onChange={(e) => handleCellChange(index, e.target.value)}
                    onFocus={() => setFocusedCellIndex(index)}
                    onKeyDown={(e) => {
                      if (e.ctrlKey && e.key === 'Enter') {
                        e.preventDefault();
                        // For markdown cells, just blur to exit edit mode
                        const newEditing = new Set(editingCells);
                        newEditing.delete(index);
                        setEditingCells(newEditing);
                      } else if (e.shiftKey && e.key === 'Enter') {
                        e.preventDefault();
                        // Exit edit mode and move to next cell
                        const newEditing = new Set(editingCells);
                        newEditing.delete(index);
                        setEditingCells(newEditing);
                        moveToNextCell(index, 'code');
                      }
                    }}
                    className="w-full min-h-[40px] p-0 border-none resize-none focus:outline-none font-mono text-sm bg-transparent"
                    placeholder="Enter markdown..."
                    rows={Math.max(1, cell.source.split('\n').length)}
                  />
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {cell.source}
                    </ReactMarkdown>
                  </div>
                )
              ) : (
                <div className="relative">
                  <textarea
                    ref={(el) => {
                      if (el) {
                        cellTextareaRefs.current.set(index, el);
                      } else {
                        cellTextareaRefs.current.delete(index);
                      }
                    }}
                    value={cell.source}
                    onChange={(e) => handleCellChange(index, e.target.value)}
                    onFocus={() => setFocusedCellIndex(index)}
                    onKeyDown={(e) => {
                      if (e.ctrlKey && e.key === 'Enter') {
                        e.preventDefault();
                        if (cell.cell_type === 'code' && !isExecuting) {
                          handleExecuteCell(index, false);
                        }
                      } else if (e.shiftKey && e.key === 'Enter') {
                        e.preventDefault();
                        if (cell.cell_type === 'code' && !isExecuting) {
                          handleExecuteCell(index, true);
                        }
                      }
                    }}
                    className="w-full min-h-[40px] p-0 border-none resize-none focus:outline-none font-mono text-sm bg-transparent"
                    placeholder="Enter Python code..."
                    rows={Math.max(1, cell.source.split('\n').length)}
                    spellCheck={false}
                  />
                  {isExecuting && (
                    <div className="absolute top-2 right-2 w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                  )}
                </div>
              )}
            </div>

            {/* Cell Outputs */}
            {cell.outputs && cell.outputs.length > 0 && (
              <div
                className="border-t border-gray-200 bg-gray-50"
                data-testid={testIds.notebook.output(index)}
              >
                {cell.outputs.map((output, outputIndex) => renderCellOutput(output, outputIndex))}
              </div>
            )}
          </div>
        </div>

        {/* Cell Actions - Bottom (on hover) */}
        <div className="flex justify-center gap-1 p-2 bg-gray-50 border-t border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => addCell(index, 'code')}
            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded transition-colors"
            title="Add code cell below"
          >
            + Code
          </button>
          <button
            onClick={() => addCell(index, 'markdown')}
            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded transition-colors"
            title="Add markdown cell below"
          >
            + Markdown
          </button>
          <button
            onClick={() => deleteCell(index)}
            className="px-2 py-1 text-xs text-red-600 hover:bg-red-100 rounded transition-colors"
            title="Delete cell"
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  if (!notebook) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading notebook...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white" data-testid={testIds.notebook.viewer}>
      {/* Notebook Header - VS Code Style */}
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-medium text-gray-900">{filename}</h1>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className={`w-2 h-2 rounded-full ${
              kernelStatus === 'busy' ? 'bg-orange-500 animate-pulse' :
              kernelStatus === 'error' ? 'bg-red-500' : 'bg-green-500'
            }`} />
            <span>{notebook.metadata.kernelspec?.display_name || 'Python 3'}</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => addCell(notebook.cells.length - 1, 'code')}
            className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            title="Add Code Cell"
          >
            + Code
          </button>
          <button
            onClick={() => addCell(notebook.cells.length - 1, 'markdown')}
            className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            title="Add Markdown Cell"
          >
            + Markdown
          </button>
        </div>
      </div>

      {/* Notebook Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-none px-4 py-2">
          {notebook.cells.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm mb-4">This notebook is empty</p>
              <button
                onClick={() => addCell(-1, 'code')}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Add your first cell
              </button>
            </div>
          ) : (
            <div className="space-y-0">
              {notebook.cells.map((cell, index) => renderCell(cell, index))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
