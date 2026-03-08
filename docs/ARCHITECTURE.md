# PromptDrive Architecture

## Design Principles

1. Keep domain logic separated from DOM selectors.
2. Keep UI controls thin; push behavior into services.
3. Use explicit shared types for cross-module boundaries.
4. Avoid deep inheritance or unneeded abstractions.
5. Prefer incremental, testable services.

## Runtime Flow

1. `main.ts` boots on `chatgpt.com`.
2. `ChatAdapter` reads chat messages from DOM.
3. `NavigatorService` resolves next/prev/jump targets.
4. `TopBar`, `TimelineRail`, and `StepDot` emit user intents.
5. `PromptDriveStore` holds UI/application state.
6. `StatsService` calculates live stats from parsed messages.
7. `BookmarkService` persists bookmarks and transfers branch matches.
8. `TimelineService` converts messages/bookmarks to lane markers.

## Module Responsibilities

## `dom/chatAdapter.ts`
- DOM selectors and extraction logic only.
- Safe offset helpers for top header and composer.
- Progressive history loading attempts.

## `navigation/navigator.ts`
- Mode and keyword filtered navigation.
- Percent-based lane jump.
- Centered scroll + current message tracking.

## `ui/topBar.ts`
- Docked adjustment bar.
- Mode/direction/edge/filter controls.
- Live stats and bookmark action controls.

## `ui/timelineRail.ts`
- Dual lanes for user and assistant turns.
- Marker rendering and click handling.

## `ui/stepDot.ts`
- Quick step action.
- Long press toggles direction.

## `bookmarks/*`
- Text anchor building and resolution.
- Local persistence.
- Branch-aware copy-on-match.

## `stats/statsService.ts`
- User message and word counts.
- First/last timestamps.
- Idle time from last timestamp.

## `style/themeBridge.ts`
- Reads live theme hints and maps to PromptDrive CSS variables.

## `state/store.ts`
- Central reactive state with subscribe/set semantics.

## Extension Storage

- `promptdrive.bookmarks`:
  - Array of message/text bookmarks.
  - Used for persistence and branch transfer.

## Performance Notes

1. Mutation updates are throttled.
2. Timeline markers are sampled for large chats.
3. History loading retries are bounded.
4. Stats and timeline derive from a single refreshed message snapshot.

## Maintenance Checklist

1. If ChatGPT DOM changes, update selectors only in `chatAdapter.ts`.
2. Add tests for any selector or navigation behavior changes.
3. Keep top bar and rail UI logic separate from data services.
4. Ensure new features do not bypass shared types.
5. Keep `README.md` and this file aligned with behavior changes.
