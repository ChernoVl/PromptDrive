import { BookmarkService, type BookmarkTarget } from "@content/bookmarks/bookmarkService";
import { ChatAdapter } from "@content/dom/chatAdapter";
import { MessageHighlighter } from "@content/highlight/highlighter";
import { NavigatorService } from "@content/navigation/navigator";
import { PromptDriveStore, type PromptDriveState } from "@content/state/store";
import { ThemeBridge } from "@content/style/themeBridge";
import { StatsService } from "@content/stats/statsService";
import { TimelineService } from "@content/timeline/timelineService";
import { TimelineRail } from "@content/ui/timelineRail";
import { TopBar, type BookmarkListItem } from "@content/ui/topBar";
import type { Bookmark, ChatMessage, StepDirection } from "@shared/types";

interface TextSegment {
  node: Text;
  start: number;
  end: number;
}

interface NormalizedTextMap {
  text: string;
  normalizedToRaw: number[];
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "TEXTAREA" ||
    (target.tagName === "INPUT" &&
      (target as HTMLInputElement).type !== "button" &&
      (target as HTMLInputElement).type !== "checkbox")
  );
}

function createRestoreButton(onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pd-unhide-btn";
  button.textContent = "Show PromptDrive";
  button.title = "Restore PromptDrive bars";
  button.hidden = true;
  button.addEventListener("click", onClick);
  document.body.append(button);
  return button;
}

function buildBookmarkListItems(
  bookmarks: ReturnType<BookmarkService["getForChat"]>,
  messages: ChatMessage[]
): BookmarkListItem[] {
  return bookmarks.map((bookmark, index) => {
    const message = messages.find((item) => item.fingerprint === bookmark.messageFingerprint);
    const text = (bookmark.selectionText ?? message?.text ?? "Message")
      .trim()
      .replace(/\s+/g, " ");
    const preview = text.length > 62 ? `${text.slice(0, 62)}...` : text;
    return {
      id: bookmark.id,
      label: `${index + 1}. ${preview}`
    };
  });
}

function getNaturalBoundaryDirection(currentIndex: number, total: number): StepDirection | null {
  if (total === 0 || currentIndex === 0) {
    return null;
  }

  if (currentIndex <= 1) {
    return "up";
  }

  if (currentIndex >= total) {
    return "down";
  }

  return null;
}

function getVisibleBoundaryDirection(state: PromptDriveState): StepDirection | null {
  return state.boundaryHint ?? getNaturalBoundaryDirection(state.currentIndex, state.total);
}

function normalizeForSearch(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function buildNormalizedMap(rawText: string): NormalizedTextMap {
  let normalized = "";
  const normalizedToRaw: number[] = [];
  let hasContent = false;
  let pendingSpaceRawIndex: number | null = null;

  for (let index = 0; index < rawText.length; index += 1) {
    const char = rawText[index];
    if (char === undefined) {
      continue;
    }

    if (/\s/.test(char)) {
      if (hasContent && pendingSpaceRawIndex === null) {
        pendingSpaceRawIndex = index;
      }
      continue;
    }

    if (pendingSpaceRawIndex !== null) {
      normalized += " ";
      normalizedToRaw.push(pendingSpaceRawIndex);
      pendingSpaceRawIndex = null;
    }

    normalized += char.toLowerCase();
    normalizedToRaw.push(index);
    hasContent = true;
  }

  return { text: normalized, normalizedToRaw };
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) {
    return 0;
  }

  let count = 0;
  let fromIndex = 0;

  while (fromIndex <= haystack.length) {
    const foundAt = haystack.indexOf(needle, fromIndex);
    if (foundAt < 0) {
      break;
    }
    count += 1;
    fromIndex = foundAt + Math.max(needle.length, 1);
  }

  return count;
}

function indexOfNth(haystack: string, needle: string, occurrence: number): number {
  if (!needle || occurrence < 0) {
    return -1;
  }

  let fromIndex = 0;
  let foundAt = -1;

  for (let cursor = 0; cursor <= occurrence; cursor += 1) {
    foundAt = haystack.indexOf(needle, fromIndex);
    if (foundAt < 0) {
      return -1;
    }
    fromIndex = foundAt + Math.max(needle.length, 1);
  }

  return foundAt;
}

