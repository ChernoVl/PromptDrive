import type { EdgeClickMode, TimelineLane, TimelineMarker, TimelineModel } from "@shared/types";

interface TimelineRailHandlers {
  onLanePercentClick: (lane: TimelineLane, percentY: number) => void;
  onMarkerClick: (lane: TimelineLane, domId: string) => void;
}

function createMarkerElement(marker: TimelineMarker): HTMLButtonElement {
  const markerButton = document.createElement("button");
  markerButton.type = "button";
  markerButton.className = [
    "pd-marker",
    marker.kind === "bookmark" ? "pd-marker--bookmark" : "pd-marker--section",
    marker.active ? "pd-marker--active" : ""
  ]
    .filter(Boolean)
    .join(" ");
  markerButton.style.top = `${Math.max(0, Math.min(1, marker.percent)) * 100}%`;
  markerButton.dataset.domId = marker.domId;
  markerButton.dataset.lane = marker.lane;
  markerButton.title = marker.kind === "bookmark" ? "Bookmark jump" : "Timeline jump";
  return markerButton;
}

export class TimelineRail {
  readonly element: HTMLElement;
  private readonly userLane: HTMLElement;
  private readonly assistantLane: HTMLElement;
  private edgeClickMode: EdgeClickMode = "percentNearest";

  constructor(handlers: TimelineRailHandlers) {
    const root = document.createElement("aside");
    root.className = "pd-timeline-rail";
    root.setAttribute("aria-label", "PromptDrive timeline rail");

    root.innerHTML = `
      <div class="pd-rail-label">You</div>
      <div class="pd-lane" data-lane="user"></div>
      <div class="pd-rail-label">GPT</div>
      <div class="pd-lane" data-lane="assistant"></div>
    `;

    document.body.append(root);
    this.element = root;

    this.userLane = root.querySelector<HTMLElement>("[data-lane='user']")!;
    this.assistantLane = root.querySelector<HTMLElement>("[data-lane='assistant']")!;

    [this.userLane, this.assistantLane].forEach((laneElement) => {
      laneElement.addEventListener("click", (event) => {
        const lane = laneElement.dataset.lane as TimelineLane;
        const markerTarget = (event.target as HTMLElement).closest<HTMLElement>(".pd-marker");
        if (markerTarget) {
          const domId = markerTarget.dataset.domId;
          if (domId) {
            handlers.onMarkerClick(lane, domId);
          }
          return;
        }

        if (this.edgeClickMode === "markersOnly") {
          return;
        }

        const rect = laneElement.getBoundingClientRect();
        const offsetY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
        const percentY = rect.height === 0 ? 0 : offsetY / rect.height;
        handlers.onLanePercentClick(lane, percentY);
      });

      laneElement.addEventListener("mousemove", (event) => {
        const rect = laneElement.getBoundingClientRect();
        const offsetY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
        const percentY = rect.height === 0 ? 0 : offsetY / rect.height;
        const label = laneElement.dataset.lane === "user" ? "You" : "GPT";
        laneElement.setAttribute("title", `${label} ${(percentY * 100).toFixed(0)}%`);
      });
    });
  }

  update(model: TimelineModel, edgeClickMode: EdgeClickMode): void {
    this.edgeClickMode = edgeClickMode;
    this.renderLane(this.userLane, model.user);
    this.renderLane(this.assistantLane, model.assistant);
  }

  syncLayout(topOffset: number, bottomOffset: number): void {
    this.element.style.top = `${topOffset}px`;
    this.element.style.bottom = `${bottomOffset}px`;
  }

  private renderLane(target: HTMLElement, markers: TimelineMarker[]): void {
    target.innerHTML = "";
    markers.forEach((marker) => {
      target.append(createMarkerElement(marker));
    });
  }
}
