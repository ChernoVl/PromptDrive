import { BookmarkService } from "@content/bookmarks/bookmarkService";
import { ChatAdapter } from "@content/dom/chatAdapter";
import { MessageHighlighter } from "@content/highlight/highlighter";
import { NavigatorService } from "@content/navigation/navigator";
import { PromptDriveStore } from "@content/state/store";
import { ThemeBridge } from "@content/style/themeBridge";
import { StatsService } from "@content/stats/statsService";
import { TimelineService } from "@content/timeline/timelineService";
import { StepDot } from "@content/ui/stepDot";
import { TimelineRail } from "@content/ui/timelineRail";
import { TopBar } from "@content/ui/topBar";
import type { StepDirection } from "@shared/types";

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
  let currentChatId = adapter.getChatId();
  const branchTransferDone = new Set<string>();
  const branchTransferInFlight = new Set<string>();

  await bookmarkService.load();

  const getCurrentMessage = (): ReturnType<NavigatorService["getAllMessages"]>[number] | null => {
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

  const getMessageForSelection = (): ReturnType<NavigatorService["getAllMessages"]>[number] | null => {
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

  const topBar = new TopBar(adapter, {
    onModeChange: (mode) => {
      store.setState({ mode });
      refreshDerivedState();
    },
    onDirectionChange: (direction) => store.setState({ direction }),
    onEdgeClickModeChange: (edgeClickMode) => store.setState({ edgeClickMode }),
    onFilterChange: (filterKeyword) => {
      store.setState({ filterKeyword });
      refreshDerivedState();
    },
    onToggleExpanded: () => {
      store.setState({ expanded: !store.getState().expanded });
    },
    onAddMessageBookmark: () => {
      const message = getCurrentMessage();
      if (!message) {
        return;
      }

      void bookmarkService.addMessageBookmark(currentChatId, message).then(() => {
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

      void bookmarkService.addSelectionBookmark(currentChatId, message, text).then((created) => {
        if (created) {
          refreshDerivedState();
        }
      });
    },
    onPrevBookmark: () => {
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
        refreshDerivedState();
      });
    },
    onNextBookmark: () => {
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
        refreshDerivedState();
      });
    }
  });

  const timelineRail = new TimelineRail({
    onLanePercentClick: async (lane, percentY) => {
      const state = store.getState();
      await navigator.jumpToPercent(lane, percentY, state.mode, state.filterKeyword);
      refreshDerivedState();
    },
    onMarkerClick: async (_, domId) => {
      const state = store.getState();
      await navigator.jumpToMessageById(domId, state.mode, state.filterKeyword);
      refreshDerivedState();
    }
  });

  const stepDot = new StepDot(adapter, {
    onStep: () => {
      const current = store.getState();
      void performStep(current.direction);
    },
    onFlipDirection: () => {
      const current = store.getState();
      store.setState({ direction: current.direction === "down" ? "up" : "down" });
      stepDot.update(store.getState().direction);
    }
  });

  store.subscribe((state) => {
    topBar.update(state);
    topBar.syncLayout();
    stepDot.update(state.direction);
    stepDot.syncLayout();

    const topRect = topBar.element.getBoundingClientRect();
    const composerTop = adapter.getComposerTopOffset();
    const topOffset = Math.max(topRect.bottom + 8, adapter.getHeaderBottomOffset() + 56);
    const bottomOffset = Math.max(12, window.innerHeight - composerTop + 12);
    timelineRail.syncLayout(topOffset, bottomOffset);
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

  const performStep = async (direction: StepDirection): Promise<void> => {
    const current = store.getState();
    await navigator.step(current.mode, direction, current.filterKeyword);
    store.setState({ direction });
    refreshDerivedState();
  };

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
    stepDot.syncLayout();
  });

  window.setInterval(() => {
    const messages = navigator.getAllMessages();
    store.setState({ stats: statsService.build(messages) });
    topBar.syncLayout();
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
