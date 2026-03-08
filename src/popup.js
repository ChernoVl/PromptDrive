function setStatus(message) {
  const status = document.querySelector("[data-id='status']");
  if (!(status instanceof HTMLElement)) {
    return;
  }

  status.textContent = message;
}

async function sendToActiveTab(type) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) {
    setStatus("No active tab found.");
    return;
  }

  chrome.tabs.sendMessage(activeTab.id, { type }, () => {
    if (chrome.runtime.lastError) {
      setStatus("Open an active chat page and try again.");
      return;
    }

    window.close();
  });
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    const action = button.getAttribute("data-action");
    if (!action) {
      return;
    }

    if (action === "show") {
      await sendToActiveTab("promptdrive.show");
      return;
    }

    if (action === "toggle") {
      await sendToActiveTab("promptdrive.toggle");
    }
  });
});
