import { beforeEach, describe, expect, test } from "vitest";
import { BookmarkService } from "@content/bookmarks/bookmarkService";
import type { Bookmark, ChatMessage } from "@shared/types";

function createMessage(domId: string, role: "user" | "assistant", fingerprint: string): ChatMessage {
  return {
    domId,
    role,
    text: `${role}-${domId}`,
    fingerprint,
    element: document.createElement("article")
  };
}

describe("BookmarkService", () => {
  beforeEach(() => {
    const storage = {} as Record<string, unknown>;
    (globalThis as unknown as { chrome: typeof chrome }).chrome = {
      storage: {
        local: {
          get: (keys: string[], callback: (result: Record<string, unknown>) => void) => {
            const key = keys[0] ?? "";
            callback({ [key]: storage[key] });
          },
          set: (value: Record<string, unknown>, callback: () => void) => {
            Object.assign(storage, value);
            callback();
          }
        }
      }
    } as unknown as typeof chrome;
  });

  test("adds message bookmark and counts per chat", async () => {
    const service = new BookmarkService();
    await service.load();

    const message = createMessage("m1", "user", "fp-user-1");
    await service.addMessageBookmark("chat-a", message);

    expect(service.getBookmarkCount("chat-a")).toBe(1);
    expect(service.getBookmarkCount("chat-b")).toBe(0);
  });

  test("transfers branch bookmarks when overlap is present", async () => {
    const service = new BookmarkService();
    await service.load();

    const baseMessage = createMessage("m1", "user", "fp-match-1");
    const otherMessage = createMessage("m2", "assistant", "fp-match-2");
    await service.addMessageBookmark("source-chat", baseMessage);
    await service.addMessageBookmark("source-chat", otherMessage);

    const transferred = await service.transferBranchBookmarks("branch-chat", [baseMessage, otherMessage]);
    expect(transferred).toBe(2);
    expect(service.getBookmarkCount("branch-chat")).toBe(2);
  });

  test("returns next bookmark target with wraparound", async () => {
    const service = new BookmarkService();
    await service.load();

    const messages = [
      createMessage("m1", "user", "fp-1"),
      createMessage("m2", "assistant", "fp-2"),
      createMessage("m3", "user", "fp-3")
    ];
    const first = messages[0];
    const third = messages[2];
    if (!first || !third) {
      throw new Error("Test setup failed");
    }

    await service.addMessageBookmark("chat-1", first);
    await service.addMessageBookmark("chat-1", third);

    const next = service.getNextBookmarkTarget("chat-1", "m3", messages, "down");
    expect(next?.message.domId).toBe("m1");

    const prev = service.getNextBookmarkTarget("chat-1", "m1", messages, "up");
    expect(prev?.message.domId).toBe("m3");
  });

  test("removes all bookmarks for a specific chat", async () => {
    const service = new BookmarkService();
    await service.load();

    const messageA = createMessage("a1", "user", "fp-a1");
    const messageB = createMessage("b1", "assistant", "fp-b1");
    await service.addMessageBookmark("chat-a", messageA);
    await service.addMessageBookmark("chat-a", messageB);
    await service.addMessageBookmark("chat-b", messageA);

    const removed = await service.removeAllForChat("chat-a");
    expect(removed).toBe(2);
    expect(service.getBookmarkCount("chat-a")).toBe(0);
    expect(service.getBookmarkCount("chat-b")).toBe(1);
  });
});
