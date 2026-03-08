import type { ChatMessage, ChatStats } from "@shared/types";

const WORD_SEPARATOR = /\s+/;

function toWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(WORD_SEPARATOR).filter(Boolean).length;
}

function parseTimestamp(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const milliseconds = Date.parse(value);
  return Number.isNaN(milliseconds) ? undefined : milliseconds;
}

export class StatsService {
  build(messages: ChatMessage[], now = Date.now()): ChatStats {
    const userMessages = messages.filter((message) => message.role === "user");

    let userWordCount = 0;
    for (const message of userMessages) {
      userWordCount += toWordCount(message.text);
    }

    const firstMessageAt = parseTimestamp(messages[0]?.timestamp);
    const lastMessageAt = parseTimestamp(messages[messages.length - 1]?.timestamp);
    const idleSeconds =
      lastMessageAt === undefined ? undefined : Math.max(0, Math.round((now - lastMessageAt) / 1000));

    return {
      userMessageCount: userMessages.length,
      userWordCount,
      firstMessageAt: firstMessageAt === undefined ? undefined : new Date(firstMessageAt).toISOString(),
      lastMessageAt: lastMessageAt === undefined ? undefined : new Date(lastMessageAt).toISOString(),
      idleSeconds
    };
  }
}
