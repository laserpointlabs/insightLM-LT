import { useMemo } from "react";
import Papa from "papaparse";

interface CSVViewerProps {
  content: string;
}

export function CSVViewer({ content }: CSVViewerProps) {
  const { data, headers } = useMemo(() => {
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
    });
    return {
      data: parsed.data as any[],
      headers: parsed.meta.fields || [],
    };
  }, [content]);

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
