import { describe, expect, test } from "vitest";
import { createFingerprint, normalizeText } from "@shared/fingerprint";

describe("fingerprint", () => {
  test("normalizes whitespace and casing", () => {
    expect(normalizeText("  Hello   WORLD  ")).toBe("hello world");
  });

  test("is stable for equivalent content", () => {
    const first = createFingerprint("User: hello   world");
    const second = createFingerprint("user:   hello world");
    expect(first).toBe(second);
  });

  test("changes for different content", () => {
    const first = createFingerprint("alpha");
    const second = createFingerprint("beta");
    expect(first).not.toBe(second);
  });
});
