import type { Bookmark, ChatMessage, TimelineLane, TimelineMarker, TimelineModel } from "@shared/types";

const MAX_SECTION_MARKERS_PER_LANE = 40;

function sampleMessages(messages: ChatMessage[], maxMarkers: number): ChatMessage[] {
  if (messages.length <= maxMarkers) {
    return messages;
  }

  const sampled: ChatMessage[] = [];
  const step = (messages.length - 1) / (maxMarkers - 1);

  for (let markerIndex = 0; markerIndex < maxMarkers; markerIndex += 1) {
    const sourceIndex = Math.round(step * markerIndex);
    sampled.push(messages[sourceIndex]);
  }

  return sampled;
}

function computePercent(index: number, total: number): number {
  if (total <= 1) {
    return 0;
  }

  return index / (total - 1);
}

function buildMarkersForLane(
  lane: TimelineLane,
  messages: ChatMessage[],
  bookmarks: Bookmark[],
  activeDomId: string | null
): TimelineMarker[] {
  const laneMessages = messages.filter((message) => message.role === lane);
  const sampledMessages = sampleMessages(laneMessages, MAX_SECTION_MARKERS_PER_LANE);
  const sectionMarkers = sampledMessages.map((message, index) => ({
    domId: message.domId,
    lane,
    percent: computePercent(
      laneMessages.findIndex((item) => item.domId === message.domId),
      laneMessages.length
    ),
    kind: "section" as const,
    active: message.domId === activeDomId
  }));

  const laneBookmarkMarkers = bookmarks
    .map((bookmark) =>
      laneMessages.find((message) => message.fingerprint === bookmark.messageFingerprint)
    )
    .filter((message): message is ChatMessage => message !== undefined)
    .map((message) => ({
      domId: message.domId,
      lane,
      percent: computePercent(laneMessages.findIndex((item) => item.domId === message.domId), laneMessages.length),
      kind: "bookmark" as const,
      active: message.domId === activeDomId
    }));

  const markerMap = new Map<string, TimelineMarker>();
  [...sectionMarkers, ...laneBookmarkMarkers].forEach((marker) => {
    const id = `${marker.kind}:${marker.domId}`;
    markerMap.set(id, marker);
  });

  return [...markerMap.values()].sort((left, right) => left.percent - right.percent);
}

export class TimelineService {
  build(messages: ChatMessage[], bookmarks: Bookmark[], activeDomId: string | null): TimelineModel {
    return {
      user: buildMarkersForLane("user", messages, bookmarks, activeDomId),
      assistant: buildMarkersForLane("assistant", messages, bookmarks, activeDomId)
    };
  }
}
