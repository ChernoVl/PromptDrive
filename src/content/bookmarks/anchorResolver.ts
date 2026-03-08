import type { Bookmark } from "@shared/types";

const CONTEXT_SIZE = 18;

export interface TextAnchor {
  selectionText: string;
  prefix: string;
  suffix: string;
}

export interface ResolvedRange {
  start: number;
  end: number;
}

export class AnchorResolver {
  buildAnchor(messageText: string, selectionText: string): TextAnchor | null {
    const cleanedSelection = selectionText.trim();
    if (!cleanedSelection) {
      return null;
    }

    const start = messageText.indexOf(cleanedSelection);
    if (start < 0) {
      return {
        selectionText: cleanedSelection,
        prefix: "",
        suffix: ""
      };
    }

    return {
      selectionText: cleanedSelection,
      prefix: messageText.slice(Math.max(0, start - CONTEXT_SIZE), start),
      suffix: messageText.slice(start + cleanedSelection.length, start + cleanedSelection.length + CONTEXT_SIZE)
    };
  }

  resolveRange(messageText: string, bookmark: Bookmark): ResolvedRange | null {
    if (!bookmark.selectionText) {
      return null;
    }

    const candidates: number[] = [];
    let fromIndex = 0;

    while (fromIndex < messageText.length) {
      const at = messageText.indexOf(bookmark.selectionText, fromIndex);
      if (at < 0) {
        break;
      }

      candidates.push(at);
      fromIndex = at + bookmark.selectionText.length;
    }

    if (candidates.length === 0) {
      return null;
    }

    if (candidates.length === 1) {
      const only = candidates[0];
      if (only === undefined) {
        return null;
      }

      return { start: only, end: only + bookmark.selectionText.length };
    }

    const expectedPrefix = bookmark.prefix ?? "";
    const expectedSuffix = bookmark.suffix ?? "";

    for (const candidateStart of candidates) {
      const actualPrefix = messageText.slice(
        Math.max(0, candidateStart - expectedPrefix.length),
        candidateStart
      );
      const actualSuffix = messageText.slice(
        candidateStart + bookmark.selectionText.length,
        candidateStart + bookmark.selectionText.length + expectedSuffix.length
      );

      if (actualPrefix === expectedPrefix && actualSuffix === expectedSuffix) {
        return {
          start: candidateStart,
          end: candidateStart + bookmark.selectionText.length
        };
      }
    }

    const first = candidates[0];
    if (first === undefined) {
      return null;
    }

    return { start: first, end: first + bookmark.selectionText.length };
  }
}
