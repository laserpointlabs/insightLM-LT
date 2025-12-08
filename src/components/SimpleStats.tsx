import { useEffect, useState } from "react";
import { useWorkbookStore } from "../store/workbookStore";

export function SimpleStats() {
  const { workbooks } = useWorkbookStore();
  const [stats, setStats] = useState({ totalWorkbooks: 0, totalDocuments: 0 });

  useEffect(() => {
    const totalWorkbooks = workbooks.filter((w) => !w.archived).length;
    const totalDocuments = workbooks
      .filter((w) => !w.archived)
      .reduce(
        (sum, w) => sum + w.documents.filter((d) => !d.archived).length,
        0,
      );

    setStats({ totalWorkbooks, totalDocuments });
  }, [workbooks]);

  return (
    <div className="border-t border-gray-200 p-2 text-xs text-gray-600">
      <div className="flex justify-between">
        <span>Workbooks:</span>
        <span className="font-semibold">{stats.totalWorkbooks}</span>
      </div>
      <div className="flex justify-between">
        <span>Documents:</span>
        <span className="font-semibold">{stats.totalDocuments}</span>
      </div>
    </div>
  );
}
