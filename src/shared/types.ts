export type MessageRole = "user" | "assistant";

export type NavMode = "combined" | "user" | "assistant";

export type StepDirection = "down" | "up";

export type EdgeClickMode = "percentNearest" | "markersOnly";

export type TimelineLane = "user" | "assistant";

export type BookmarkKind = "message" | "textRange";

export interface ChatMessage {
  domId: string;
  role: MessageRole;
  text: string;
  timestamp?: string;
  fingerprint: string;
  element: HTMLElement;
}

export interface NavigationState {
  mode: NavMode;
  direction: StepDirection;
  currentIndex: number;
  total: number;
  filterKeyword: string;
}

export interface ChatStats {
  userMessageCount: number;
  userWordCount: number;
  firstMessageAt?: string;
  lastMessageAt?: string;
  idleSeconds?: number;
}

export interface Bookmark {
  id: string;
  chatId: string;
  kind: BookmarkKind;
  messageFingerprint: string;
  selectionText?: string;
  prefix?: string;
  suffix?: string;
  createdAt: number;
  sourceChatId?: string;
}

export interface UserSettings {
  defaultMode: NavMode;
  defaultDirection: StepDirection;
  edgeClickMode: EdgeClickMode;
  shortcutsEnabled: boolean;
  locale: string;
  uiCollapsed: boolean;
  autoTransferBookmarks: boolean;
}

export interface TimelineClickContext {
  lane: TimelineLane;
  percentY: number;
  edgeClickMode: EdgeClickMode;
}

export type TimelineMarkerKind = "section" | "bookmark";

export interface TimelineMarker {
  domId: string;
  lane: TimelineLane;
  percent: number;
  kind: TimelineMarkerKind;
  active: boolean;
}

export interface TimelineModel {
  user: TimelineMarker[];
  assistant: TimelineMarker[];
}

export interface NavigationResult {
  moved: boolean;
  reason?: "boundary" | "empty" | "not-found";
  currentIndex: number;
  total: number;
  message?: ChatMessage;
}
