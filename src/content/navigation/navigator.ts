import type {
  ChatMessage,
  NavMode,
  NavigationResult,
  StepDirection,
  TimelineLane
} from "@shared/types";
import { ChatAdapter } from "@content/dom/chatAdapter";
import { MessageHighlighter } from "@content/highlight/highlighter";

interface EffectiveListOptions {
  mode: NavMode;
  keywordFilter: string;
}

export class NavigatorService {
  private currentDomId: string | null = null;
  private cache: ChatMessage[] = [];

  constructor(
    private readonly adapter: ChatAdapter,
    private readonly highlighter: MessageHighlighter
  ) {}

  refresh(): ChatMessage[] {
    this.cache = this.adapter.collectMessages();
    return this.cache;
  }

  getAllMessages(): ChatMessage[] {
    if (this.cache.length === 0) {
      this.refresh();
    }

    return this.cache;
  }

  getCurrentDomId(): string | null {
    return this.currentDomId;
  }

  getPosition(mode: NavMode, keywordFilter: string): { currentIndex: number; total: number } {
    const messages = this.getEffectiveMessages({ mode, keywordFilter });
    if (messages.length === 0) {
      return { currentIndex: 0, total: 0 };
    }

    const activeIndex = this.findCurrentIndex(messages);
    return {
      currentIndex: activeIndex + 1,
      total: messages.length
    };
  }

  async step(mode: NavMode, direction: StepDirection, keywordFilter: string): Promise<NavigationResult> {
    const result = await this.stepInternal(mode, direction, keywordFilter, true);
    return result;
  }

  async jumpToPercent(
    lane: TimelineLane,
    percentY: number,
    mode: NavMode,
    keywordFilter: string
  ): Promise<NavigationResult> {
    this.refresh();
    const eligible = this.getLaneMessages(lane, mode, keywordFilter);

    if (eligible.length === 0) {
      return {
        moved: false,
        reason: "empty",
        currentIndex: 0,
        total: 0
      };
    }

    const boundedPercent = Math.min(1, Math.max(0, percentY));
    const targetIndex = Math.round((eligible.length - 1) * boundedPercent);
    const target = eligible[targetIndex];
    if (!target) {
      return {
        moved: false,
        reason: "not-found",
        currentIndex: this.findCurrentIndex(eligible) + 1,
        total: eligible.length
      };
    }

    return this.jumpToMessage(target, eligible);
  }

  async jumpToMessageById(
    domId: string,
    mode: NavMode,
    keywordFilter: string
  ): Promise<NavigationResult> {
    this.refresh();
    const eligible = this.getEffectiveMessages({ mode, keywordFilter });
    const target = eligible.find((message) => message.domId === domId);

    if (!target) {
      return {
        moved: false,
        reason: "not-found",
        currentIndex: this.findCurrentIndex(eligible) + 1,
        total: eligible.length
      };
    }

    return this.jumpToMessage(target, eligible);
  }

  private async stepInternal(
    mode: NavMode,
    direction: StepDirection,
    keywordFilter: string,
    canLoadHistory: boolean
  ): Promise<NavigationResult> {
    this.refresh();
    const eligible = this.getEffectiveMessages({ mode, keywordFilter });

    if (eligible.length === 0) {
      return {
        moved: false,
        reason: "empty",
        currentIndex: 0,
        total: 0
      };
    }

    const currentIndex = this.findCurrentIndex(eligible);
    const delta = direction === "down" ? 1 : -1;
    let targetIndex = currentIndex + delta;

    if (currentIndex < 0) {
      targetIndex = direction === "down" ? 0 : eligible.length - 1;
    }

    if (targetIndex < 0 || targetIndex >= eligible.length) {
      if (canLoadHistory) {
        const loaded = await this.adapter.tryLoadHistory(direction, 3);
        if (loaded) {
          return this.stepInternal(mode, direction, keywordFilter, false);
        }
      }

      return {
        moved: false,
        reason: "boundary",
        currentIndex: this.findCurrentIndex(eligible) + 1,
        total: eligible.length
      };
    }

    const target = eligible[targetIndex];
    if (!target) {
      return {
        moved: false,
        reason: "not-found",
        currentIndex: this.findCurrentIndex(eligible) + 1,
        total: eligible.length
      };
    }

    return this.jumpToMessage(target, eligible);
  }

  private jumpToMessage(target: ChatMessage, eligible: ChatMessage[]): NavigationResult {
    this.scrollTargetToCenter(target.element);
    this.highlighter.highlight(target.element, 1000);
    this.currentDomId = target.domId;

    return {
      moved: true,
      currentIndex: Math.max(0, eligible.findIndex((message) => message.domId === target.domId) + 1),
      total: eligible.length,
      message: target
    };
  }

  private scrollTargetToCenter(element: HTMLElement): void {
    const bounds = element.getBoundingClientRect();
    const scrollTop = window.scrollY + bounds.top - window.innerHeight / 2;
    window.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: "smooth"
    });
  }

  private getEffectiveMessages(options: EffectiveListOptions): ChatMessage[] {
    const normalizedKeyword = options.keywordFilter.trim().toLowerCase();
    const fromMode = this.getAllMessages().filter((message) => {
      if (options.mode === "combined") {
        return true;
      }

      if (options.mode === "user") {
        return message.role === "user";
      }

      return message.role === "assistant";
    });

    if (!normalizedKeyword) {
      return fromMode;
    }

    // Keyword filter is intentionally constrained to user messages.
    return fromMode.filter(
      (message) =>
        message.role === "user" &&
        message.text.toLowerCase().includes(normalizedKeyword)
    );
  }

  private getLaneMessages(
    lane: TimelineLane,
    mode: NavMode,
    keywordFilter: string
  ): ChatMessage[] {
    const modeMessages = this.getEffectiveMessages({ mode, keywordFilter });
    return modeMessages.filter((message) => message.role === lane);
  }

  private findCurrentIndex(messages: ChatMessage[]): number {
    if (!this.currentDomId) {
      return -1;
    }

    return messages.findIndex((message) => message.domId === this.currentDomId);
  }
}
