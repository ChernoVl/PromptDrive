import { describe, expect, test, vi } from "vitest";
import { TimelineRail } from "@content/ui/timelineRail";
import type { TimelineModel } from "@shared/types";

const EMPTY_MODEL: TimelineModel = { user: [], assistant: [] };

describe("TimelineRail", () => {
  test("emits track percent click in percent mode", () => {
    const onTrackPercentClick = vi.fn();
    const rail = new TimelineRail({
      onTrackPercentClick,
      onMarkerClick: vi.fn(),
      onModeStepUp: vi.fn(),
      onModeStepDown: vi.fn()
    });
    rail.update(EMPTY_MODEL, "percentNearest");

    const track = rail.element.querySelector<HTMLElement>("[data-id='track']");
    expect(track).toBeTruthy();
    Object.defineProperty(track!, "getBoundingClientRect", {
      value: () => ({ top: 0, left: 0, width: 10, height: 100, right: 10, bottom: 100, x: 0, y: 0, toJSON: () => ({}) })
    });

    track!.dispatchEvent(new MouseEvent("click", { bubbles: true, clientY: 75 }));
    expect(onTrackPercentClick).toHaveBeenCalledWith(0.75);
  });

  test("suppresses track click in markers-only mode", () => {
    const onTrackPercentClick = vi.fn();
    const rail = new TimelineRail({
      onTrackPercentClick,
      onMarkerClick: vi.fn(),
      onModeStepUp: vi.fn(),
      onModeStepDown: vi.fn()
    });
    rail.update(EMPTY_MODEL, "markersOnly");

    const track = rail.element.querySelector<HTMLElement>("[data-id='track']");
    expect(track).toBeTruthy();
    Object.defineProperty(track!, "getBoundingClientRect", {
      value: () => ({ top: 0, left: 0, width: 10, height: 100, right: 10, bottom: 100, x: 0, y: 0, toJSON: () => ({}) })
    });

    track!.dispatchEvent(new MouseEvent("click", { bubbles: true, clientY: 50 }));
    expect(onTrackPercentClick).not.toHaveBeenCalled();
  });
});
