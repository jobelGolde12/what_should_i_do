"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import type { AnalysisResult } from "@/app/actions/analyzeText";
import type {
  AnalysisRecord,
  Template,
  BoardItem,
  BoardStatus,
} from "@/lib/types";
import { readStorage, writeStorage, storageKeys, uid } from "@/lib/storage";

type TaskContextValue = {
  history: AnalysisRecord[];
  templates: Template[];
  board: BoardItem[];
  saveAnalysis: (
    input: string,
    output: AnalysisResult
  ) => AnalysisRecord;
  deleteAnalysis: (id: string) => void;
  clearHistory: () => void;
  loadRecord: (id: string) => AnalysisRecord | null;
  saveTemplate: (name: string, content: string) => void;
  deleteTemplate: (id: string) => void;
  setItemStatus: (id: string, status: BoardStatus) => void;
  reorderItem: (
    sourceId: string,
    sourceIndex: number,
    targetStatus: BoardStatus
  ) => void;
};

const TaskContext = createContext<TaskContextValue | null>(null);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [board, setBoard] = useState<BoardItem[]>([]);

  useEffect(() => {
    // Reading from localStorage must happen post-hydration to keep the
    // server-rendered markup in sync; schedule the state read in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(
      readStorage<AnalysisRecord[]>(storageKeys().history, [])
    );
    setTemplates(
      readStorage<Template[]>(storageKeys().templates, [])
    );
    setBoard(readStorage<BoardItem[]>(storageKeys().board, []));
  }, []);

  useEffect(() => {
    writeStorage(storageKeys().history, history);
  }, [history]);

  useEffect(() => {
    writeStorage(storageKeys().templates, templates);
  }, [templates]);

  useEffect(() => {
    writeStorage(storageKeys().board, board);
  }, [board]);

  const saveAnalysis = useCallback(
    (input: string, output: AnalysisResult): AnalysisRecord => {
      const record: AnalysisRecord = {
        id: uid(),
        timestamp: Date.now(),
        input,
        output,
      };
      setHistory((prev) => [record, ...prev]);

      const newItems: BoardItem[] = output.actions.map((action, index) => ({
        id: `${record.id}:${index}`,
        sourceId: record.id,
        sourceIndex: index,
        text: action,
        urgency: output.urgency,
        status: "todo" as BoardStatus,
        createdAt: record.timestamp,
      }));
      setBoard((prev) => [...newItems, ...prev]);

      return record;
    },
    []
  );

  const deleteAnalysis = useCallback((id: string) => {
    setHistory((prev) => prev.filter((r) => r.id !== id));
    setBoard((prev) => prev.filter((item) => item.sourceId !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setBoard([]);
  }, []);

  const loadRecord = useCallback(
    (id: string) => history.find((r) => r.id === id) ?? null,
    [history]
  );

  const saveTemplate = useCallback((name: string, content: string) => {
    const trimmedName =
      name.trim() ||
      content.trim().slice(0, 40).replace(/\s+/g, " ").trim() ||
      "Untitled template";
    const template: Template = {
      id: uid(),
      name: trimmedName.slice(0, 60),
      content,
      createdAt: Date.now(),
    };
    setTemplates((prev) => [template, ...prev]);
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setItemStatus = useCallback((id: string, status: BoardStatus) => {
    setBoard((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );
  }, []);

  const reorderItem = useCallback(
    (sourceId: string, sourceIndex: number, targetStatus: BoardStatus) => {
      setBoard((prev) => {
        const item = prev.find(
          (i) => i.sourceId === sourceId && i.sourceIndex === sourceIndex
        );
        if (!item) return prev;
        return prev.map((i) =>
          i.id === item.id ? { ...i, status: targetStatus } : i
        );
      });
    },
    []
  );

  return (
    <TaskContext.Provider
      value={{
        history,
        templates,
        board,
        saveAnalysis,
        deleteAnalysis,
        clearHistory,
        loadRecord,
        saveTemplate,
        deleteTemplate,
        setItemStatus,
        reorderItem,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTask() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error("useTask must be used within TaskProvider");
  return ctx;
}