function collectVisibleTextSegments(root: HTMLElement): { rawText: string; segments: TextSegment[] } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node): number {
      const textNode = node as Text;
      const value = textNode.nodeValue ?? "";
      if (!value.trim()) {
        return NodeFilter.FILTER_REJECT;
      }

      const parent = textNode.parentElement;
      if (!parent) {
        return NodeFilter.FILTER_REJECT;
      }

      if (parent.closest("script, style, .sr-only, [aria-hidden='true']")) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let rawText = "";
  const segments: TextSegment[] = [];
  let currentNode = walker.nextNode();

  while (currentNode) {
    const textNode = currentNode as Text;
    const value = textNode.nodeValue ?? "";
    const start = rawText.length;
    rawText += value;
    segments.push({ node: textNode, start, end: rawText.length });
    currentNode = walker.nextNode();
  }

  return { rawText, segments };
}

function resolveNodeOffset(
  segments: TextSegment[],
  rawIndex: number,
  preferEnd: boolean
): { node: Text; offset: number } | null {
  if (segments.length === 0) {
    return null;
  }

  for (const segment of segments) {
    if (rawIndex < segment.start) {
      return {
        node: segment.node,
        offset: 0
      };
    }

    const length = segment.node.nodeValue?.length ?? 0;
    const withinSegment = rawIndex >= segment.start && rawIndex < segment.end;
    const atSegmentEnd = preferEnd && rawIndex === segment.end;

    if (withinSegment || atSegmentEnd) {
      return {
        node: segment.node,
        offset: Math.max(0, Math.min(length, rawIndex - segment.start))
      };
    }
  }

  const last = segments[segments.length - 1];
  if (!last) {
    return null;
  }

  return {
    node: last.node,
    offset: last.node.nodeValue?.length ?? 0
  };
}

function createSelectionRange(
  messageElement: HTMLElement,
  selectionText: string,
  preferredOccurrence: number
): Range | null {
  const normalizedSelection = normalizeForSearch(selectionText);
  if (!normalizedSelection) {
    return null;
  }

  const { rawText, segments } = collectVisibleTextSegments(messageElement);
  if (!rawText || segments.length === 0) {
    return null;
  }

  const normalizedMessage = buildNormalizedMap(rawText);
  if (!normalizedMessage.text) {
    return null;
  }

  let normalizedStart = indexOfNth(
    normalizedMessage.text,
    normalizedSelection,
    Math.max(0, preferredOccurrence)
  );
  if (normalizedStart < 0) {
    normalizedStart = normalizedMessage.text.indexOf(normalizedSelection);
  }

  if (normalizedStart < 0) {
    return null;
  }

  const normalizedEnd = normalizedStart + normalizedSelection.length - 1;
  const rawStart = normalizedMessage.normalizedToRaw[normalizedStart];
  const rawEnd = normalizedMessage.normalizedToRaw[normalizedEnd];

  if (rawStart === undefined || rawEnd === undefined) {
    return null;
  }

  const startPoint = resolveNodeOffset(segments, rawStart, false);
  const endPoint = resolveNodeOffset(segments, rawEnd + 1, true);
  if (!startPoint || !endPoint) {
    return null;
  }

  const range = document.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  return range;
}

function findScrollableAncestor(element: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = element.parentElement;

  while (node) {
    const style = getComputedStyle(node);
    const overflowY = style.overflowY.toLowerCase();
    const isScrollable =
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight + 4;
    if (isScrollable) {
      return node;
    }
    node = node.parentElement;
  }

  return null;
}

function scrollRectToCenter(range: Range, contextElement: HTMLElement): void {
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
  if (!rect || rect.height === 0) {
    return;
  }

  const scrollContainer = findScrollableAncestor(contextElement);
  if (scrollContainer) {
    const containerRect = scrollContainer.getBoundingClientRect();
    const offsetWithinContainer = rect.top - containerRect.top;
    const desiredTop =
      scrollContainer.scrollTop + offsetWithinContainer - scrollContainer.clientHeight / 2;

    scrollContainer.scrollTo({
      top: Math.max(0, desiredTop),
      behavior: "smooth"
    });
    return;
  }

  const desiredWindowTop = window.scrollY + rect.top - window.innerHeight / 2;
  window.scrollTo({ top: Math.max(0, desiredWindowTop), behavior: "smooth" });
}

