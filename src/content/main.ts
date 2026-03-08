(() => {
  if (!location.hostname.includes("chatgpt.com")) {
    return;
  }

  console.info("PromptDrive loaded");
})();