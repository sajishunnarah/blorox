# Blorox

Blorox is a fully web-based game platform prototype: accounts and guest play, a game studio, marketplace listings, realtime rooms, and three built-in games.

## Run Locally

```bash
npm start
```

Open `http://localhost:8080`.

The app has no package dependencies. It uses Node's built-in HTTP stack and a small WebSocket implementation in `server.js`. Three.js loads from a CDN for rich 3D rendering; if it is unavailable, the games fall back to a canvas renderer so the platform remains playable.

## Built-In Games

- **Party Cards: After Hours**: UI-based social card game with judge rotation, bots, and room sync.
- **Nightfall Island**: single-player 3D horror quest with NPCs, stealth, inventory, and a dusk timer.
- **Xenu Depths**: randomized co-op roguelite about reaching the deepest chamber before the party is escorted out.

## Platform Features

- Guest play or registered accounts.
- Non-premium users can publish up to five games.
- Marketplace for free or credit-priced assets and clothing.
- Browser-based studio with scene objects, scripting, sounds, publish/playtest flow.
- Realtime WebSocket rooms for chat, presence, studio collaboration, and multiplayer state.

## Deployment

See [DEPLOY.md](DEPLOY.md).
