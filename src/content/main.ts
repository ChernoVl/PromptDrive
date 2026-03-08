import { BookmarkService } from "@content/bookmarks/bookmarkService";
import { ChatAdapter } from "@content/dom/chatAdapter";
import { MessageHighlighter } from "@content/highlight/highlighter";
import { NavigatorService } from "@content/navigation/navigator";
import { PromptDriveStore } from "@content/state/store";
import { ThemeBridge } from "@content/style/themeBridge";
import { StatsService } from "@content/stats/statsService";
import { TimelineService } from "@content/timeline/timelineService";
import { TimelineRail } from "@content/ui/timelineRail";
import { TopBar, type BookmarkListItem } from "@content/ui/topBar";
import type { ChatMessage, StepDirection } from "@shared/types";

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

function buildBookmarkListItems(bookmarks: ReturnType<BookmarkService["getForChat"]>, messages: ChatMessage[]): BookmarkListItem[] {
  return bookmarks.map((bookmark, index) => {
    const message = messages.find((item) => item.fingerprint === bookmark.messageFingerprint);
    const text =
      (bookmark.selectionText ?? message?.text ?? "Message").trim().replace(/\s+/g, " ");
    const preview = text.length > 62 ? `${text.slice(0, 62)}...` : text;
    return {
      id: bookmark.id,
      label: `${index + 1}. ${preview}`
    };
  });
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

  const jumpToBookmarkId = async (bookmarkId: string): Promise<void> => {
    const bookmark = bookmarkService.getForChat(currentChatId).find((item) => item.id === bookmarkId);
    if (!bookmark) {
      return;
    }

    const targetMessage = navigator
      .getAllMessages()
      .find((message) => message.fingerprint === bookmark.messageFingerprint);

    if (!targetMessage) {
      return;
    }

    await navigator.jumpToMessageById(targetMessage.domId, "combined", "");
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

      void bookmarkService
        .addMessageBookmark(currentChatId, message)
        .then(() => navigator.jumpToMessageById(message.domId, "combined", ""))
        .then(() => {
          store.setState({ boundaryHint: null });
          refreshDerivedState();
        });
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

      void bookmarkService
        .addSelectionBookmark(currentChatId, message, text)
        .then((created) => (created ? navigator.jumpToMessageById(message.domId, "combined", "") : null))
        .then(() => {
          store.setState({ boundaryHint: null });
          refreshDerivedState();
        });
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

      void navigator.jumpToMessageById(target.message.domId, "combined", "").then(() => {
        store.setState({ boundaryHint: null });
        refreshDerivedState();
      });
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

      void navigator.jumpToMessageById(target.message.domId, "combined", "").then(() => {
        store.setState({ boundaryHint: null });
        refreshDerivedState();
      });
    },
    onSelectBookmark: (bookmarkId) => {
      void jumpToBookmarkId(bookmarkId);
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
    timelineRail.setBoundaryHint(state.boundaryHint);

    const topRect = topBar.element.getBoundingClientRect();
    const composerTop = adapter.getComposerTopOffset();
    const topOffset = Math.max(topRect.bottom + 8, adapter.getHeaderBottomOffset() + 56);
    const bottomOffset = Math.max(12, window.innerHeight - composerTop + 12);
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const rightOffset = Math.max(24, scrollbarWidth + 24);
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
    const position = navigator.getPosition(current.mode, current.filterKeyword);
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
      stats
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

  window.addEventListener("resize", () => {
    topBar.syncLayout();
  });

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
    if (refreshTimer !== null) {
      window.clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  });
}

void bootstrap();
