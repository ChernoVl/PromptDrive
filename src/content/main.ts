import { ChatAdapter } from "@content/dom/chatAdapter";
import { MessageHighlighter } from "@content/highlight/highlighter";
import { NavigatorService } from "@content/navigation/navigator";
import { PromptDriveStore } from "@content/state/store";
import { ThemeBridge } from "@content/style/themeBridge";
import { StatsService } from "@content/stats/statsService";
import { TimelineService } from "@content/timeline/timelineService";
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
  const store = new PromptDriveStore();
  const themeBridge = new ThemeBridge();

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

  store.subscribe((state) => {
    topBar.update(state);
    topBar.syncLayout();

    const topRect = topBar.element.getBoundingClientRect();
    const composerTop = adapter.getComposerTopOffset();
    const topOffset = Math.max(topRect.bottom + 8, adapter.getHeaderBottomOffset() + 56);
    const bottomOffset = Math.max(12, window.innerHeight - composerTop + 12);
    timelineRail.syncLayout(topOffset, bottomOffset);
  });

  const themeObserver = themeBridge.observe();

  const refreshDerivedState = (): void => {
    const current = store.getState();
    const messages = navigator.refresh();
    const position = navigator.getPosition(current.mode, current.filterKeyword);
    const stats = statsService.build(messages);
    const timelineModel = timelineService.build(messages, [], navigator.getCurrentDomId());

    store.setState({
      currentIndex: position.currentIndex,
      total: position.total,
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
    refreshDerivedState();
  });

  observer.observe(document.body, { subtree: true, childList: true });

  window.addEventListener("resize", () => {
    topBar.syncLayout();
  });

  window.setInterval(() => {
    const messages = navigator.getAllMessages();
    store.setState({ stats: statsService.build(messages) });
    topBar.syncLayout();
  }, 30000);

  window.addEventListener("beforeunload", () => {
    observer.disconnect();
    themeObserver.disconnect();
  });
}

void bootstrap();
