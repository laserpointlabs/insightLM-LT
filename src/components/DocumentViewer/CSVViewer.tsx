import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";

interface CSVViewerProps {
  content: string;
  isEditing?: boolean;
  onContentChange?: (content: string) => void;
}

export function CSVViewer({
  content,
  isEditing = false,
  onContentChange,
}: CSVViewerProps) {
  const initialParse = useMemo(() => {
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: false,
    });
    return {
      data: parsed.data as any[],
      headers: parsed.meta.fields || [],
    };
  }, [content]);

  const [data, setData] = useState<any[]>(initialParse.data);
  const [headers, setHeaders] = useState<string[]>(initialParse.headers);

  useEffect(() => {
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: false,
    });
    setData(parsed.data as any[]);
    setHeaders(parsed.meta.fields || []);
  }, [content]);

  const updateCell = (rowIdx: number, header: string, value: string) => {
    const newData = [...data];
    if (!newData[rowIdx]) {
      newData[rowIdx] = {};
    }
    newData[rowIdx][header] = value;
    setData(newData);

    // Convert back to CSV and notify parent
    const csv = Papa.unparse(newData, { header: true });
    onContentChange?.(csv);
  };

  const addRow = () => {
    const newRow: any = {};
    headers.forEach((h) => (newRow[h] = ""));
    setData([...data, newRow]);
    const csv = Papa.unparse([...data, newRow], { header: true });
    onContentChange?.(csv);
  };

  const deleteRow = (rowIdx: number) => {
    const newData = data.filter((_, idx) => idx !== rowIdx);
    setData(newData);
    const csv = Papa.unparse(newData, { header: true });
    onContentChange?.(csv);
  };

  // CSV is always editable if isEditing is true
  if (isEditing) {
    return (
      <div className="h-full overflow-auto p-4">
        <div className="mb-2 flex gap-2">
          <button
            onClick={addRow}
            className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
          >
            + Add Row
          </button>
        </div>
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              {headers.map((header, idx) => (
                <th
                  key={idx}
                  className="border-b border-gray-300 px-4 py-2 text-left text-sm font-semibold"
                >
                  {header}
                </th>
              ))}
              <th className="border-b border-gray-300 px-4 py-2 text-left text-sm font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-gray-50">
                {headers.map((header, colIdx) => (
                  <td key={colIdx} className="border-b border-gray-200 p-0">
                    <input
                      type="text"
                      value={row[header] || ""}
                      onChange={(e) =>
                        updateCell(rowIdx, header, e.target.value)
                      }
                      className="w-full border-0 px-4 py-2 text-sm focus:bg-blue-50 focus:outline-none"
                    />
                  </td>
                ))}
                <td className="border-b border-gray-200 px-4 py-2">
                  <button
                    onClick={() => deleteRow(rowIdx)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <table className="min-w-full border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            {headers.map((header, idx) => (
              <th
                key={idx}
                className="border-b border-gray-300 px-4 py-2 text-left text-sm font-semibold"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-gray-50">
              {headers.map((header, colIdx) => (
                <td
                  key={colIdx}
                  className="border-b border-gray-200 px-4 py-2 text-sm"
                >
                  {row[header] || ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