function resolveBookmarkOccurrence(
  bookmarkService: BookmarkService,
  message: ChatMessage,
  bookmark: Bookmark
): number {
  if (bookmark.kind !== "textRange" || !bookmark.selectionText) {
    return 0;
  }

  const resolved = bookmarkService.resolveSelectionBookmarkRange(message.text, bookmark);
  if (!resolved) {
    return 0;
  }

  const normalizedSelection = normalizeForSearch(bookmark.selectionText);
  if (!normalizedSelection) {
    return 0;
  }

  const normalizedBefore = normalizeForSearch(message.text.slice(0, resolved.start));
  return countOccurrences(normalizedBefore, normalizedSelection);
}

async function bootstrap(): Promise<void> {
  if (!location.hostname.includes("chatgpt.com")) {
    return;
  }

  const adapter = new ChatAdapter();
  const highlighter = new MessageHighlighter();
  const navigator = new NavigatorService(adapter, highlighter);
  const statsService = new StatsService();
  const timelineService = new TimelineService();
  const bookmarkService = new BookmarkService();
  const store = new PromptDriveStore();
  const themeBridge = new ThemeBridge();
  const restoreButton = createRestoreButton(() => store.setState({ uiHidden: false }));
  let currentChatId = adapter.getChatId();
  const branchTransferDone = new Set<string>();
  const branchTransferInFlight = new Set<string>();

  await bookmarkService.load();

  const getCurrentMessage = (): ChatMessage | null => {
    const currentDomId = navigator.getCurrentDomId();
    const messages = navigator.getAllMessages();
    if (currentDomId) {
      const matched = messages.find((message) => message.domId === currentDomId);
      if (matched) {
        return matched;
      }
    }

    return messages[messages.length - 1] ?? null;
  };

  const getMessageForSelection = (): ChatMessage | null => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return null;
    }

    const anchorNode = selection.anchorNode;
    if (!anchorNode) {
      return null;
    }

    const anchorElement =
      anchorNode instanceof HTMLElement ? anchorNode : anchorNode.parentElement;
    if (!anchorElement) {
      return null;
    }

    const messages = navigator.getAllMessages();
    const directContainer = anchorElement.closest<HTMLElement>("[id^='pd-msg-']");
    if (directContainer?.id) {
      return messages.find((message) => message.domId === directContainer.id) ?? null;
    }

    return messages.find((message) => message.element.contains(anchorElement)) ?? null;
  };

  const resolveBookmarkTargetById = (bookmarkId: string): BookmarkTarget | null => {
    const bookmark = bookmarkService
      .getForChat(currentChatId)
      .find((item) => item.id === bookmarkId);
    if (!bookmark) {
      return null;
    }

    const messages = navigator.getAllMessages();
    const index = messages.findIndex(
      (message) => message.fingerprint === bookmark.messageFingerprint
    );
    if (index < 0) {
      return null;
    }

    const message = messages[index];
    if (!message) {
      return null;
    }

    return { bookmark, message, index };
  };

  const jumpToBookmarkTarget = async (target: BookmarkTarget): Promise<void> => {
    await navigator.jumpToMessageById(target.message.domId, "combined", "");

    if (target.bookmark.kind === "textRange" && target.bookmark.selectionText) {
      const occurrence = resolveBookmarkOccurrence(bookmarkService, target.message, target.bookmark);
      const range = createSelectionRange(
        target.message.element,
        target.bookmark.selectionText,
        occurrence
      );
      if (range) {
        scrollRectToCenter(range, target.message.element);
      }
    }

    store.setState({ boundaryHint: null });
    refreshDerivedState();
  };

  const performStep = async (
    direction: StepDirection,
    modeOverride?: "combined" | "user" | "assistant",
    ignoreFilter = false
  ): Promise<void> => {
    const current = store.getState();
    const mode = modeOverride ?? current.mode;
    const keywordFilter = ignoreFilter ? "" : current.filterKeyword;
    navigator.syncCurrentToViewport(mode, keywordFilter);
    const result = await navigator.step(mode, direction, keywordFilter);

    if (result.moved) {
      store.setState({ direction, boundaryHint: null });
      refreshDerivedState();
      return;
    }

    if (result.reason === "boundary") {
      if (current.boundaryHint === direction) {
        await navigator.jumpToBoundary(mode, keywordFilter, direction);
        store.setState({ direction, boundaryHint: null });
        refreshDerivedState();
      } else {
        store.setState({ boundaryHint: direction });
      }
      return;
    }

    store.setState({ boundaryHint: null });
    refreshDerivedState();
  };

  const topBar = new TopBar(adapter, {
    onModeChange: (mode) => {
      store.setState({ mode });
      refreshDerivedState();
    },
    onEdgeClickModeChange: (edgeClickMode) => {
      store.setState({ edgeClickMode });
      refreshDerivedState();
    },
    onStepUp: () => {
      void performStep("up");
    },
    onStepDown: () => {
      void performStep("down");
    },
    onDirectStep: (mode, direction) => {
      void performStep(direction, mode, true);
    },
    onFilterChange: (filterKeyword) => {
      store.setState({ filterKeyword });
      refreshDerivedState();
    },
    onToggleExpanded: () => {
      store.setState({ expanded: !store.getState().expanded });
    },
    onToggleUiHidden: () => {
      store.setState({ uiHidden: !store.getState().uiHidden });
    },
    onAddMessageBookmark: () => {
      const message = getCurrentMessage();
      if (!message) {
        return;
      }

      void (async () => {
        await bookmarkService.addMessageBookmark(currentChatId, message);
        await navigator.jumpToMessageById(message.domId, "combined", "");
        store.setState({ boundaryHint: null });
        refreshDerivedState();
      })();
    },
    onAddSelectionBookmark: () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";
      if (!text) {
        return;
      }

      const message = getMessageForSelection();
      if (!message) {
        return;
      }

      void (async () => {
        const created = await bookmarkService.addSelectionBookmark(currentChatId, message, text);
        if (!created) {
          return;
        }
        const index = navigator
          .getAllMessages()
          .findIndex((item) => item.fingerprint === message.fingerprint);
        await jumpToBookmarkTarget({
          bookmark: created,
          message,
          index: Math.max(0, index)
        });
      })();
    },
    onPrevBookmark: () => {
      navigator.syncCurrentToViewport("combined", "");
      const target = bookmarkService.getNextBookmarkTarget(
        currentChatId,
        navigator.getCurrentDomId(),
        navigator.getAllMessages(),
        "up"
      );

      if (!target) {
        return;
      }

      void jumpToBookmarkTarget(target);
    },
    onNextBookmark: () => {
      navigator.syncCurrentToViewport("combined", "");
      const target = bookmarkService.getNextBookmarkTarget(
        currentChatId,
        navigator.getCurrentDomId(),
        navigator.getAllMessages(),
        "down"
      );

      if (!target) {
        return;
      }

      void jumpToBookmarkTarget(target);
    },
    onSelectBookmark: (bookmarkId) => {
      const target = resolveBookmarkTargetById(bookmarkId);
      if (!target) {
        return;
      }
      void jumpToBookmarkTarget(target);
    },
    onDeleteBookmark: (bookmarkId) => {
      void bookmarkService.removeBookmark(bookmarkId).then(() => {
        refreshDerivedState();
      });
    }
  });

  const timelineRail = new TimelineRail({
    onTrackPercentClick: async (percentY) => {
      const state = store.getState();
      await navigator.jumpToCombinedPercent(percentY, state.mode, state.filterKeyword);
      store.setState({ boundaryHint: null });
      refreshDerivedState();
    },
    onMarkerClick: async (domId) => {
      await navigator.jumpToMessageById(domId, "combined", "");
      store.setState({ boundaryHint: null });
      refreshDerivedState();
    },
    onModeStepUp: () => {
      void performStep("up");
    },
    onModeStepDown: () => {
      void performStep("down");
    }
  });

  store.subscribe((state) => {
    const hidden = state.uiHidden;
    topBar.element.style.display = hidden ? "none" : "";
    timelineRail.setHidden(hidden);
    restoreButton.hidden = !hidden;
    if (hidden) {
      return;
    }

    topBar.update(state);
    topBar.syncLayout();
    timelineRail.setBoundaryHint(getVisibleBoundaryDirection(state));

    const topRect = topBar.element.getBoundingClientRect();
    const composerTop = adapter.getComposerTopOffset();
    const topOffset = Math.max(topRect.bottom + 8, adapter.getHeaderBottomOffset() + 56);
    const bottomOffset = Math.max(12, window.innerHeight - composerTop + 12);
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const rightOffset = Math.max(56, scrollbarWidth + 42);
    timelineRail.syncLayout(topOffset, bottomOffset, rightOffset);
  });

  const themeObserver = themeBridge.observe();
  let refreshTimer: number | null = null;

  const scheduleRefresh = (delayMs = 90): void => {
    if (refreshTimer !== null) {
      return;
    }

    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;
      refreshDerivedState();
    }, delayMs);
  };

  const refreshDerivedState = (): void => {
    const resolvedChatId = adapter.getChatId();
    if (resolvedChatId !== currentChatId) {
      currentChatId = resolvedChatId;
    }

    const current = store.getState();
    const messages = navigator.refresh();
    const chatBookmarks = bookmarkService.getForChat(currentChatId);
    navigator.syncCurrentToViewport(current.mode, current.filterKeyword);
    const position = navigator.getPosition(current.mode, current.filterKeyword);
    const naturalBoundary = getNaturalBoundaryDirection(position.currentIndex, position.total);
    const stats = statsService.build(messages);
    const timelineModel = timelineService.build(messages, chatBookmarks, navigator.getCurrentDomId());
    topBar.setBookmarkItems(buildBookmarkListItems(chatBookmarks, messages));

    if (!branchTransferDone.has(currentChatId) && !branchTransferInFlight.has(currentChatId)) {
      branchTransferInFlight.add(currentChatId);
      void bookmarkService.transferBranchBookmarks(currentChatId, messages).then((transferCount) => {
        branchTransferInFlight.delete(currentChatId);
        branchTransferDone.add(currentChatId);
        if (transferCount > 0) {
          scheduleRefresh(0);
        }
      });
    }

    store.setState({
      currentIndex: position.currentIndex,
      total: position.total,
      bookmarkCount: chatBookmarks.length,
      stats,
      boundaryHint:
        current.boundaryHint !== null && naturalBoundary === current.boundaryHint
          ? current.boundaryHint
          : null
    });

    timelineRail.update(timelineModel, current.edgeClickMode);
  };

  refreshDerivedState();

  window.addEventListener("keydown", async (event) => {
    const state = store.getState();
    if (!state.shortcutsEnabled || !event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    if (event.key.toLowerCase() === "j") {
      event.preventDefault();
      await performStep("down");
      return;
    }

    if (event.key.toLowerCase() === "k") {
      event.preventDefault();
      await performStep("up");
      return;
    }

    if (event.key.toLowerCase() === "h") {
      event.preventDefault();
      store.setState({ uiHidden: !store.getState().uiHidden });
      return;
    }

    if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      const nextMode =
        state.mode === "combined" ? "user" : state.mode === "user" ? "assistant" : "combined";
      store.setState({ mode: nextMode });
      refreshDerivedState();
    }

    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      store.setState({ filterKeyword: "" });
      refreshDerivedState();
    }
  });

  const observer = new MutationObserver(() => {
    scheduleRefresh();
  });

  observer.observe(document.body, { subtree: true, childList: true });

  const onAnyScroll = (): void => {
    scheduleRefresh(30);
  };
  document.addEventListener("scroll", onAnyScroll, true);

  const onResize = (): void => {
    topBar.syncLayout();
    scheduleRefresh(0);
  };
  window.addEventListener("resize", onResize);

  window.setInterval(() => {
    const messages = navigator.getAllMessages();
    store.setState({ stats: statsService.build(messages) });
    if (!store.getState().uiHidden) {
      topBar.syncLayout();
    }
  }, 30000);

  window.addEventListener("beforeunload", () => {
    observer.disconnect();
    themeObserver.disconnect();
    document.removeEventListener("scroll", onAnyScroll, true);
    window.removeEventListener("resize", onResize);
    if (refreshTimer !== null) {
      window.clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  });
}

void bootstrap();
