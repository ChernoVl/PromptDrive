import { ChatAdapter } from "@content/dom/chatAdapter";
import type { PromptDriveState } from "@content/state/store";
import type { EdgeClickMode, NavMode } from "@shared/types";

interface TopBarHandlers {
  onModeChange: (mode: NavMode) => void;
  onEdgeClickModeChange: (mode: EdgeClickMode) => void;
  onStepUp: () => void;
  onStepDown: () => void;
  onFilterChange: (keyword: string) => void;
  onToggleExpanded: () => void;
  onAddMessageBookmark: () => void;
  onAddSelectionBookmark: () => void;
  onPrevBookmark: () => void;
  onNextBookmark: () => void;
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
  private readonly addBookmarkButton: HTMLButtonElement;
  private readonly addSelectionButton: HTMLButtonElement;
  private readonly prevBookmarkButton: HTMLButtonElement;
  private readonly nextBookmarkButton: HTMLButtonElement;
  private readonly expandButton: HTMLButtonElement;
  private readonly advancedRow: HTMLElement;

  constructor(private readonly adapter: ChatAdapter, handlers: TopBarHandlers) {
    const root = document.createElement("section");
    root.className = "pd-topbar";
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "PromptDrive controls");

    root.innerHTML = `
      <div class="pd-topbar-main">
        <div class="pd-brand">PromptDrive</div>
        <label class="pd-field">
          <span class="pd-label">Mode</span>
          <select data-id="mode">
            <option value="combined">Combined</option>
            <option value="user">You</option>
            <option value="assistant">GPT</option>
          </select>
        </label>
        <label class="pd-field">
          <span class="pd-label">Edge</span>
          <select data-id="edge">
            <option value="percentNearest">Percent Jump</option>
            <option value="markersOnly">Markers Only</option>
          </select>
        </label>
        <div class="pd-step-controls">
          <button type="button" class="pd-step-btn" data-id="step-up" aria-label="Scroll to previous message">↑</button>
          <button type="button" class="pd-step-btn" data-id="step-down" aria-label="Scroll to next message">↓</button>
        </div>
        <div class="pd-position" data-id="position">0 / 0</div>
        <button type="button" class="pd-expand-btn" data-id="expand" aria-expanded="false">
          More
        </button>
      </div>
      <div class="pd-topbar-advanced" data-id="advanced" hidden>
        <label class="pd-field pd-filter">
          <span>Filter (You)</span>
          <input data-id="filter" type="text" placeholder="keyword" />
        </label>
        <div class="pd-bookmark-controls">
          <button type="button" class="pd-small-btn" data-id="bookmark-msg">+ Msg</button>
          <button type="button" class="pd-small-btn" data-id="bookmark-sel">+ Sel</button>
          <button type="button" class="pd-small-btn" data-id="bookmark-prev">Prev BM</button>
          <button type="button" class="pd-small-btn" data-id="bookmark-next">Next BM</button>
        </div>
        <div class="pd-stats">
          <div class="pd-chip">Bookmarks <strong data-id="stat-bookmarks">0</strong></div>
          <div class="pd-chip">Your msgs <strong data-id="stat-user-msgs">0</strong></div>
          <div class="pd-chip">Your words <strong data-id="stat-user-words">0</strong></div>
          <div class="pd-chip">First <strong data-id="stat-first">n/a</strong></div>
          <div class="pd-chip">Last <strong data-id="stat-last">n/a</strong></div>
          <div class="pd-chip">Idle <strong data-id="stat-idle">n/a</strong></div>
        </div>
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
    this.addBookmarkButton = root.querySelector<HTMLButtonElement>("[data-id='bookmark-msg']")!;
    this.addSelectionButton = root.querySelector<HTMLButtonElement>("[data-id='bookmark-sel']")!;
    this.prevBookmarkButton = root.querySelector<HTMLButtonElement>("[data-id='bookmark-prev']")!;
    this.nextBookmarkButton = root.querySelector<HTMLButtonElement>("[data-id='bookmark-next']")!;
    this.expandButton = root.querySelector<HTMLButtonElement>("[data-id='expand']")!;
    this.advancedRow = root.querySelector<HTMLElement>("[data-id='advanced']")!;

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
    this.addBookmarkButton.addEventListener("click", () => handlers.onAddMessageBookmark());
    this.addSelectionButton.addEventListener("click", () => handlers.onAddSelectionBookmark());
    this.prevBookmarkButton.addEventListener("click", () => handlers.onPrevBookmark());
    this.nextBookmarkButton.addEventListener("click", () => handlers.onNextBookmark());
  }

  update(state: PromptDriveState): void {
    this.modeSelect.value = state.mode;
    this.edgeModeSelect.value = state.edgeClickMode;
    this.filterInput.value = state.filterKeyword;
    this.positionLabel.textContent = `${state.currentIndex} / ${state.total}`;
    this.stepUpButton.classList.toggle("is-active", state.direction === "up");
    this.stepDownButton.classList.toggle("is-active", state.direction === "down");

    this.statsUserMessages.textContent = `${state.stats.userMessageCount}`;
    this.statsUserWords.textContent = `${state.stats.userWordCount}`;
    this.statsFirst.textContent = formatTime(state.stats.firstMessageAt);
    this.statsLast.textContent = formatTime(state.stats.lastMessageAt);
    this.statsIdle.textContent = formatIdleSeconds(state.stats.idleSeconds);
    this.statsBookmarks.textContent = `${state.bookmarkCount}`;

    this.advancedRow.hidden = !state.expanded;
    this.expandButton.setAttribute("aria-expanded", state.expanded ? "true" : "false");
    this.expandButton.textContent = state.expanded ? "Less" : "More";
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

    const host = document.querySelector<HTMLElement>("main") ?? document.body;
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
    const host = document.querySelector<HTMLElement>("main") ?? document.body;
    host.prepend(spacer);
    return spacer;
  }

  private ensureMounted(): void {
    if (this.element.isConnected) {
      return;
    }

    document.body.append(this.element);
  }
}
