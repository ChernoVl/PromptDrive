import { beforeEach, describe, expect, test, vi } from "vitest";
import { NavigatorService } from "@content/navigation/navigator";
import type { ChatMessage, StepDirection } from "@shared/types";

interface AdapterStub {
  collectMessages: () => ChatMessage[];
  tryLoadHistory: (direction: StepDirection, maxAttempts?: number) => Promise<boolean>;
}

function makeMessage(domId: string, role: "user" | "assistant", text: string): ChatMessage {
  const element = document.createElement("article");
  element.id = domId;
  element.textContent = text;
  document.body.append(element);
  return {
    domId,
    role,
    text,
    fingerprint: `fp-${domId}`,
    element
  };
}

describe("NavigatorService", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    Object.defineProperty(window, "scrollY", { value: 0, writable: true });
    window.scrollTo = vi.fn();
  });

  test("steps through combined mode", async () => {
    const messages = [
      makeMessage("m1", "user", "first"),
      makeMessage("m2", "assistant", "second"),
      makeMessage("m3", "user", "third")
    ];

    const adapter: AdapterStub = {
      collectMessages: () => messages,
      tryLoadHistory: async () => false
    };
    const highlighter = { highlight: vi.fn() };
    const navigator = new NavigatorService(adapter as never, highlighter as never);

    const first = await navigator.step("combined", "down", "");
    expect(first.moved).toBe(true);
    expect(first.message?.domId).toBe("m1");

    const second = await navigator.step("combined", "down", "");
    expect(second.message?.domId).toBe("m2");
  });

  test("filters only user messages for keyword", async () => {
    const messages = [
      makeMessage("m1", "user", "search token"),
      makeMessage("m2", "assistant", "search token"),
      makeMessage("m3", "user", "other")
    ];

    const adapter: AdapterStub = {
      collectMessages: () => messages,
      tryLoadHistory: async () => false
    };
    const highlighter = { highlight: vi.fn() };
    const navigator = new NavigatorService(adapter as never, highlighter as never);

    const result = await navigator.step("combined", "down", "search");
    expect(result.message?.domId).toBe("m1");
    expect(result.total).toBe(1);
  });

  test("jumps by lane percent", async () => {
    const messages = [
      makeMessage("u1", "user", "one"),
      makeMessage("a1", "assistant", "two"),
      makeMessage("u2", "user", "three"),
      makeMessage("a2", "assistant", "four")
    ];

    const adapter: AdapterStub = {
      collectMessages: () => messages,
      tryLoadHistory: async () => false
    };
    const highlighter = { highlight: vi.fn() };
    const navigator = new NavigatorService(adapter as never, highlighter as never);

    const result = await navigator.jumpToPercent("assistant", 1, "combined", "");
    expect(result.message?.domId).toBe("a2");
  });
});
