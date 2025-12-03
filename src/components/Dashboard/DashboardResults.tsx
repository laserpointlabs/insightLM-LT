import { DashboardResult } from "../../types/dashboard";

interface DashboardResultsProps {
  result: DashboardResult;
}

export function DashboardResults({ result }: DashboardResultsProps) {
  if (result.chartType === "card") {
    return (
      <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-2">
        <div className="text-2xl font-bold text-blue-600">{result.value}</div>
        <div className="mt-1 text-xs text-gray-600">
          {result.metadata?.workbookName &&
            `${result.metadata.workbookName} • `}
          {result.metadata?.totalDocuments &&
            `${result.metadata.totalDocuments} documents`}
        </div>
      </div>
    );
  }

  if (result.chartType === "table" && result.data) {
    const columns = result.data.length > 0 ? Object.keys(result.data[0]) : [];

    return (
      <div className="mt-2">
        {result.value !== undefined && (
          <div className="mb-1 text-xs font-semibold text-gray-700">
            Total: {result.value}
          </div>
        )}
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="border-b border-gray-200 px-3 py-2 text-left font-semibold"
                  >
                    {col.charAt(0).toUpperCase() +
                      col.slice(1).replace(/([A-Z])/g, " $1")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.data.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="border-b border-gray-100 px-3 py-2"
                    >
                      {col === "expiresDate" || col === "addedAt"
                        ? new Date(row[col]).toLocaleDateString()
                        : row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.metadata && (
          <div className="mt-2 text-xs text-gray-500">
            {result.metadata.workbookName &&
              `Workbook: ${result.metadata.workbookName}`}
            {result.metadata.days && ` • Within ${result.metadata.days} days`}
          </div>
        )}
      </div>
    );
  }

  return <div className="mt-3 text-sm text-gray-500">No data available</div>;
}
