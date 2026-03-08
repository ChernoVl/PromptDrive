import { ChatAdapter } from "@content/dom/chatAdapter";
import type { PromptDriveState } from "@content/state/store";
import type { EdgeClickMode, NavMode, StepDirection } from "@shared/types";

interface TopBarHandlers {
  onModeChange: (mode: NavMode) => void;
  onDirectionChange: (direction: StepDirection) => void;
  onEdgeClickModeChange: (mode: EdgeClickMode) => void;
  onFilterChange: (keyword: string) => void;
  onToggleExpanded: () => void;
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

  private readonly modeSelect: HTMLSelectElement;
  private readonly directionSelect: HTMLSelectElement;
  private readonly edgeModeSelect: HTMLSelectElement;
  private readonly filterInput: HTMLInputElement;
  private readonly positionLabel: HTMLElement;
  private readonly statsUserMessages: HTMLElement;
  private readonly statsUserWords: HTMLElement;
  private readonly statsFirst: HTMLElement;
  private readonly statsLast: HTMLElement;
  private readonly statsIdle: HTMLElement;
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
          <span>Mode</span>
          <select data-id="mode">
            <option value="combined">Combined</option>
            <option value="user">You</option>
            <option value="assistant">GPT</option>
          </select>
        </label>
        <label class="pd-field">
          <span>Dir</span>
          <select data-id="direction">
            <option value="down">Down</option>
            <option value="up">Up</option>
          </select>
        </label>
        <label class="pd-field">
          <span>Edge</span>
          <select data-id="edge">
            <option value="percentNearest">Percent Jump</option>
            <option value="markersOnly">Markers Only</option>
          </select>
        </label>
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
        <div class="pd-stats">
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

    this.modeSelect = root.querySelector<HTMLSelectElement>("[data-id='mode']")!;
    this.directionSelect = root.querySelector<HTMLSelectElement>("[data-id='direction']")!;
    this.edgeModeSelect = root.querySelector<HTMLSelectElement>("[data-id='edge']")!;
    this.filterInput = root.querySelector<HTMLInputElement>("[data-id='filter']")!;
    this.positionLabel = root.querySelector<HTMLElement>("[data-id='position']")!;
    this.statsUserMessages = root.querySelector<HTMLElement>("[data-id='stat-user-msgs']")!;
    this.statsUserWords = root.querySelector<HTMLElement>("[data-id='stat-user-words']")!;
    this.statsFirst = root.querySelector<HTMLElement>("[data-id='stat-first']")!;
    this.statsLast = root.querySelector<HTMLElement>("[data-id='stat-last']")!;
    this.statsIdle = root.querySelector<HTMLElement>("[data-id='stat-idle']")!;
    this.expandButton = root.querySelector<HTMLButtonElement>("[data-id='expand']")!;
    this.advancedRow = root.querySelector<HTMLElement>("[data-id='advanced']")!;

    this.modeSelect.addEventListener("change", () =>
      handlers.onModeChange(this.modeSelect.value as NavMode)
    );
    this.directionSelect.addEventListener("change", () =>
      handlers.onDirectionChange(this.directionSelect.value as StepDirection)
    );
    this.edgeModeSelect.addEventListener("change", () =>
      handlers.onEdgeClickModeChange(this.edgeModeSelect.value as EdgeClickMode)
    );
    this.filterInput.addEventListener("input", () =>
      handlers.onFilterChange(this.filterInput.value)
    );
    this.expandButton.addEventListener("click", () => handlers.onToggleExpanded());
  }

  update(state: PromptDriveState): void {
    this.modeSelect.value = state.mode;
    this.directionSelect.value = state.direction;
    this.edgeModeSelect.value = state.edgeClickMode;
    this.filterInput.value = state.filterKeyword;
    this.positionLabel.textContent = `${state.currentIndex} / ${state.total}`;

    this.statsUserMessages.textContent = `${state.stats.userMessageCount}`;
    this.statsUserWords.textContent = `${state.stats.userWordCount}`;
    this.statsFirst.textContent = formatTime(state.stats.firstMessageAt);
    this.statsLast.textContent = formatTime(state.stats.lastMessageAt);
    this.statsIdle.textContent = formatIdleSeconds(state.stats.idleSeconds);

    this.advancedRow.hidden = !state.expanded;
    this.expandButton.setAttribute("aria-expanded", state.expanded ? "true" : "false");
    this.expandButton.textContent = state.expanded ? "Less" : "More";
  }

  syncLayout(): void {
    const top = this.adapter.getHeaderBottomOffset() + 8;
    this.element.style.top = `${top}px`;
  }
}
