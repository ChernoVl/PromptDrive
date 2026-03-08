import { ChatAdapter } from "@content/dom/chatAdapter";
import type { PromptDriveState } from "@content/state/store";
import type { EdgeClickMode, NavMode, StepDirection } from "@shared/types";

export interface BookmarkListItem {
  id: string;
  label: string;
}

interface TopBarHandlers {
  onModeChange: (mode: NavMode) => void;
  onEdgeClickModeChange: (mode: EdgeClickMode) => void;
  onStepUp: () => void;
  onStepDown: () => void;
  onDirectStep: (mode: NavMode, direction: StepDirection) => void;
  onFilterChange: (keyword: string) => void;
  onToggleExpanded: () => void;
  onToggleUiHidden: () => void;
  onAddMessageBookmark: () => void;
  onAddSelectionBookmark: () => void;
  onPrevBookmark: () => void;
  onNextBookmark: () => void;
  onClearBookmarks: () => void;
  onSelectBookmark: (bookmarkId: string) => void;
  onDeleteBookmark: (bookmarkId: string) => void;
}

function formatTime(value: string | undefined): string {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "n/a";
  }

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatIdleSeconds(value: number | undefined): string {
  if (value === undefined) {
    return "n/a";
  }

  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

const NA_TIME_HINT = "n/a means the page did not expose a usable message timestamp yet.";

export class TopBar {
  readonly element: HTMLElement;
  private readonly spacer: HTMLElement;

  private readonly modeSelect: HTMLSelectElement;
  private readonly edgeModeSelect: HTMLSelectElement;
  private readonly stepUpButton: HTMLButtonElement;
  private readonly stepDownButton: HTMLButtonElement;
  private readonly filterInput: HTMLInputElement;
  private readonly positionLabel: HTMLElement;
  private readonly statsUserMessages: HTMLElement;
  private readonly statsUserWords: HTMLElement;
  private readonly statsFirst: HTMLElement;
  private readonly statsLast: HTMLElement;
  private readonly statsIdle: HTMLElement;
  private readonly statsBookmarks: HTMLElement;
  private readonly chipFirst: HTMLElement;
  private readonly chipLast: HTMLElement;
  private readonly chipIdle: HTMLElement;
  private readonly addBookmarkButton: HTMLButtonElement;
  private readonly addSelectionButton: HTMLButtonElement;
  private readonly prevBookmarkButton: HTMLButtonElement;
  private readonly nextBookmarkButton: HTMLButtonElement;
  private readonly bookmarksListButton: HTMLButtonElement;
  private readonly clearBookmarksButton: HTMLButtonElement;
  private readonly bookmarkListContainer: HTMLElement;
  private readonly hideUiButton: HTMLButtonElement;
  private readonly expandButton: HTMLButtonElement;
  private readonly advancedRow: HTMLElement;
  private readonly quickNavButtons: NodeListOf<HTMLButtonElement>;
  private bookmarkListOpen = false;

  constructor(private readonly adapter: ChatAdapter, handlers: TopBarHandlers) {
    const root = document.createElement("section");
    root.className = "pd-topbar";
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "PromptDrive controls");

    root.innerHTML = `
      <div class="pd-topbar-main">
        <div class="pd-brand">
          PromptDrive
          <a class="pd-brand-link" href="https://github.com/ChernoVl/PromptDrive" target="_blank" rel="noreferrer" title="Open GitHub repo">repo</a>
        </div>
        <label class="pd-field" title="Which messages arrows and percent-jump should use">
          <span class="pd-label">Mode</span>
          <select data-id="mode">
            <option value="combined">Combined</option>
            <option value="user">You</option>
            <option value="assistant">Assistant</option>
          </select>
        </label>
        <label class="pd-field" title="Percent Jump: click anywhere on timeline to jump by relative chat position. Markers Only: only marker clicks jump.">
          <span class="pd-label">Edge</span>
          <select data-id="edge">
            <option value="percentNearest">Percent Jump</option>
            <option value="markersOnly">Markers Only</option>
          </select>
        </label>
        <div class="pd-step-controls" title="Navigate in current mode">
          <button type="button" class="pd-step-btn" data-id="step-up" aria-label="Previous in current mode">^</button>
          <button type="button" class="pd-step-btn" data-id="step-down" aria-label="Next in current mode">v</button>
        </div>
        <div class="pd-kbd-hint" title="Keyboard shortcuts: Alt+J next, Alt+K previous, Alt+H hide/show">Alt+J/K</div>
        <div class="pd-position" data-id="position" title="Current position in selected Mode">0 / 0</div>
        <button type="button" class="pd-expand-btn" data-id="hide-ui" title="Hide all PromptDrive bars">Hide</button>
        <button type="button" class="pd-expand-btn" data-id="expand" aria-expanded="false" title="Show more controls and stats">More</button>
      </div>
      <div class="pd-topbar-advanced" data-id="advanced" hidden>
        <div class="pd-advanced-group">
          <label class="pd-field pd-filter" title="Filter messages by keyword in selected mode">
            <span>Filter</span>
            <input data-id="filter" type="text" placeholder="keyword" />
          </label>
        </div>
        <span class="pd-divider" aria-hidden="true"></span>
        <div class="pd-bookmark-controls pd-advanced-group">
          <button type="button" class="pd-small-btn" data-id="bookmark-msg" title="Bookmark current highlighted message">+ Msg</button>
          <button type="button" class="pd-small-btn" data-id="bookmark-sel" title="Bookmark selected text in a message">+ Sel</button>
          <button type="button" class="pd-small-btn" data-id="bookmark-prev" title="Go to previous bookmark">Prev BM</button>
          <button type="button" class="pd-small-btn" data-id="bookmark-next" title="Go to next bookmark">Next BM</button>
          <button type="button" class="pd-small-btn pd-list-toggle" data-id="bookmark-list" title="Show or hide bookmark list">List</button>
          <button type="button" class="pd-small-btn" data-id="bookmark-clear" title="Delete all bookmarks in this chat">Clear BM</button>
        </div>
        <span class="pd-divider" aria-hidden="true"></span>
        <div class="pd-quick-nav pd-advanced-group" title="Direct mode navigation (does not change selected mode)">
          <button type="button" class="pd-small-btn" data-mode="combined" data-dir="up" title="Previous message (all)">Any ^</button>
          <button type="button" class="pd-small-btn" data-mode="combined" data-dir="down" title="Next message (all)">Any v</button>
          <button type="button" class="pd-small-btn" data-mode="user" data-dir="up" title="Previous your message">You ^</button>
          <button type="button" class="pd-small-btn" data-mode="user" data-dir="down" title="Next your message">You v</button>
          <button type="button" class="pd-small-btn" data-mode="assistant" data-dir="up" title="Previous assistant message">AI ^</button>
          <button type="button" class="pd-small-btn" data-mode="assistant" data-dir="down" title="Next assistant message">AI v</button>
        </div>
        <span class="pd-divider" aria-hidden="true"></span>
        <div class="pd-stats pd-advanced-group">
          <div class="pd-chip" title="Number of bookmarks in this chat">Bookmarks <strong data-id="stat-bookmarks">0</strong></div>
          <div class="pd-chip" title="How many messages you sent in this chat">Your msgs <strong data-id="stat-user-msgs">0</strong></div>
          <div class="pd-chip" title="Total word count of your messages">Your words <strong data-id="stat-user-words">0</strong></div>
          <div class="pd-chip" data-id="chip-first" title="Timestamp of first message in this chat">First <strong data-id="stat-first">n/a</strong></div>
          <div class="pd-chip" data-id="chip-last" title="Timestamp of latest message in this chat">Last <strong data-id="stat-last">n/a</strong></div>
          <div class="pd-chip" data-id="chip-idle" title="Seconds since latest message">Idle <strong data-id="stat-idle">n/a</strong></div>
        </div>
        <div class="pd-bookmark-list" data-id="bookmark-list-container" hidden></div>
      </div>
    `;

    document.body.append(root);
    this.element = root;
    this.spacer = this.ensureSpacer();

    this.modeSelect = root.querySelector<HTMLSelectElement>("[data-id='mode']")!;
    this.edgeModeSelect = root.querySelector<HTMLSelectElement>("[data-id='edge']")!;
    this.stepUpButton = root.querySelector<HTMLButtonElement>("[data-id='step-up']")!;
    this.stepDownButton = root.querySelector<HTMLButtonElement>("[data-id='step-down']")!;
    this.filterInput = root.querySelector<HTMLInputElement>("[data-id='filter']")!;
    this.positionLabel = root.querySelector<HTMLElement>("[data-id='position']")!;
    this.statsUserMessages = root.querySelector<HTMLElement>("[data-id='stat-user-msgs']")!;
    this.statsUserWords = root.querySelector<HTMLElement>("[data-id='stat-user-words']")!;
    this.statsFirst = root.querySelector<HTMLElement>("[data-id='stat-first']")!;
    this.statsLast = root.querySelector<HTMLElement>("[data-id='stat-last']")!;
    this.statsIdle = root.querySelector<HTMLElement>("[data-id='stat-idle']")!;
    this.statsBookmarks = root.querySelector<HTMLElement>("[data-id='stat-bookmarks']")!;
    this.chipFirst = root.querySelector<HTMLElement>("[data-id='chip-first']")!;
    this.chipLast = root.querySelector<HTMLElement>("[data-id='chip-last']")!;
    this.chipIdle = root.querySelector<HTMLElement>("[data-id='chip-idle']")!;
    this.addBookmarkButton = root.querySelector<HTMLButtonElement>("[data-id='bookmark-msg']")!;
    this.addSelectionButton = root.querySelector<HTMLButtonElement>("[data-id='bookmark-sel']")!;
    this.prevBookmarkButton = root.querySelector<HTMLButtonElement>("[data-id='bookmark-prev']")!;
    this.nextBookmarkButton = root.querySelector<HTMLButtonElement>("[data-id='bookmark-next']")!;
    this.bookmarksListButton = root.querySelector<HTMLButtonElement>("[data-id='bookmark-list']")!;
    this.clearBookmarksButton = root.querySelector<HTMLButtonElement>("[data-id='bookmark-clear']")!;
    this.bookmarkListContainer = root.querySelector<HTMLElement>("[data-id='bookmark-list-container']")!;
    this.hideUiButton = root.querySelector<HTMLButtonElement>("[data-id='hide-ui']")!;
    this.expandButton = root.querySelector<HTMLButtonElement>("[data-id='expand']")!;
    this.advancedRow = root.querySelector<HTMLElement>("[data-id='advanced']")!;
    this.quickNavButtons = root.querySelectorAll<HTMLButtonElement>(".pd-quick-nav button");

    this.modeSelect.addEventListener("change", () =>
      handlers.onModeChange(this.modeSelect.value as NavMode)
    );
    this.edgeModeSelect.addEventListener("change", () =>
      handlers.onEdgeClickModeChange(this.edgeModeSelect.value as EdgeClickMode)
    );
    this.stepUpButton.addEventListener("click", () => handlers.onStepUp());
    this.stepDownButton.addEventListener("click", () => handlers.onStepDown());
    this.filterInput.addEventListener("input", () =>
      handlers.onFilterChange(this.filterInput.value)
    );
    this.expandButton.addEventListener("click", () => handlers.onToggleExpanded());
    this.hideUiButton.addEventListener("click", () => handlers.onToggleUiHidden());
    this.addBookmarkButton.addEventListener("click", () => handlers.onAddMessageBookmark());
    this.addSelectionButton.addEventListener("click", () => handlers.onAddSelectionBookmark());
    this.prevBookmarkButton.addEventListener("click", () => handlers.onPrevBookmark());
    this.nextBookmarkButton.addEventListener("click", () => handlers.onNextBookmark());
    this.bookmarksListButton.addEventListener("click", () => {
      this.bookmarkListOpen = !this.bookmarkListOpen;
      this.bookmarkListContainer.hidden = !this.bookmarkListOpen;
      this.bookmarksListButton.textContent = this.bookmarkListOpen ? "Close" : "List";
      this.bookmarksListButton.title = this.bookmarkListOpen
        ? "Hide bookmark list"
        : "Show bookmark list";
    });
    this.clearBookmarksButton.addEventListener("click", () => handlers.onClearBookmarks());

    this.quickNavButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.mode as NavMode | undefined;
        const dir = button.dataset.dir as StepDirection | undefined;
        if (!mode || !dir) {
          return;
        }
        handlers.onDirectStep(mode, dir);
      });
    });

    this.bookmarkListContainer.addEventListener("click", (event) => {
      const removeTarget = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-bookmark-remove]");
      const selectTarget = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-bookmark-id]");
      const removeId = removeTarget?.dataset.bookmarkRemove;
      const selectId = selectTarget?.dataset.bookmarkId;

      if (removeId) {
        handlers.onDeleteBookmark(removeId);
        return;
      }

      if (!selectId) {
        return;
      }
      handlers.onSelectBookmark(selectId);
    });
  }

  update(state: PromptDriveState): void {
    this.modeSelect.value = state.mode;
    this.edgeModeSelect.value = state.edgeClickMode;
    this.edgeModeSelect.title =
      state.edgeClickMode === "percentNearest"
        ? "Percent Jump: click anywhere on the rail to jump by relative chat position."
        : "Markers Only: only line markers are clickable jump targets.";
    this.filterInput.value = state.filterKeyword;
    this.positionLabel.textContent = `${state.currentIndex} / ${state.total}`;
    const naturalBoundary =
      state.total === 0
        ? null
        : state.currentIndex <= 1
          ? "up"
          : state.currentIndex >= state.total
            ? "down"
            : null;
    const visibleBoundary = state.boundaryHint ?? naturalBoundary;
    this.stepUpButton.classList.toggle("is-boundary", visibleBoundary === "up");
    this.stepDownButton.classList.toggle("is-boundary", visibleBoundary === "down");
    this.quickNavButtons.forEach((button) => {
      const direction = button.dataset.dir as StepDirection | undefined;
      button.classList.toggle("is-boundary", direction !== undefined && direction === visibleBoundary);
    });

    this.statsUserMessages.textContent = `${state.stats.userMessageCount}`;
    this.statsUserWords.textContent = `${state.stats.userWordCount}`;
    const firstValue = formatTime(state.stats.firstMessageAt);
    const lastValue = formatTime(state.stats.lastMessageAt);
    const idleValue = formatIdleSeconds(state.stats.idleSeconds);
    this.statsFirst.textContent = firstValue;
    this.statsLast.textContent = lastValue;
    this.statsIdle.textContent = idleValue;
    this.chipFirst.title =
      firstValue === "n/a"
        ? `Timestamp of first message in this chat. ${NA_TIME_HINT}`
        : `Timestamp of first message in this chat: ${firstValue}`;
    this.chipLast.title =
      lastValue === "n/a"
        ? `Timestamp of latest message in this chat. ${NA_TIME_HINT}`
        : `Timestamp of latest message in this chat: ${lastValue}`;
    this.chipIdle.title =
      idleValue === "n/a"
        ? `Time since latest message. ${NA_TIME_HINT}`
        : `Time since latest message: ${idleValue}`;
    this.statsBookmarks.textContent = `${state.bookmarkCount}`;
    this.clearBookmarksButton.disabled = state.bookmarkCount === 0;

    this.advancedRow.hidden = !state.expanded;
    this.expandButton.setAttribute("aria-expanded", state.expanded ? "true" : "false");
    this.expandButton.textContent = state.expanded ? "Less" : "More";
    this.expandButton.title = state.expanded
      ? "Collapse advanced controls"
      : "Show more controls and stats";
  }

  setBookmarkItems(items: BookmarkListItem[]): void {
    if (items.length === 0) {
      this.bookmarkListContainer.innerHTML = `<div class="pd-bookmark-empty">No bookmarks yet.</div>`;
      return;
    }

    this.bookmarkListContainer.innerHTML = items
      .map(
        (item) =>
          `<div class="pd-bookmark-item-row">
            <button type="button" class="pd-bookmark-item" data-bookmark-id="${item.id}" title="${item.label}">
              ${item.label}
            </button>
            <button type="button" class="pd-bookmark-remove" data-bookmark-remove="${item.id}" title="Delete bookmark">x</button>
          </div>`
      )
      .join("");
  }

  syncLayout(): void {
    this.ensureMounted();

    const top = Math.max(8, this.adapter.getHeaderBottomOffset() + 6);
    this.element.style.top = `${top}px`;

    const mainRect = document.querySelector<HTMLElement>("main")?.getBoundingClientRect();
    if (mainRect && mainRect.width > 220) {
      this.element.style.left = `${Math.max(8, mainRect.left + 8)}px`;
      this.element.style.right = `${Math.max(8, window.innerWidth - mainRect.right + 8)}px`;
      this.element.style.width = "auto";
      this.element.style.transform = "none";
    } else {
      this.element.style.left = "50%";
      this.element.style.right = "";
      this.element.style.width = "min(960px, calc(100vw - 20px))";
      this.element.style.transform = "translateX(-50%)";
    }

    const height = Math.ceil(this.element.getBoundingClientRect().height) + 10;

    const host = this.resolveSpacerHost();
    if (this.spacer.parentElement !== host) {
      host.prepend(this.spacer);
    }
    this.spacer.style.height = `${height}px`;
  }

  private ensureSpacer(): HTMLElement {
    const existing = document.querySelector<HTMLElement>(".pd-topbar-spacer");
    if (existing) {
      return existing;
    }

    const spacer = document.createElement("div");
    spacer.className = "pd-topbar-spacer";
    const host = this.resolveSpacerHost();
    host.prepend(spacer);
    return spacer;
  }

  private ensureMounted(): void {
    if (this.element.isConnected) {
      return;
    }

    document.body.append(this.element);
  }

  private resolveSpacerHost(): HTMLElement {
    const firstTurn = document.querySelector<HTMLElement>("article[data-testid^='conversation-turn']");
    const parent = firstTurn?.parentElement;
    if (parent) {
      return parent;
    }

    return document.querySelector<HTMLElement>("main") ?? document.body;
  }
}
