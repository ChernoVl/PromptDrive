import { ChatAdapter } from "@content/dom/chatAdapter";
import { MessageHighlighter } from "@content/highlight/highlighter";
import { NavigatorService } from "@content/navigation/navigator";
import type { NavMode, StepDirection } from "@shared/types";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "TEXTAREA" ||
    (target.tagName === "INPUT" &&
      (target as HTMLInputElement).type !== "button" &&
      (target as HTMLInputElement).type !== "checkbox")
  );
}

async function bootstrap(): Promise<void> {
  if (!location.hostname.includes("chatgpt.com")) {
    return;
  }

  const adapter = new ChatAdapter();
  const highlighter = new MessageHighlighter();
  const navigator = new NavigatorService(adapter, highlighter);

  let mode: NavMode = "combined";
  let filterKeyword = "";
  let direction: StepDirection = "down";

  navigator.refresh();

  window.addEventListener("keydown", async (event) => {
    if (!event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    if (event.key.toLowerCase() === "j") {
      event.preventDefault();
      direction = "down";
      await navigator.step(mode, "down", filterKeyword);
      return;
    }

    if (event.key.toLowerCase() === "k") {
      event.preventDefault();
      direction = "up";
      await navigator.step(mode, "up", filterKeyword);
      return;
    }

    if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      mode = mode === "combined" ? "user" : mode === "user" ? "assistant" : "combined";
      const position = navigator.getPosition(mode, filterKeyword);
      console.info("PromptDrive mode changed", { mode, position, direction });
    }

    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      filterKeyword = "";
      console.info("PromptDrive filter cleared");
    }
  });

  const observer = new MutationObserver(() => {
    navigator.refresh();
  });

  observer.observe(document.body, { subtree: true, childList: true });
}

void bootstrap();
