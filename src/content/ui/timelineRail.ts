import type { EdgeClickMode, TimelineMarker, TimelineModel } from "@shared/types";

interface TimelineRailHandlers {
  onTrackPercentClick: (percentY: number) => void;
  onMarkerClick: (domId: string) => void;
  onModeStepUp: () => void;
  onModeStepDown: () => void;
}

function createMarkerElement(marker: TimelineMarker): HTMLButtonElement {
  const markerButton = document.createElement("button");
  markerButton.type = "button";
  markerButton.className = [
    "pd-line-marker",
    marker.lane === "user" ? "pd-line-marker--user" : "pd-line-marker--assistant",
    marker.kind === "bookmark" ? "pd-line-marker--bookmark" : "pd-line-marker--section",
    marker.active ? "pd-marker--active" : ""
  ]
    .filter(Boolean)
    .join(" ");
  markerButton.style.top = `${Math.max(0, Math.min(1, marker.percent)) * 100}%`;
  markerButton.dataset.domId = marker.domId;
  markerButton.dataset.lane = marker.lane;
  markerButton.title = marker.kind === "bookmark" ? "Bookmark jump" : "Message jump";
  return markerButton;
}

export class TimelineRail {
  readonly element: HTMLElement;
  private readonly track: HTMLElement;
  private edgeClickMode: EdgeClickMode = "percentNearest";

  constructor(handlers: TimelineRailHandlers) {
    const root = document.createElement("aside");
    root.className = "pd-timeline-rail";
    root.setAttribute("aria-label", "PromptDrive timeline rail");
    root.innerHTML = `
      <div class="pd-timeline-track" data-id="track"></div>
      <div class="pd-timeline-nav">
        <button type="button" data-id="mode-up" title="Previous in current mode">^</button>
        <button type="button" data-id="mode-down" title="Next in current mode">v</button>
      </div>
    `;

    document.body.append(root);
    this.element = root;
    this.track = root.querySelector<HTMLElement>("[data-id='track']")!;

    root.querySelector<HTMLButtonElement>("[data-id='mode-up']")!.addEventListener("click", () =>
      handlers.onModeStepUp()
    );
    root.querySelector<HTMLButtonElement>("[data-id='mode-down']")!.addEventListener("click", () =>
      handlers.onModeStepDown()
    );

    this.track.addEventListener("click", (event) => {
      const markerTarget = (event.target as HTMLElement).closest<HTMLElement>(".pd-line-marker");
      if (markerTarget) {
        const domId = markerTarget.dataset.domId;
        if (domId) {
          handlers.onMarkerClick(domId);
        }
        return;
      }

      if (this.edgeClickMode === "markersOnly") {
        return;
      }

      const rect = this.track.getBoundingClientRect();
      const offsetY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      const percentY = rect.height === 0 ? 0 : offsetY / rect.height;
      handlers.onTrackPercentClick(percentY);
    });

    this.track.addEventListener("mousemove", (event) => {
      const rect = this.track.getBoundingClientRect();
      const offsetY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
      const percentY = rect.height === 0 ? 0 : offsetY / rect.height;
      this.track.setAttribute("title", `${(percentY * 100).toFixed(0)}%`);
    });
  }

  update(model: TimelineModel, edgeClickMode: EdgeClickMode): void {
    this.edgeClickMode = edgeClickMode;
    const markers = [...model.user, ...model.assistant].sort((left, right) => left.percent - right.percent);
    this.renderTrack(markers);
  }

  syncLayout(topOffset: number, bottomOffset: number, rightOffset: number): void {
    this.ensureMounted();
    this.element.style.top = `${topOffset}px`;
    this.element.style.bottom = `${bottomOffset}px`;
    this.element.style.right = `${rightOffset}px`;
  }

  setHidden(hidden: boolean): void {
    this.element.style.display = hidden ? "none" : "";
  }

  private renderTrack(markers: TimelineMarker[]): void {
    this.track.innerHTML = "";
    markers.forEach((marker) => {
      this.track.append(createMarkerElement(marker));
    });
  }

  private ensureMounted(): void {
    if (this.element.isConnected) {
      return;
    }

    document.body.append(this.element);
  }
}
