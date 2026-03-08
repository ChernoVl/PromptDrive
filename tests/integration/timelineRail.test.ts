import { describe, expect, test, vi } from "vitest";
import { TimelineRail } from "@content/ui/timelineRail";
import type { TimelineModel } from "@shared/types";

const EMPTY_MODEL: TimelineModel = { user: [], assistant: [] };

describe("TimelineRail", () => {
  test("emits lane percent click in percent mode", () => {
    const onLanePercentClick = vi.fn();
    const rail = new TimelineRail({
      onLanePercentClick,
      onMarkerClick: vi.fn()
    });
    rail.update(EMPTY_MODEL, "percentNearest");

    const userLane = rail.element.querySelector<HTMLElement>("[data-lane='user']");
    expect(userLane).toBeTruthy();
    Object.defineProperty(userLane!, "getBoundingClientRect", {
      value: () => ({ top: 0, left: 0, width: 10, height: 100, right: 10, bottom: 100, x: 0, y: 0, toJSON: () => ({}) })
    });

    userLane!.dispatchEvent(new MouseEvent("click", { bubbles: true, clientY: 75 }));
    expect(onLanePercentClick).toHaveBeenCalledWith("user", 0.75);
  });

  test("suppresses lane click in markers-only mode", () => {
    const onLanePercentClick = vi.fn();
    const rail = new TimelineRail({
      onLanePercentClick,
      onMarkerClick: vi.fn()
    });
    rail.update(EMPTY_MODEL, "markersOnly");

    const assistantLane = rail.element.querySelector<HTMLElement>("[data-lane='assistant']");
    expect(assistantLane).toBeTruthy();
    Object.defineProperty(assistantLane!, "getBoundingClientRect", {
      value: () => ({ top: 0, left: 0, width: 10, height: 100, right: 10, bottom: 100, x: 0, y: 0, toJSON: () => ({}) })
    });

    assistantLane!.dispatchEvent(new MouseEvent("click", { bubbles: true, clientY: 50 }));
    expect(onLanePercentClick).not.toHaveBeenCalled();
  });
});
