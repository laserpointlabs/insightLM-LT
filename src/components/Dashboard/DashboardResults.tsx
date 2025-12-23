import { DashboardResult } from "../../types/dashboard";
import ReactMarkdown from "react-markdown";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DashboardResultsProps {
  result: DashboardResult;
  tileSize?: "small" | "medium" | "large" | "full-width";
}

export function DashboardResults({ result, tileSize = "medium" }: DashboardResultsProps) {
  const isSmall = tileSize === "small";
  const isMedium = tileSize === "medium";
  const isCompact = isSmall || isMedium;

  // Error type
  if (result.type === "error" || result.error) {
    return (
      <div className={`rounded border border-red-200 bg-red-50 ${isCompact ? "p-2" : "p-3"}`}>
        <div className="text-sm font-semibold text-red-700">Error</div>
        <div className="mt-1 text-xs text-red-600 break-words">
          {result.error || "Unknown error occurred"}
        </div>
      </div>
    );
  }

  // Counter type
  if (result.type === "counter") {
    const valueClass = isSmall ? "text-2xl" : isMedium ? "text-3xl" : "text-4xl";
    return (
      <div className={`rounded border border-blue-200 bg-blue-50 ${isCompact ? "p-2" : "p-3"} h-full flex flex-col justify-center`}>
        <div className={`${valueClass} font-bold text-blue-600 leading-none truncate`}>
          {result.value ?? "—"}
        </div>
        {result.label && (
          <div className={`mt-1 font-medium text-blue-700 ${isSmall ? "text-xs" : "text-sm"} truncate`}>
            {result.label}
          </div>
        )}
        {result.subtitle && (
          <div className="mt-1 text-[11px] text-gray-600 truncate">{result.subtitle}</div>
        )}
      </div>
    );
  }

  // Counter with warning type
  if (result.type === "counter_warning") {
    const levelColors = {
      success: "border-green-200 bg-green-50 text-green-600",
      warning: "border-yellow-200 bg-yellow-50 text-yellow-700",
      danger: "border-red-200 bg-red-50 text-red-600",
    };
    const level = result.level || "success";
    const colorClasses = levelColors[level];

    return (
      <div className={`rounded border ${isCompact ? "p-2" : "p-3"} ${colorClasses} h-full flex flex-col justify-center`}>
        <div className="flex items-center justify-between gap-2">
          <div className={`${isSmall ? "text-2xl" : "text-3xl"} font-bold leading-none truncate`}>{result.value}</div>
          {!isSmall && level === "danger" && <span className="text-2xl">⚠️</span>}
          {!isSmall && level === "warning" && <span className="text-2xl">⚡</span>}
          {!isSmall && level === "success" && <span className="text-2xl">✅</span>}
        </div>
        {result.label && (
          <div className={`mt-1 font-medium ${isSmall ? "text-xs" : "text-sm"} truncate`}>{result.label}</div>
        )}
        {result.subtitle && (
          <div className="mt-1 text-xs opacity-80">{result.subtitle}</div>
        )}
        {result.items && result.items.length > 0 && !isSmall && (
          <div className="mt-2 text-xs opacity-90 max-h-24 overflow-auto pr-1">
            {result.items.slice(0, isMedium ? 3 : 5).map((item, idx) => (
              <div key={idx} className="truncate">• {item}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Date type
  if (result.type === "date") {
    const daysUntil = result.daysUntil || 0;
    const levelClass = daysUntil < 30 ? "border-red-200 bg-red-50 text-red-600" :
                       daysUntil < 90 ? "border-yellow-200 bg-yellow-50 text-yellow-700" :
                       "border-blue-200 bg-blue-50 text-blue-600";

    return (
      <div className={`rounded border ${isCompact ? "p-2" : "p-3"} ${levelClass} h-full flex flex-col justify-center`}>
        <div className={`${isSmall ? "text-lg" : "text-2xl"} font-bold truncate`}>
          {result.date ? new Date(result.date).toLocaleDateString() : "N/A"}
        </div>
        {result.label && (
          <div className={`mt-1 font-medium ${isSmall ? "text-xs" : "text-sm"} truncate`}>{result.label}</div>
        )}
        {result.daysUntil !== undefined && (
          <div className="mt-1 text-xs opacity-80">
            {result.daysUntil} days {result.daysUntil < 0 ? "overdue" : "remaining"}
          </div>
        )}
      </div>
    );
  }

  // Color/status type
  if (result.type === "color") {
    const colorClasses = {
      green: "border-green-300 bg-green-100",
      yellow: "border-yellow-300 bg-yellow-100",
      red: "border-red-300 bg-red-100",
    };
    const textColorClasses = {
      green: "text-green-700",
      yellow: "text-yellow-800",
      red: "text-red-700",
    };
    const color = result.color || "green";

    return (
      <div className={`rounded border-4 ${isCompact ? "p-2" : "p-3"} ${colorClasses[color]} h-full flex flex-col justify-center`}>
        <div className={`${isSmall ? "text-3xl" : "text-4xl"} font-bold text-center ${textColorClasses[color]}`}>
          {color === "green" && "✓"}
          {color === "yellow" && "⚠"}
          {color === "red" && "✗"}
        </div>
        {result.label && (
          <div className={`mt-2 ${isSmall ? "text-xs" : "text-sm"} font-bold text-center ${textColorClasses[color]} truncate`}>
            {result.label}
          </div>
        )}
        {result.message && (
          <div className={`mt-1 text-[11px] text-center ${textColorClasses[color]} truncate`}>
            {result.message}
          </div>
        )}
      </div>
    );
  }

  // Graph type (new JSON data format)
  if (result.type === "graph" && result.data) {
    // Validate data structure
    if (!result.data.labels || !result.data.values) {
      console.error("Invalid graph data:", result.data);
      return (
        <div className="mt-2 rounded border border-red-200 bg-red-50 p-3">
          <div className="text-sm font-semibold text-red-700">Invalid Graph Data</div>
          <div className="mt-1 text-xs text-red-600">
            Data must have 'labels' and 'values' arrays
          </div>
          <div className="mt-1 text-xs text-gray-600">
            Received: {JSON.stringify(result.data)}
          </div>
        </div>
      );
    }

    const { labels, values } = result.data;

    // Validate arrays
    if (!Array.isArray(labels) || !Array.isArray(values)) {
      console.error("Graph labels/values not arrays:", { labels, values });
      return (
        <div className="mt-2 rounded border border-red-200 bg-red-50 p-3">
          <div className="text-sm font-semibold text-red-700">Invalid Graph Data</div>
          <div className="mt-1 text-xs text-red-600">
            Labels and values must be arrays
          </div>
        </div>
      );
    }

    // Empty graphs should render a friendly placeholder (and not look "invisible").
    if (labels.length === 0 || values.length === 0) {
      return (
        <div
          className={`rounded border border-gray-200 bg-white ${isCompact ? "p-2" : "p-3"} h-full flex items-center justify-center`}
          data-graph-points="0"
          data-graph-chart-type={String(result.chartType || "bar")}
        >
          <div className="text-xs text-gray-500">No graph data</div>
        </div>
      );
    }

    const pointCount = Math.min(labels.length, values.length);

    const chartData = labels.map((label: string, idx: number) => ({
      name: label,
      value: values[idx],
    }));

    const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

    // Determine chart type (default to bar)
    const chartType = result.chartType || "bar";

    // Make charts fill the available tile content area.
    // For small/medium we keep a minimum height so axes/labels remain readable.
    const minHeight = isSmall ? 130 : isMedium ? 160 : 220;
    const containerStyle: React.CSSProperties = { height: isCompact ? `${minHeight}px` : "100%" };
    if (chartType === "pie") {
      return (
        <div
          className="rounded border border-gray-200 bg-white p-2 h-full"
          style={containerStyle}
          data-graph-points={String(pointCount)}
          data-graph-chart-type="pie"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="80%"
                label={!isSmall}
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              {!isSmall && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    } else if (chartType === "line") {
      return (
        <div
          className="rounded border border-gray-200 bg-white p-2 h-full"
          style={containerStyle}
          data-graph-points={String(pointCount)}
          data-graph-chart-type="line"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: isSmall ? 9 : 10 }} interval={isSmall ? 1 : 0} />
              <YAxis tick={{ fontSize: isSmall ? 9 : 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    } else {
      // Default to bar chart
      return (
        <div
          className="rounded border border-gray-200 bg-white p-2 h-full"
          style={containerStyle}
          data-graph-points={String(pointCount)}
          data-graph-chart-type="bar"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: isSmall ? 9 : 10 }} interval={isSmall ? 1 : 0} />
              <YAxis tick={{ fontSize: isSmall ? 9 : 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
  }

  // Legacy: Graph type (Plotly HTML - for backward compatibility)
  if (result.type === "graph" && result.html) {
    return (
      <div className="rounded border border-gray-200 bg-white h-full min-h-[140px]">
        <div
          className="p-2 h-full overflow-auto"
          dangerouslySetInnerHTML={{ __html: result.html }}
        />
      </div>
    );
  }

  // Table type (new format from MCP)
  if (result.type === "table" && result.rows && result.columns) {
    return (
      <div className="h-full flex flex-col">
        {result.totalRows !== undefined && (
          <div className="mb-1 text-xs font-semibold text-gray-700">
            Total: {result.totalRows}
          </div>
        )}
        <div className="overflow-auto rounded border border-gray-200 flex-1">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {result.columns.map((col) => (
                  <th
                    key={col}
                    className="border-b border-gray-200 px-3 py-2 text-left font-semibold"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {result.columns!.map((col) => (
                    <td
                      key={col}
                      className="border-b border-gray-100 px-3 py-2"
                    >
                      {row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Text type (Markdown or plain)
  if (result.type === "text" && result.content) {
    return (
      <div className={`rounded border border-gray-200 bg-white ${isCompact ? "p-2" : "p-3"} h-full overflow-hidden`}>
        {result.format === "markdown" ? (
          <div className={`prose ${isCompact ? "prose-xs" : "prose-sm"} max-w-none`}>
            <ReactMarkdown>{result.content}</ReactMarkdown>
          </div>
        ) : (
          <div className={`whitespace-pre-wrap ${isCompact ? "text-xs" : "text-sm"} text-gray-700`}>
            {result.content}
          </div>
        )}
      </div>
    );
  }

  // Legacy format support (for backward compatibility)
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
