import { AnchorResolver } from "@content/bookmarks/anchorResolver";
import type { Bookmark, ChatMessage, StepDirection } from "@shared/types";

const STORAGE_KEY = "promptdrive.bookmarks";

function generateId(): string {
  return `bm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getStorageApi():
  | {
      get: (key: string) => Promise<Bookmark[]>;
      set: (key: string, value: Bookmark[]) => Promise<void>;
    }
  | null {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return null;
  }

  return {
    get: (key) =>
      new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          resolve((result[key] as Bookmark[] | undefined) ?? []);
        });
      }),
    set: (key, value) =>
      new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => resolve());
      })
  };
}

export interface BookmarkTarget {
  bookmark: Bookmark;
  message: ChatMessage;
  index: number;
}

export class BookmarkService {
  private readonly storageApi = getStorageApi();
  private readonly anchorResolver = new AnchorResolver();
  private bookmarks: Bookmark[] = [];

  async load(): Promise<void> {
    if (!this.storageApi) {
      this.bookmarks = [];
      return;
    }

    this.bookmarks = await this.storageApi.get(STORAGE_KEY);
  }

  getForChat(chatId: string): Bookmark[] {
    return this.bookmarks.filter((bookmark) => bookmark.chatId === chatId);
  }

  async addMessageBookmark(chatId: string, message: ChatMessage): Promise<Bookmark> {
    const bookmark: Bookmark = {
      id: generateId(),
      chatId,
      kind: "message",
      messageFingerprint: message.fingerprint,
      createdAt: Date.now()
    };

    this.bookmarks.push(bookmark);
    await this.persist();
    return bookmark;
  }

  async addSelectionBookmark(
    chatId: string,
    message: ChatMessage,
    selectionText: string
  ): Promise<Bookmark | null> {
    const anchor = this.anchorResolver.buildAnchor(message.text, selectionText);
    if (!anchor) {
      return null;
    }

    const bookmark: Bookmark = {
      id: generateId(),
      chatId,
      kind: "textRange",
      messageFingerprint: message.fingerprint,
      selectionText: anchor.selectionText,
      prefix: anchor.prefix,
      suffix: anchor.suffix,
      createdAt: Date.now()
    };

    this.bookmarks.push(bookmark);
    await this.persist();
    return bookmark;
  }

  async transferBranchBookmarks(chatId: string, messages: ChatMessage[]): Promise<number> {
    const existingCurrent = this.getForChat(chatId);
    const fingerprints = new Set(messages.map((message) => message.fingerprint));
    const sourceGroups = new Map<string, Bookmark[]>();

    for (const bookmark of this.bookmarks) {
      if (bookmark.chatId === chatId) {
        continue;
      }

      const sourceKey = bookmark.sourceChatId ?? bookmark.chatId;
      const group = sourceGroups.get(sourceKey) ?? [];
      group.push(bookmark);
      sourceGroups.set(sourceKey, group);
    }

    let transfers = 0;

    sourceGroups.forEach((group, sourceKey) => {
      const matched = group.filter((bookmark) => fingerprints.has(bookmark.messageFingerprint));
      if (matched.length === 0) {
        return;
      }

      const requiresRatio = group.length > 2;
      const ratio = matched.length / group.length;
      if (requiresRatio && ratio < 0.34) {
        return;
      }

      matched.forEach((bookmark) => {
        const duplicate = existingCurrent.some(
          (existing) =>
            existing.messageFingerprint === bookmark.messageFingerprint &&
            existing.kind === bookmark.kind &&
            existing.selectionText === bookmark.selectionText
        );

        if (duplicate) {
          return;
        }

        this.bookmarks.push({
          ...bookmark,
          id: generateId(),
          chatId,
          sourceChatId: sourceKey
        });
        transfers += 1;
      });
    });

    if (transfers > 0) {
      await this.persist();
    }

    return transfers;
  }

  getBookmarkCount(chatId: string): number {
    return this.getForChat(chatId).length;
  }

  getNextBookmarkTarget(
    chatId: string,
    currentDomId: string | null,
    messages: ChatMessage[],
    direction: StepDirection
  ): BookmarkTarget | null {
    const targets = this.resolveTargets(chatId, messages);
    if (targets.length === 0) {
      return null;
    }

    const currentIndex = currentDomId
      ? targets.findIndex((target) => target.message.domId === currentDomId)
      : -1;

    if (direction === "down") {
      const target = targets[currentIndex + 1] ?? targets[0];
      if (!target) {
        return null;
      }
      return target;
    }

    if (currentIndex < 0) {
      return targets[targets.length - 1] ?? null;
    }

    return targets[currentIndex - 1] ?? targets[targets.length - 1] ?? null;
  }

  async removeBookmark(id: string): Promise<void> {
    const before = this.bookmarks.length;
    this.bookmarks = this.bookmarks.filter((bookmark) => bookmark.id !== id);
    if (this.bookmarks.length !== before) {
      await this.persist();
    }
  }

  async removeAllForChat(chatId: string): Promise<number> {
    const before = this.bookmarks.length;
    this.bookmarks = this.bookmarks.filter((bookmark) => bookmark.chatId !== chatId);
    const removed = before - this.bookmarks.length;
    if (removed > 0) {
      await this.persist();
    }
    return removed;
  }

  resolveSelectionBookmarkRange(messageText: string, bookmark: Bookmark): { start: number; end: number } | null {
    return this.anchorResolver.resolveRange(messageText, bookmark);
  }

  private resolveTargets(chatId: string, messages: ChatMessage[]): BookmarkTarget[] {
    const byFingerprint = new Map(messages.map((message, index) => [message.fingerprint, { message, index }]));

    return this.getForChat(chatId)
      .map((bookmark) => {
        const linked = byFingerprint.get(bookmark.messageFingerprint);
        if (!linked) {
          return null;
        }

        return {
          bookmark,
          message: linked.message,
          index: linked.index
        };
      })
      .filter((target): target is BookmarkTarget => target !== null)
      .sort((left, right) => left.index - right.index);
  }

  private async persist(): Promise<void> {
    if (!this.storageApi) {
      return;
    }

    await this.storageApi.set(STORAGE_KEY, this.bookmarks);
  }
}
