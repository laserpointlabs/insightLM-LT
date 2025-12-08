import { create } from "zustand";
import { Workbook } from "../types";

interface WorkbookStore {
  workbooks: Workbook[];
  selectedWorkbookId: string | null;
  loading: boolean;
  error: string | null;

  setWorkbooks: (workbooks: Workbook[]) => void;
  addWorkbook: (workbook: Workbook) => void;
  updateWorkbook: (id: string, updates: Partial<Workbook>) => void;
  removeWorkbook: (id: string) => void;
  setSelectedWorkbookId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useWorkbookStore = create<WorkbookStore>((set) => ({
  workbooks: [],
  selectedWorkbookId: null,
  loading: false,
  error: null,

  setWorkbooks: (workbooks) => set({ workbooks }),
  addWorkbook: (workbook) =>
    set((state) => ({ workbooks: [...state.workbooks, workbook] })),
  updateWorkbook: (id, updates) =>
    set((state) => ({
      workbooks: state.workbooks.map((w) =>
        w.id === id ? { ...w, ...updates } : w,
      ),
    })),
  removeWorkbook: (id) =>
    set((state) => ({
      workbooks: state.workbooks.filter((w) => w.id !== id),
      selectedWorkbookId:
        state.selectedWorkbookId === id ? null : state.selectedWorkbookId,
    })),
  setSelectedWorkbookId: (id) => set({ selectedWorkbookId: id }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
