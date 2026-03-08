const GLOW_CLASS = "pd-message-glow";

export class MessageHighlighter {
  private pendingRemoval = new WeakMap<HTMLElement, number>();

  highlight(messageElement: HTMLElement, durationMs = 1000): void {
    const existingTimeout = this.pendingRemoval.get(messageElement);
    if (existingTimeout !== undefined) {
      window.clearTimeout(existingTimeout);
    }

    messageElement.classList.add(GLOW_CLASS);

    const timeoutId = window.setTimeout(() => {
      messageElement.classList.remove(GLOW_CLASS);
      this.pendingRemoval.delete(messageElement);
    }, durationMs);

    this.pendingRemoval.set(messageElement, timeoutId);
  }
}
