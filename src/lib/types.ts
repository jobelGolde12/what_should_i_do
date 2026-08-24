import type { AnalysisResult } from "@/app/actions/analyzeText";

export type UrgencyLevel = AnalysisResult["urgency"];

export type AnalysisRecord = {
  id: string;
  timestamp: number;
  input: string;
  output: AnalysisResult;
  sourceLabel?: string;
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

/** One persisted turn in an analysis chat topic (no UI-only fields). */
export type ChatTopicMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * A saved conversation about one analysis. The `context` snapshot keeps the
 * chat self-grounding so it can be restored on any device even if the
 * underlying analysis record isn't available locally.
 */
export type ChatTopic = {
  id: string;
  recordId: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
  context: {
    input: string;
    analysis: AnalysisResult;
  };
  messages: ChatTopicMessage[];
};

export type ThemePreference = "light" | "dark" | "system";

export type SharePayload = {
  timestamp: number;
  input: string;
  output: AnalysisResult;
  includeInput?: boolean;
  sensitive?: boolean;
};

// Navigation types
export type RouteParams = {
  id?: string;
  [key: string]: string | undefined;
};

export type RouteKey = 
  | "/"
  | "/analysis"
  | "/analysis/[id]"
  | "/analysis/[id]/chat"
  | "/history"
  | "/saved"
  | "/actions"
  | "/settings"
  | "/dashboard"
  | "/share/[id]"
  | "/auth/login"
  | "/auth/register"
  | "/privacy"
  | "/terms";

export type NavigationStateType = 
  | "idle"
  | "prefetching"
  | "loading_skeleton"
  | "data_resolving"
  | "ready"
  | "error"
  | "cancelled";

export interface NavigationState {
  currentRoute: RouteKey | null;
  currentParams: RouteParams | null;
  generation: number;
  state: NavigationStateType;
  targetRoute: RouteKey | null;
  targetParams: RouteParams | null;
  skeletonVisible: boolean;
  error: Error | null;
}

export interface NavigationGeneration {
  id: number;
  route: RouteKey;
  params: RouteParams | null;
  startTime: number;
  abortController: AbortController | null;
}
