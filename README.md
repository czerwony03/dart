# 🎯 Dart 501

A mobile-friendly dart scoring web app with real-time multiplayer support.

![Deploy](https://github.com/czerwony03/dart/actions/workflows/deploy.yml/badge.svg)

## Features

- **Game modes** — 501 and 301 starting scores with single-out or double-out finish
- **Interactive dartboard** — tap segments directly or enter scores manually
- **Checkout hints** — automatically suggests throw combinations to finish the leg
- **Multiplayer** — share a game by link or room code (`XXXX-XXXX`); all players stay in sync in real time (polling every second)
- **Player history** — per-player score history for the current game, with average round score
- **Undo** — step back through individual throws and across player turns
- **Rematch** — restart with the same players in a shuffled order
- **Persistence** — games are saved in `localStorage` so you can resume after closing the tab
- **Bilingual UI** — full English and Polish translations
- **Accessibility** — aria-live refresh announcements, screen-reader labels, keyboard navigation

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Plain CSS (`src/style.css`) |
| Backend | PHP (`game.php`) — flat-file JSON store |
| Monitoring | Sentry (frontend + backend) |
| Hosting | GitHub Pages (frontend) |

## Getting started

### Prerequisites

- Node.js ≥ 18
- npm

### Run locally

```bash
npm install
npm run dev
```

The app is served at `http://localhost:5173`.

### Build for production

```bash
npm run build   # outputs to dist/
npm run preview # preview the production build locally
```

## Deployment

Pushes to `main`/`master` automatically trigger the **Deploy to GitHub Pages** workflow, which builds the app with Vite and publishes the `dist/` folder.

The live app is available at: **https://czerwony03.github.io/dart/**

## Multiplayer backend

`game.php` is a lightweight PHP sync endpoint that stores game state as JSON files.

| Request | Description |
|---|---|
| `GET ?id=<gameId>` | Fetch stored game state |
| `GET ?code=<XXXX-XXXX>` | Resolve a room code to a game ID |
| `POST {id, state}` | Save game state (last-write-wins) |
| `POST {code, gameId}` | Register / update a room-code mapping |

Files are pruned automatically after 24 hours. Deploy `game.php` on any PHP host and set the `API_BASE` constant in the frontend to point at it.

## Project structure

```
src/
  main.tsx            # App entry point
  App.tsx             # Root component and routing
  types.ts            # Shared TypeScript types
  game.ts             # Game logic (scoring, bust detection, win check)
  checkout.ts         # Checkout hint calculator
  api.ts              # Backend sync helpers
  storage.ts          # localStorage persistence
  translations.ts     # EN / PL string map
  context.ts          # Language context
  constants.ts        # Shared constants
  style.css           # Global styles
  components/
    Dartboard.tsx     # Interactive SVG dartboard
    HomeScreen.tsx    # Game list / home
    SetupScreen.tsx   # New game configuration
    GameScreen.tsx    # Active game UI
    WinScreen.tsx     # Win / rematch screen
    ShareModal.tsx    # Room-code sharing dialog
    Toast.tsx         # Transient notification banner
game.php              # Multiplayer sync backend
```

## Contributing

1. Fork the repo and create a feature branch.
2. Run `npm run dev` to work locally.
3. Commit your changes with a descriptive message.
4. Open a pull request — the CI build will verify the TypeScript compilation and Vite build.