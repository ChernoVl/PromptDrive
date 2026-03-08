import { ChatAdapter } from "@content/dom/chatAdapter";
import type { StepDirection } from "@shared/types";

interface StepDotHandlers {
  onStep: () => void;
  onFlipDirection: () => void;
}

const LONG_PRESS_MS = 500;

export class StepDot {
  readonly element: HTMLButtonElement;
  private holdTimer: number | null = null;
  private didLongPress = false;

  constructor(private readonly adapter: ChatAdapter, private readonly handlers: StepDotHandlers) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pd-step-dot";
    button.setAttribute("aria-label", "PromptDrive step navigation");
    button.textContent = "↓";

    button.addEventListener("pointerdown", () => {
      this.didLongPress = false;
      this.holdTimer = window.setTimeout(() => {
        this.didLongPress = true;
        this.handlers.onFlipDirection();
      }, LONG_PRESS_MS);
    });

    const release = () => {
      if (this.holdTimer !== null) {
        window.clearTimeout(this.holdTimer);
        this.holdTimer = null;
      }

      if (!this.didLongPress) {
        this.handlers.onStep();
      }
    };

    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);

    document.body.append(button);
    this.element = button;
  }

  update(direction: StepDirection): void {
    this.element.textContent = direction === "down" ? "↓" : "↑";
    this.element.setAttribute(
      "aria-label",
      direction === "down" ? "Step down in current mode" : "Step up in current mode"
    );
  }

  syncLayout(): void {
    const composerTop = this.adapter.getComposerTopOffset();
    const bottomOffset = Math.max(18, window.innerHeight - composerTop + 18);
    this.element.style.bottom = `${bottomOffset}px`;
  }
}
