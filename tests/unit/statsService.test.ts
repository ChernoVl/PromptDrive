import { describe, expect, test } from "vitest";
import { StatsService } from "@content/stats/statsService";
import type { ChatMessage } from "@shared/types";

function createMessage(partial: Partial<ChatMessage>): ChatMessage {
  const element = document.createElement("article");
  return {
    domId: partial.domId ?? `msg-${Math.random()}`,
    role: partial.role ?? "assistant",
    text: partial.text ?? "",
    timestamp: partial.timestamp,
    fingerprint: partial.fingerprint ?? "fp-test",
    element
  };
}

describe("StatsService", () => {
  test("counts user messages and words", () => {
    const service = new StatsService();
    const messages: ChatMessage[] = [
      createMessage({ role: "user", text: "hello there", timestamp: "2026-03-01T10:00:00.000Z" }),
      createMessage({ role: "assistant", text: "response", timestamp: "2026-03-01T10:01:00.000Z" }),
      createMessage({ role: "user", text: "another prompt now", timestamp: "2026-03-01T10:02:00.000Z" })
    ];

    const stats = service.build(messages, Date.parse("2026-03-01T10:03:00.000Z"));
    expect(stats.userMessageCount).toBe(2);
    expect(stats.userWordCount).toBe(5);
    expect(stats.firstMessageAt).toBe("2026-03-01T10:00:00.000Z");
    expect(stats.lastMessageAt).toBe("2026-03-01T10:02:00.000Z");
    expect(stats.idleSeconds).toBe(60);
  });

  test("handles missing timestamps", () => {
    const service = new StatsService();
    const stats = service.build([createMessage({ role: "user", text: "hi" })]);
    expect(stats.firstMessageAt).toBeUndefined();
    expect(stats.lastMessageAt).toBeUndefined();
    expect(stats.idleSeconds).toBeUndefined();
  });
});
