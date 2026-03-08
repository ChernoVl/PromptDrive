const WHITESPACE_PATTERN = /\s+/g;

export function normalizeText(value: string): string {
  return value.trim().replace(WHITESPACE_PATTERN, " ").toLowerCase();
}

export function createFingerprint(text: string): string {
  const normalized = normalizeText(text);
  let hash = 2166136261;

  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fp-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
