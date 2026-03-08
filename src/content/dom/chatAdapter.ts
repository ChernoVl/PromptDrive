import { createFingerprint } from "@shared/fingerprint";
import type { ChatMessage, MessageRole, StepDirection } from "@shared/types";

const MESSAGE_SELECTORS = [
  "[data-message-author-role='user']",
  "[data-message-author-role='assistant']",
  "article[data-testid^='conversation-turn']"
];

export class ChatAdapter {
  private idCounter = 0;

  collectMessages(): ChatMessage[] {
    const elements = this.collectCandidateElements();

    return elements
      .map((element) => this.parseMessageElement(element))
      .filter((message): message is ChatMessage => message !== null);
  }

  getChatId(): string {
    const match = location.pathname.match(/\/c\/([^/]+)/i);
    return match?.[1] ?? "unknown";
  }

  getHeaderBottomOffset(): number {
    const candidates = [
      "header",
      "[data-testid='conversation-header']",
      "[data-testid='header']"
    ];

    for (const selector of candidates) {
      const node = document.querySelector<HTMLElement>(selector);
      if (!node) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      if (rect.height > 0) {
        return Math.max(0, rect.bottom);
      }
    }

    return 0;
  }

  getComposerTopOffset(): number {
    const selectors = [
      "form textarea",
      "form [contenteditable='true']",
      "[data-testid='composer']"
    ];

    for (const selector of selectors) {
      const node = document.querySelector<HTMLElement>(selector);
      if (!node) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      if (rect.height > 0) {
        return rect.top;
      }
    }

    return window.innerHeight;
  }

  async tryLoadHistory(direction: StepDirection, maxAttempts = 3): Promise<boolean> {
    if (direction !== "up") {
      return false;
    }

    let hasGrown = false;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const scrollContainer = this.resolveScrollContainer();
      const beforeCount = this.collectMessages().length;

      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: "auto" });
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
      }

      await new Promise((resolve) => setTimeout(resolve, 250 + attempt * 120));

      const afterCount = this.collectMessages().length;
      if (afterCount > beforeCount) {
        hasGrown = true;
        break;
      }
    }

    return hasGrown;
  }

  private collectCandidateElements(): HTMLElement[] {
    const seen = new Set<HTMLElement>();
    const result: HTMLElement[] = [];

    for (const selector of MESSAGE_SELECTORS) {
      document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        const container = this.resolveMessageContainer(element);
        if (!container || seen.has(container)) {
          return;
        }

        seen.add(container);
        result.push(container);
      });
    }

    result.sort((left, right) => {
      if (left === right) {
        return 0;
      }

      const relation = left.compareDocumentPosition(right);
      if (relation & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1;
      }

      if (relation & Node.DOCUMENT_POSITION_PRECEDING) {
        return 1;
      }

      return left.getBoundingClientRect().top - right.getBoundingClientRect().top;
    });

    return result;
  }

  private parseMessageElement(element: HTMLElement): ChatMessage | null {
    if (!this.isVisibleMessageElement(element)) {
      return null;
    }

    const role = this.detectRole(element);
    const text = this.extractMessageText(element, role);
    if (!text) {
      return null;
    }

    const timestamp = this.extractTimestamp(element);
    const domId = this.ensureElementId(element);

    return {
      domId,
      role,
      text,
      timestamp,
      fingerprint: createFingerprint(`${role}:${text}`),
      element
    };
  }

  private resolveMessageContainer(element: HTMLElement): HTMLElement | null {
    const directAttr = element.getAttribute("data-message-author-role");
    if (directAttr === "user" || directAttr === "assistant") {
      let container: HTMLElement = element;
      while (
        container.parentElement?.getAttribute("data-message-author-role") === directAttr
      ) {
        const parent = container.parentElement;
        if (!parent) {
          break;
        }
        container = parent;
      }
      return container;
    }

    const attributedParent = element.closest<HTMLElement>("[data-message-author-role]");
    if (attributedParent) {
      return attributedParent;
    }

    const turnParent = element.closest<HTMLElement>("article[data-testid^='conversation-turn']");
    if (turnParent) {
      return turnParent;
    }

    return element;
  }

  private detectRole(element: HTMLElement): MessageRole {
    const roleValue =
      element.getAttribute("data-message-author-role") ??
      element.querySelector<HTMLElement>("[data-message-author-role]")?.getAttribute(
        "data-message-author-role"
      );

    if (roleValue === "user") {
      return "user";
    }

    return "assistant";
  }

  private extractMessageText(element: HTMLElement, role: MessageRole): string {
    const roleSpecificSelectors =
      role === "user"
        ? [".whitespace-pre-wrap", "[data-message-content]", "[data-testid='conversation-turn-content']"]
        : [".markdown", "[data-message-content]", "[data-testid='conversation-turn-content']"];

    for (const selector of roleSpecificSelectors) {
      const targets = Array.from(element.querySelectorAll<HTMLElement>(selector));
      if (targets.length === 0) {
        continue;
      }

      const text = targets
        .filter((target) => !target.closest("[aria-hidden='true']"))
        .map((target) => target.innerText?.trim() ?? "")
        .filter((value) => value.length > 0)
        .join("\n")
        .trim();
      if (text) {
        return text;
      }
    }

    return this.cleanText(element.innerText ?? "");
  }

  private cleanText(value: string): string {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  private extractTimestamp(element: HTMLElement): string | undefined {
    const timeNode =
      element.querySelector<HTMLTimeElement>("time[datetime]") ??
      element.querySelector<HTMLTimeElement>("time");

    const timestamp = timeNode?.dateTime || timeNode?.getAttribute("datetime");
    return timestamp || undefined;
  }

  private ensureElementId(element: HTMLElement): string {
    if (element.id) {
      return element.id;
    }

    const id = `pd-msg-${this.idCounter}`;
    this.idCounter += 1;
    element.id = id;
    return id;
  }

  private isVisibleMessageElement(element: HTMLElement): boolean {
    if (element.closest("[aria-hidden='true']")) {
      return false;
    }

    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    return true;
  }

  private resolveScrollContainer(): HTMLElement | null {
    const candidates = [
      "[data-testid='conversation-view-scrollable']",
      "main",
      "body"
    ];

    for (const selector of candidates) {
      const node = document.querySelector<HTMLElement>(selector);
      if (!node) {
        continue;
      }

      if (node.scrollHeight > node.clientHeight) {
        return node;
      }
    }

    return null;
  }
}
