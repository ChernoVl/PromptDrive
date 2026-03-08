import { createFingerprint } from "@shared/fingerprint";
import type { ChatMessage, MessageRole, StepDirection } from "@shared/types";

const MESSAGE_SELECTORS = [
  "[data-message-author-role]",
  "article[data-testid^='conversation-turn']",
  "article[data-message-author-role]"
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
    const text = this.extractMessageText(element);
    if (!text) {
      return null;
    }

    const role = this.detectRole(element);
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
      return element;
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

  private extractMessageText(element: HTMLElement): string {
    const explicitTextNodes = [
      "[data-message-content]",
      ".markdown",
      "[data-testid='conversation-turn-content']"
    ];

    for (const selector of explicitTextNodes) {
      const target = element.querySelector<HTMLElement>(selector);
      const text = target?.innerText?.trim();
      if (text) {
        return text;
      }
    }

    return element.innerText?.trim() ?? "";
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
