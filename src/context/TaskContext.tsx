"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import type { ReactNode } from "react";
import type { AnalysisResult } from "@/app/actions/analyzeText";
import type {
  AnalysisRecord,
  Template,
  BoardItem,
  BoardStatus,
  ChatTopic,
} from "@/lib/types";
import { readStorage, writeStorage, storageKeys, uid } from "@/lib/storage";
import { urgencyForAction } from "@/lib/urgency";
import { getDataCacheStore } from "@/lib/data-cache";
import { isInstantNavEnabled } from "@/lib/features";

type TaskContextValue = {
  history: AnalysisRecord[];
  templates: Template[];
  board: BoardItem[];
  chats: ChatTopic[];
  /** Upserts a chat topic (matched by id) into the local chats slice. */
  saveChatTopic: (topic: ChatTopic) => void;
  /** Removes every chat topic for an analysis record. */
  deleteChats: (recordId: string) => void;
  saveAnalysis: (
    input: string,
    output: AnalysisResult,
    sourceLabel?: string
  ) => AnalysisRecord;
  deleteAnalysis: (id: string) => void;
  clearHistory: () => void;
  clearBoard: () => void;
  clearTemplates: () => void;
  importHistory: (records: AnalysisRecord[]) => void;
  importTemplates: (templates: Template[]) => void;
  importBoard: (items: BoardItem[]) => void;
  setAll: (next: {
    history: AnalysisRecord[];
    templates: Template[];
    board: BoardItem[];
  }) => void;
  loadRecord: (id: string) => AnalysisRecord | null;
  saveTemplate: (name: string, content: string) => void;
  deleteTemplate: (id: string) => void;
  updateTemplate: (
    id: string,
    updates: { name?: string; content?: string }
  ) => void;
  duplicateTemplate: (id: string) => void;
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
  const [chats, setChats] = useState<ChatTopic[]>([]);

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
    setChats(readStorage<ChatTopic[]>(storageKeys().chats, []));
  }, []);

  // Track the last-persisted slices so a save that touches two slices (e.g.
  // `saveAnalysis` updates history AND board) does a single localStorage write
  // round + one cache sync instead of one effect per slice (which re-parsed the
  // whole snapshot for each).
  const prevPersisted = useRef({ history, templates, board, chats });

  useEffect(() => {
    const prev = prevPersisted.current;
    const next = { history, templates, board, chats };
    let changed = false;
    if (prev.history !== history) {
      writeStorage(storageKeys().history, history);
      changed = true;
    }
    if (prev.templates !== templates) {
      writeStorage(storageKeys().templates, templates);
      changed = true;
    }
    if (prev.board !== board) {
      writeStorage(storageKeys().board, board);
      changed = true;
    }
    if (prev.chats !== chats) {
      writeStorage(storageKeys().chats, chats);
      changed = true;
    }
    prevPersisted.current = next;
    if (changed && isInstantNavEnabled()) {
      getDataCacheStore().syncFromStorage();
    }
  }, [history, templates, board, chats]);

  const saveAnalysis = useCallback(
    (input: string, output: AnalysisResult, sourceLabel?: string): AnalysisRecord => {
      const record: AnalysisRecord = {
        id: uid(),
        timestamp: Date.now(),
        input,
        output,
        ...(sourceLabel ? { sourceLabel } : {}),
      };
      setHistory((prev) => [record, ...prev]);

      const newItems: BoardItem[] = output.actions.map((action, index) => ({
        id: `${record.id}:${index}`,
        sourceId: record.id,
        sourceIndex: index,
        text: action,
        urgency: urgencyForAction(action),
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
    // Chat topics are per-analysis; drop them with the analysis.
    setChats((prev) => prev.filter((c) => c.recordId !== id));
  }, []);

  const saveChatTopic = useCallback((topic: ChatTopic) => {
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === topic.id);
      if (idx < 0) return [topic, ...prev];
      const out = [...prev];
      out[idx] = topic;
      return out;
    });
  }, []);

  const deleteChats = useCallback((recordId: string) => {
    setChats((prev) => prev.filter((c) => c.recordId !== recordId));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setBoard([]);
  }, []);

  const clearBoard = useCallback(() => {
    setBoard([]);
  }, []);

  const clearTemplates = useCallback(() => {
    setTemplates([]);
  }, []);

  const importHistory = useCallback((records: AnalysisRecord[]) => {
    setHistory((prev) => {
      const existing = new Set(prev.map((r) => r.id));
      const fresh = records.filter((r) => !existing.has(r.id));
      return [...fresh, ...prev];
    });
    setBoard((prev) => {
      const existing = new Set(prev.map((i) => i.id));
      const freshItems = records.flatMap((record) =>
        record.output.actions.map((action, index) => ({
          id: `${record.id}:${index}`,
          sourceId: record.id,
          sourceIndex: index,
          text: action,
          urgency: urgencyForAction(action),
          status: "todo" as BoardStatus,
          createdAt: record.timestamp,
        }))
      );
      return [...freshItems.filter((i) => !existing.has(i.id)), ...prev];
    });
  }, []);

  const importTemplates = useCallback((incoming: Template[]) => {
    setTemplates((prev) => {
      const existing = new Set(prev.map((t) => t.id));
      const fresh = incoming.filter((t) => !existing.has(t.id));
      return [...fresh, ...prev];
    });
  }, []);

  const importBoard = useCallback((items: BoardItem[]) => {
    setBoard((prev) => {
      const existing = new Set(prev.map((i) => i.id));
      const fresh = items.filter((i) => !existing.has(i.id));
      return [...fresh, ...prev];
    });
  }, []);

  const setAll = useCallback(
    (next: {
      history: AnalysisRecord[];
      templates: Template[];
      board: BoardItem[];
    }) => {
      setHistory(next.history);
      setTemplates(next.templates);
      setBoard(next.board);
    },
    []
  );

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

  const updateTemplate = useCallback(
    (id: string, updates: { name?: string; content?: string }) => {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        )
      );
    },
    []
  );

  const duplicateTemplate = useCallback((id: string) => {
    setTemplates((prev) => {
      const source = prev.find((t) => t.id === id);
      if (!source) return prev;
      const copy: Template = {
        id: uid(),
        name: `${source.name} (copy)`,
        content: source.content,
        createdAt: Date.now(),
      };
      return [copy, ...prev];
    });
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
        chats,
        saveChatTopic,
        deleteChats,
        saveAnalysis,
        deleteAnalysis,
        clearHistory,
        clearBoard,
        clearTemplates,
        importHistory,
        importTemplates,
        importBoard,
        setAll,
        loadRecord,
        saveTemplate,
        deleteTemplate,
        updateTemplate,
        duplicateTemplate,
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

/** Like `useTask` but returns `null` outside a TaskProvider — for components
 *  that render on public pages (e.g. shared analyses) where task data doesn't
 *  exist and must not throw. */
export function useOptionalTask(): TaskContextValue | null {
  return useContext(TaskContext);
}
