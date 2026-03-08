# PromptDrive

PromptDrive is a Chrome extension for `chatgpt.com` that makes long conversations easier to navigate.

## Features

- Top docked control bar integrated with ChatGPT layout.
- Navigation modes: `Combined`, `You`, `Assistant`.
- Keyboard shortcuts: `Alt+J` (down), `Alt+K` (up).
- Right-side dual timeline lanes for `You` and `Assistant`.
- Percent click jump (or marker-only mode).
- Bottom-right step button with long-press direction flip.
- Live stats: your message count, your word count, first/last timestamp, idle time.
- Bookmarks:
  - Whole-message bookmarks.
  - Selected-text bookmarks.
  - Persistent in `chrome.storage.local`.
  - Auto-transfer across branched chats by fingerprint overlap.
- Progressive loading for long chat history.

## Local Development

```bash
npm install
npm run build
```

Build output is generated in `dist/`.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the `dist/` directory.

## Project Structure

- `src/manifest.json`: MV3 extension manifest.
- `src/content/main.ts`: app bootstrap and wiring.
- `src/content/dom`: ChatGPT DOM extraction adapter.
- `src/content/navigation`: navigation engine.
- `src/content/ui`: top bar, timeline rail, step button.
- `src/content/bookmarks`: bookmark persistence and text anchors.
- `src/content/stats`: live chat stats service.
- `src/content/timeline`: marker generation for rail rendering.
- `src/content/style`: theme adaptation bridge.
- `src/content/state`: central state store.
- `src/shared`: shared types and fingerprint utilities.
- `tests`: unit and integration tests.

## Testing

```bash
npm test
```

Type checks:

```bash
npx tsc --noEmit
```
