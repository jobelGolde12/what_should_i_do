import type { AnalysisResult } from "@/app/actions/analyzeText";

export type UrgencyLevel = AnalysisResult["urgency"];

export type AnalysisRecord = {
  id: string;
  timestamp: number;
  input: string;
  output: AnalysisResult;
};

export type Template = {
  id: string;
  name: string;
  content: string;
  createdAt: number;
};

export type BoardStatus = "todo" | "in-progress" | "done";

export type BoardItem = {
  id: string;
  sourceId: string;
  sourceIndex: number;
  text: string;
  urgency: UrgencyLevel;
  status: BoardStatus;
  createdAt: number;
};

export type ThemePreference = "light" | "dark" | "system";

export type SharePayload = {
  timestamp: number;
  input: string;
  output: AnalysisResult;
  includeInput?: boolean;
  sensitive?: boolean;
};
