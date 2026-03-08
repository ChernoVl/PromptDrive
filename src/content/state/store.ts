import type { ChatStats, EdgeClickMode, NavMode, StepDirection } from "@shared/types";

export interface PromptDriveState {
  mode: NavMode;
  direction: StepDirection;
  edgeClickMode: EdgeClickMode;
  filterKeyword: string;
  currentIndex: number;
  total: number;
  shortcutsEnabled: boolean;
  expanded: boolean;
  stats: ChatStats;
}

export const DEFAULT_STATS: ChatStats = {
  userMessageCount: 0,
  userWordCount: 0
};

export const DEFAULT_STATE: PromptDriveState = {
  mode: "combined",
  direction: "down",
  edgeClickMode: "percentNearest",
  filterKeyword: "",
  currentIndex: 0,
  total: 0,
  shortcutsEnabled: true,
  expanded: false,
  stats: DEFAULT_STATS
};

type StoreListener = (state: PromptDriveState) => void;

export class PromptDriveStore {
  private state: PromptDriveState;
  private readonly listeners = new Set<StoreListener>();

  constructor(initialState: PromptDriveState = DEFAULT_STATE) {
    this.state = initialState;
  }

  getState(): PromptDriveState {
    return this.state;
  }

  setState(nextState: Partial<PromptDriveState>): void {
    this.state = {
      ...this.state,
      ...nextState
    };

    this.listeners.forEach((listener) => listener(this.state));
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }
}
