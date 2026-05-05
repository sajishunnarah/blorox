# Blorox

Blorox is a fully web-based game platform prototype: accounts and guest play, a game studio, marketplace listings, realtime rooms, and three built-in games.

## Run Locally

```bash
npm start
```

Open `http://localhost:8080`.

The app has no package dependencies. It uses Node's built-in HTTP stack and a small WebSocket implementation in `server.js`. Three.js loads from a CDN for rich 3D rendering; if it is unavailable, the games fall back to a canvas renderer so the platform remains playable.

## Client Structure

- `public/app.js`: platform shell, account flows, studio UI, marketplace, rooms, and non-island game mounting.
- `public/engine3d.js`: reusable Three.js/canvas scene renderer used by studio, creator worlds, and the roguelite.
- `public/nightfall-island.js`: dedicated Three.js horror adventure with terrain, buildings/interiors, NPC quests, stealth, patrol/chase AI, inventory, and escape progression.
- `public/three-loader.js`: resilient Three.js loader for browser modules.
- `public/assets/`: hand-authored SVG cover art and the asset manifest used by game cards and the platform UI.

## Live Deployment

Current public URL: `http://blorox.50.116.38.29.sslip.io`

The deployed service is proxied by nginx to the same Node/WebSocket process, so multiplayer rooms use the same origin as the web app.

## Built-In Games

- **Party Cards: After Hours**: UI-based social card game with judge rotation, bots, and room sync.
- **Nightfall Island**: Three.js-first single-player horror adventure with a navigable island, buildings, NPC quest chains, inventory, stealth/stamina, patrol/chase AI, fail/restart, and escape win state.
- **Xenu Depths**: randomized co-op roguelite about reaching the deepest chamber before the party is escorted out.

## Platform Features

- Guest play or registered accounts.
- Non-premium users can publish up to five games.
- Marketplace for free or credit-priced assets and clothing.
- Browser-based studio with scene objects, scripting, sounds, publish/playtest flow.
- Realtime WebSocket rooms for chat, presence, studio collaboration, and multiplayer state.

## Deployment

See [DEPLOY.md](DEPLOY.md).
