interface TextSegment {
  node: Text;
  start: number;
  end: number;
}

interface NormalizedTextMap {
  text: string;
  normalizedToRaw: number[];
}

function normalizeForSearch(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function buildNormalizedMap(rawText: string): NormalizedTextMap {
  let normalized = "";
  const normalizedToRaw: number[] = [];
  let hasContent = false;
  let pendingSpaceRawIndex: number | null = null;

  for (let index = 0; index < rawText.length; index += 1) {
    const char = rawText[index];
    if (char === undefined) {
      continue;
    }

    if (/\s/.test(char)) {
      if (hasContent && pendingSpaceRawIndex === null) {
        pendingSpaceRawIndex = index;
      }
      continue;
    }

    if (pendingSpaceRawIndex !== null) {
      normalized += " ";
      normalizedToRaw.push(pendingSpaceRawIndex);
      pendingSpaceRawIndex = null;
    }

    normalized += char.toLowerCase();
    normalizedToRaw.push(index);
    hasContent = true;
  }

  return { text: normalized, normalizedToRaw };
}

function indexOfNth(haystack: string, needle: string, occurrence: number): number {
  if (!needle || occurrence < 0) {
    return -1;
  }

  let fromIndex = 0;
  let foundAt = -1;

  for (let cursor = 0; cursor <= occurrence; cursor += 1) {
    foundAt = haystack.indexOf(needle, fromIndex);
    if (foundAt < 0) {
      return -1;
    }
    fromIndex = foundAt + Math.max(needle.length, 1);
  }

  return foundAt;
}

function collectVisibleTextSegments(root: HTMLElement): { rawText: string; segments: TextSegment[] } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node): number {
      const textNode = node as Text;
      const value = textNode.nodeValue ?? "";
      if (!value.trim()) {
        return NodeFilter.FILTER_REJECT;
      }

      const parent = textNode.parentElement;
      if (!parent) {
        return NodeFilter.FILTER_REJECT;
      }

      if (parent.closest("script, style, .sr-only, [aria-hidden='true']")) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let rawText = "";
  const segments: TextSegment[] = [];
  let currentNode = walker.nextNode();

  while (currentNode) {
    const textNode = currentNode as Text;
    const value = textNode.nodeValue ?? "";
    const start = rawText.length;
    rawText += value;
    segments.push({ node: textNode, start, end: rawText.length });
    currentNode = walker.nextNode();
  }

  return { rawText, segments };
}

function resolveNodeOffset(
  segments: TextSegment[],
  rawIndex: number,
  preferEnd: boolean
): { node: Text; offset: number } | null {
  if (segments.length === 0) {
    return null;
  }

  for (const segment of segments) {
    if (rawIndex < segment.start) {
      return {
        node: segment.node,
        offset: 0
      };
    }

    const length = segment.node.nodeValue?.length ?? 0;
    const withinSegment = rawIndex >= segment.start && rawIndex < segment.end;
    const atSegmentEnd = preferEnd && rawIndex === segment.end;

    if (withinSegment || atSegmentEnd) {
      return {
        node: segment.node,
        offset: Math.max(0, Math.min(length, rawIndex - segment.start))
      };
    }
  }

  const last = segments[segments.length - 1];
  if (!last) {
    return null;
  }

  return {
    node: last.node,
    offset: last.node.nodeValue?.length ?? 0
  };
}

function createSelectionRange(
  messageElement: HTMLElement,
  selectionText: string,
  preferredOccurrence: number
): Range | null {
  const normalizedSelection = normalizeForSearch(selectionText);
  if (!normalizedSelection) {
    return null;
  }

  const { rawText, segments } = collectVisibleTextSegments(messageElement);
  if (!rawText || segments.length === 0) {
    return null;
  }

  const normalizedMessage = buildNormalizedMap(rawText);
  if (!normalizedMessage.text) {
    return null;
  }

  let normalizedStart = indexOfNth(
    normalizedMessage.text,
    normalizedSelection,
    Math.max(0, preferredOccurrence)
  );
  if (normalizedStart < 0) {
    normalizedStart = normalizedMessage.text.indexOf(normalizedSelection);
  }

  if (normalizedStart < 0) {
    return null;
  }

  const normalizedEnd = normalizedStart + normalizedSelection.length - 1;
  const rawStart = normalizedMessage.normalizedToRaw[normalizedStart];
  const rawEnd = normalizedMessage.normalizedToRaw[normalizedEnd];

  if (rawStart === undefined || rawEnd === undefined) {
    return null;
  }

  const startPoint = resolveNodeOffset(segments, rawStart, false);
  const endPoint = resolveNodeOffset(segments, rawEnd + 1, true);
  if (!startPoint || !endPoint) {
    return null;
  }

  const range = document.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  return range;
}

function findScrollableAncestor(element: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = element.parentElement;

  while (node) {
    const style = getComputedStyle(node);
    const overflowY = style.overflowY.toLowerCase();
    const isScrollable =
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight + 4;
    if (isScrollable) {
      return node;
    }
    node = node.parentElement;
  }

  return null;
}

function scrollRectToCenter(range: Range, contextElement: HTMLElement): void {
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
  if (!rect || rect.height === 0) {
    return;
  }

  const scrollContainer = findScrollableAncestor(contextElement);
  if (scrollContainer) {
    const containerRect = scrollContainer.getBoundingClientRect();
    const offsetWithinContainer = rect.top - containerRect.top;
    const desiredTop =
      scrollContainer.scrollTop + offsetWithinContainer - scrollContainer.clientHeight / 2;

    scrollContainer.scrollTo({
      top: Math.max(0, desiredTop),
      behavior: "smooth"
    });
    return;
  }

  const desiredWindowTop = window.scrollY + rect.top - window.innerHeight / 2;
  window.scrollTo({ top: Math.max(0, desiredWindowTop), behavior: "smooth" });
}

let highlightedRangeText: string | null = null;
let highlightedRangeTimer: number | null = null;

function highlightSelectionRange(range: Range): void {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const text = range.toString().trim();
  if (!text) {
    return;
  }

  selection.removeAllRanges();
  selection.addRange(range);
  highlightedRangeText = text;

  if (highlightedRangeTimer !== null) {
    window.clearTimeout(highlightedRangeTimer);
  }

  highlightedRangeTimer = window.setTimeout(() => {
    const activeSelection = window.getSelection();
    if (
      activeSelection &&
      activeSelection.rangeCount > 0 &&
      activeSelection.toString().trim() === highlightedRangeText
    ) {
      activeSelection.removeAllRanges();
    }
    highlightedRangeText = null;
    highlightedRangeTimer = null;
  }, 1100);
}

export function revealSelectionBookmark(
  messageElement: HTMLElement,
  selectionText: string,
  preferredOccurrence: number
): boolean {
  const range = createSelectionRange(messageElement, selectionText, preferredOccurrence);
  if (!range) {
    return false;
  }

  scrollRectToCenter(range, messageElement);
  highlightSelectionRange(range);
  return true;
}
