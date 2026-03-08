import { describe, expect, test } from "vitest";
import { AnchorResolver } from "@content/bookmarks/anchorResolver";
import type { Bookmark } from "@shared/types";

describe("AnchorResolver", () => {
  test("builds text anchor with context", () => {
    const resolver = new AnchorResolver();
    const anchor = resolver.buildAnchor("abc hello world xyz", "hello world");
    expect(anchor).not.toBeNull();
    expect(anchor?.prefix).toContain("abc");
    expect(anchor?.suffix).toContain("xyz");
  });

  test("resolves best matching range", () => {
    const resolver = new AnchorResolver();
    const text = "alpha beta alpha beta";
    const bookmark: Bookmark = {
      id: "bm-1",
      chatId: "chat-1",
      kind: "textRange",
      messageFingerprint: "fp-1",
      selectionText: "alpha",
      prefix: " ",
      suffix: " beta",
      createdAt: Date.now()
    };

    const resolved = resolver.resolveRange(text, bookmark);
    expect(resolved).not.toBeNull();
    expect(text.slice(resolved!.start, resolved!.end)).toBe("alpha");
  });
});
