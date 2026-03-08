# PromptDrive Requested Functionality

Last updated: 2026-03-08

## Core UX
- [x] Works on `chatgpt.com` conversation pages.
- [x] Top compact integrated toolbar under ChatGPT header.
- [x] Right timeline rail with clickable markers.
- [x] Two sets of arrows:
  - [x] Top horizontal direct mode arrows (`Any`, `You`, `AI`).
  - [x] Vertical rail arrows for current selected mode.

## Navigation Behavior
- [x] Modes: `Combined`, `You`, `Assistant`.
- [x] Position counter (`current / total`).
- [x] Message jump centers message start in viewport.
- [x] Keyboard shortcuts (`Alt+J` down, `Alt+K` up, `Alt+H` hide/show).
- [x] Carousel boundary interaction:
  - [x] First boundary press highlights.
  - [x] Second same-direction press wraps to opposite end.
- [x] Navigation uses current viewport position as anchor.

## Timeline
- [x] Marker click jumps to message.
- [x] Marker-only mode shows bookmark markers only.
- [x] Bookmark markers visually distinct from regular message lines.
- [x] Boundary highlight propagates to vertical arrows.

## Bookmarks
- [x] Add whole-message bookmark (`+ Msg`).
- [x] Add selection bookmark (`+ Sel`).
- [x] Bookmark list panel with click-to-jump.
- [x] Delete bookmark from list.
- [x] Bookmark persistence in `chrome.storage.local`.
- [x] Branch-aware bookmark transfer.
- [x] Selection bookmark jump attempts exact selected-text location.
- [x] Selection bookmark briefly highlights the exact selected text after jump.
- [x] Delete-all bookmarks action with confirmation dialog.

## Stats and Help
- [x] Live stats chips: your msgs, your words, first, last, idle.
- [x] Tooltip hints on controls.
- [x] `n/a` explanation added to timestamp/idle stats tooltips.
- [x] Tiny GitHub repo link in top bar.
- [x] Bookmark list toggle uses stable width to avoid shifting nearby buttons.
- [x] Control groups visually separated for easier scanning.

## Hide/Recover
- [x] Hide all PromptDrive UI.
- [x] Restore button always available (`Show Bars`).
- [x] Extension popup includes `Show Bars` and `Toggle Bars` actions.

## Open Follow-up Checklist
- [ ] Validate exact text-range jump reliability across very long markdown/code blocks.
- [ ] Validate right-rail offset against all ChatGPT layout variants (sidebar collapsed/expanded, narrow width).
- [ ] Validate boundary highlight consistency in every mode after manual scrolling.
