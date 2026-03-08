# PromptDrive Agent Instructions

## Goal
Ship stable, minimal, ChatGPT-native navigation UX with readable, maintainable TypeScript.

## Non-Negotiables
- Keep UI integrated with ChatGPT theme and spacing.
- Navigation must always be relative to the message currently in view.
- Selection bookmarks must return to the exact selected place, not only message container.
- Boundary behavior: first press highlights boundary, second press wraps (carousel).
- Hide/unhide must always be recoverable without refresh.

## Quality Bar
- Prefer small, named functions over long inlined logic.
- Keep selectors and DOM contracts centralized where possible.
- Avoid breaking existing behavior when fixing one issue.
- Add tooltips/titles for controls that are not self-explanatory.

## Verification Before Commit
1. `npx tsc --noEmit`
2. `npm test`
3. `npm run build`

## Knowledge Persistence
- Update `docs/REQUESTED_FUNCTIONALITY.md` whenever user reports issue/change.
- Record: request, expected behavior, implementation status, and follow-up notes.
