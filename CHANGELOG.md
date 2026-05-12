# Changelog

All notable changes to this project are documented here, organized by pull request.

---

## [PR #32] – 2026-05-12 · Don't show share card after rematch
- Removed the share modal auto-open that was triggered when a rematch session starts.

## [PR #31] – 2026-05-12 · Resync game state on share button click
- Game state and room code are now re-sent to the backend whenever the share button is clicked, preventing stale/desynced sessions.

## [PR #30] – 2026-05-12 · Report backend errors to Sentry
- All PHP errors, warnings, and user-facing problems in `game.php` are now reported to Sentry for observability.

## [PR #29] – 2026-05-12 · Room code sharing (XXXX-XXXX)
- Added human-readable room codes in `XXXX-XXXX` format.
- New share modal lets players share a game by code.
- Players can join an existing game by entering a room code.
- Fixed: `remote.roomCode` is now used only in the join-by-code URL parameter.

## [PR #28] – 2026-05-12 · Migrate to TypeScript + Vite
- Rewrote the frontend from a single-file React/Babel `index.html` to a modular TypeScript + Vite application.
- Components extracted to `src/components/`, styles to `src/style.css`, entry point at `src/main.tsx`.
- Build output goes to `dist/` via `npm run build`.
- Updated `deploy.yml` for the Vite build pipeline and configured the correct GitHub Pages base path.

## [PR #27] – 2026-05-11 · Spinning refresh button with accessibility feedback
- Added an animated spinning refresh button with a force-refresh action.
- Queued and completed refresh states are surfaced in the UI.
- `aria-live` region announces refresh status for screen readers.
- Added a same-game retry guard and capped the number of queued forced refreshes.
- Extracted refresh timing constants and reset stale refresh queues.

## [PR #26] – 2026-05-11 · Keep app in sync after screen wake
- Added an immediate backend refresh when the app wakes (device unlock, visibility change, `pageshow` from bfcache).
- Wake-triggered refresh requests are debounced via a named throttle constant.
- `pageshow` refresh only fires when the page is restored from the back/forward cache.

## [PR #25] – 2026-05-11 · Player selection prompt for shared sessions
- Players joining a shared game session are now prompted to select their identity from the participant list.
- This ensures the correct player's turn is tracked across devices.
- Extracted turn-state helpers and tidied player selection state; cleaned up vibration and prompt logic.

## [PR #24] – 2026-05-11 · Remove 4-player cap
- Lifted the hard limit of 4 players in the game setup.
- Any number of players greater than four is now supported in both setup and rematch flows.

## [PR #23] – 2026-04-17 · Include language in shared game URLs
- The current UI language is now embedded in the shareable game URL so recipients open the game in the same language.
- Centralized the valid language list for URL parsing.
- Simplified URL normalization and share query building.

## [PR #22] – 2026-04-17 · Bigger double and triple hit areas
- Slightly increased the tappable hit areas for double and triple segments on the dartboard SVG.

## [PR #21] – 2026-04-17 · Show remaining score beside turn total
- The player's remaining points are now displayed as a small number next to their current turn score, making it easier to track progress without mentally subtracting.

## [PR #20] – 2026-04-17 · Fix player name suggestions and checkout hints
- Player name suggestions in the setup screen are now backed by a `localStorage`-driven `<datalist>`.
- Fixed checkout hint calculation: added single-out support and extracted a `calculateCheckout` helper function.

## [PR #19] – 2026-04-17 · Fix player shuffle in rematch
- Shuffle now reliably changes the player order during a rematch.
- The shuffle source list is reset on each retry attempt.

## [PR #18] – 2026-04-17 · Redirect synced players to successor game
- After a shared game ends and a rematch is started, all synced players are automatically redirected to the new game URL.
- Hardened successor-redirect checks and clarified the early return in the polling loop.

## [PR #17] – 2026-04-17 · Player shuffle button
- Added a shuffle button to the setup screen and the rematch flow so players can randomize their order before the game begins.
- Improved shuffle button accessibility and added input validation.

## [PR #16] – 2026-04-17 · Fix checkout suggestions and win validation
- Normalized the finish mode (single-out / double-out) used for both checkout suggestions and win-condition validation, fixing a mismatch that could allow invalid wins.

## [PR #15] – 2026-04-17 · Fix player score history persistence
- Fixed player history not being saved correctly across backend syncs.

## [PR #14] – 2026-04-17 · Player history modal
- Added a per-player history modal showing all scores from the current game.
- Added an "all players" history button to view every player's history in one place.

## [PR #13] – 2026-04-17 · Invert dartboard segment colors
- Swapped the white and black segment colors on the dartboard SVG for better visual contrast.

## [PR #12] – 2026-04-17 · Real-time backend polling every second
- The frontend now polls the backend for game state every second, enabling near-real-time multiplayer synchronization.

## [PR #11] – 2026-04-17 · Clean shareable URL
- Game URLs are normalized to contain only the game-related query parameters, stripping any unrelated params.
- Multiple iterations refined the normalization logic to be explicit, canonical, and robust against edge cases.

## [PR #10] – 2026-04-17 · Multiplayer backend sync
- Added a PHP backend (`game.php`) that stores and serves shared game state.
- Frontend now generates a random game ID, syncs state to the backend, and polls for updates.
- Integrated the Sentry PHP SDK into `game.php` for backend error reporting.
- Backend API URL updated to the production `redtm.pl` endpoint.

## [PR #9] – 2026-04-17 · Fix localStorage quota exceeded error
- Fixed a crash caused by `localStorage` overflowing when saving active game state.
- The fix omits recursive history from autosave payloads and guards against null payload overwrites.

## [PR #8] – 2026-04-17 · Sentry error monitoring
- Integrated Sentry for automatic error and warning reporting from the frontend.
- Fixed Sentry message level usage and prevented duplicate `unhandledrejection` reports.

## [PR #7] – 2026-03-25 · Player list with averages on home screen
- The game history list on the home screen now shows the participating players and their average round scores for each past game.

## [PR #6] – 2026-03-25 · Game modes and checkout hints
- Added support for **501** and **301** starting scores.
- Added **single-out** and **double-out** finish modes.
- Added checkout hint suggestions showing the recommended throw combinations to finish.

## [PR #5] – 2026-03-25 · English / Polish language selector
- Added a language selector to switch the entire UI between English and Polish.

## [PR #4] – 2026-03-25 · Player average round score
- Each player's score card now displays their average score per round across the current game.

## [PR #3] – 2026-03-25 · Undo across player turns
- Undo now steps back through previous players' turns, not just the current player's throws.

## [PR #2] – 2026-03-25 · Bigger dartboard
- Increased the maximum size of the dartboard SVG from 340 px to 460 px for easier tapping on mobile.

## [PR #1] – 2026-03-25 · Initial release
- Created the Dart 501 mobile web game as a single HTML file.
- Rewrote as a React app with `localStorage` game persistence and session IDs.
- Fixed `genId` to use `crypto.randomUUID()` with a fallback.
- Added a GitHub Pages deployment workflow triggered on pushes to `main`/`master`.
