const THEME_ATTRIBUTE = "data-theme";

function parseRgbComponents(value: string): [number, number, number] | null {
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match?.[1]) {
    return null;
  }

  const channels = match[1]
    .split(",")
    .slice(0, 3)
    .map((component) => Number.parseInt(component.trim(), 10));

  if (channels.length < 3 || channels.some((component) => Number.isNaN(component))) {
    return null;
  }

  const r = channels[0];
  const g = channels[1];
  const b = channels[2];

  if (r === undefined || g === undefined || b === undefined) {
    return null;
  }

  return [r, g, b];
}

function luminanceFromRgb(value: string): number | null {
  const channels = parseRgbComponents(value);
  if (!channels) {
    return null;
  }

  const r = channels[0] / 255;
  const g = channels[1] / 255;
  const b = channels[2] / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export class ThemeBridge {
  private readonly rootStyle = document.documentElement.style;

  sync(): void {
    const computed = getComputedStyle(document.body);
    const bg = computed.backgroundColor || "rgb(32, 33, 36)";
    const fg = computed.color || "rgb(237, 237, 237)";
    const lum = luminanceFromRgb(bg);
    const dark = lum === null ? true : lum < 0.5;
    const surface = dark ? "rgba(20, 22, 26, 0.72)" : "rgba(255, 255, 255, 0.78)";
    const border = dark ? "rgba(255, 255, 255, 0.14)" : "rgba(0, 0, 0, 0.12)";
    const muted = dark ? "rgba(231, 233, 235, 0.7)" : "rgba(33, 36, 41, 0.67)";

    this.rootStyle.setProperty("--pd-surface", surface);
    this.rootStyle.setProperty("--pd-border", border);
    this.rootStyle.setProperty("--pd-text", fg);
    this.rootStyle.setProperty("--pd-muted", muted);
    this.rootStyle.setProperty("--pd-accent", dark ? "rgba(146, 195, 255, 0.85)" : "rgba(27, 112, 214, 0.85)");
    this.rootStyle.setProperty("--pd-bg", bg);
  }

  observe(): MutationObserver {
    this.sync();
    const observer = new MutationObserver(() => this.sync());
    observer.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ["class", THEME_ATTRIBUTE]
    });
    return observer;
  }
}
