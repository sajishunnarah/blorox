import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const dataDir = path.resolve(__dirname, process.env.BLOROX_DATA_DIR || "data");
const dbPath = path.join(dataDir, "state.json");
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 8080);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg"
};

const builtInGames = [
  {
    id: "builtin-cards",
    title: "Party Cards: After Hours",
    genre: "Cards",
    description: "A fully UI-driven social card game with judge rotation, bots, and realtime rooms.",
    thumbnail: "cards",
    creatorId: "system",
    builtIn: true,
    public: true,
    plays: 0,
    likes: 0,
    tags: ["party", "ui", "multiplayer"],
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    scene: { objects: [] },
    script: "round: judge chooses funniest response"
  },
  {
    id: "builtin-island",
    title: "Nightfall Island",
    genre: "3D Horror",
    description: "A quest-heavy single-player escape from a private island before dusk falls.",
    thumbnail: "island",
    creatorId: "system",
    builtIn: true,
    public: true,
    plays: 0,
    likes: 0,
    tags: ["3d", "horror", "quest"],
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    scene: {
      objects: [
        { kind: "spawn", x: 0, y: 0, z: 8 },
        { kind: "npc", name: "Professor Hawking", x: -8, y: 0, z: -3 },
        { kind: "npc", name: "Marina", x: 11, y: 0, z: 3 },
        { kind: "hazard", name: "Epstein", x: 0, y: 0, z: -10 }
      ]
    },
    script: "quest: collect battery, fuse, key, ledger, flare; escape before night"
  },
  {
    id: "builtin-xenu",
    title: "Xenu Depths",
    genre: "3D Roguelite",
    description: "A randomized co-op descent through guarded Scientology buildings to reach Xenu.",
    thumbnail: "xenu",
    creatorId: "system",
    builtIn: true,
    public: true,
    plays: 0,
    likes: 0,
    tags: ["3d", "roguelite", "co-op"],
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    scene: {
      objects: [
        { kind: "spawn", x: 0, y: 0, z: 0 },
        { kind: "goal", name: "Xenu chamber", x: 0, y: -12, z: 0 }
      ]
    },
    script: "floor: randomize guards, locked doors, auditors, elevators; win at depth 12"
  }
];

const seedAssets = [
  {
    id: "asset-neon-hoodie",
    name: "Neon Runner Hoodie",
    type: "clothing",
    price: 35,
    description: "Avatar hoodie with emissive trim.",
    creatorId: "system",
    creatorName: "Blorox",
    downloads: 82,
    public: true,
    swatch: "#39d98a",
    createdAt: "2026-05-04T00:00:00.000Z"
  },
  {
    id: "asset-fog-machine",
    name: "Volumetric Fog Rig",
    type: "effect",
    price: 0,
    description: "Drop-in fog preset for horror scenes.",
    creatorId: "system",
    creatorName: "Blorox",
    downloads: 147,
    public: true,
    swatch: "#a8b3cf",
    createdAt: "2026-05-04T00:00:00.000Z"
  },
  {
    id: "asset-card-table",
    name: "Round Card Table UI",
    type: "ui",
    price: 12,
    description: "Responsive table shell for party games.",
    creatorId: "system",
    creatorName: "Blorox",
    downloads: 61,
    public: true,
    swatch: "#f2b84b",
    createdAt: "2026-05-04T00:00:00.000Z"
  },
  {
    id: "asset-office-kit",
    name: "Procedural Office Kit",
    type: "3d",
    price: 50,
    description: "Walls, doors, elevators, guards, and desk props.",
    creatorId: "system",
    creatorName: "Blorox",
    downloads: 103,
    public: true,
    swatch: "#ff6b6b",
    createdAt: "2026-05-04T00:00:00.000Z"
  }
];

let db = await loadDb();
const clients = new Map();
const rooms = new Map();
const roomState = new Map();

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

function cleanText(value, max = 160) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizePrice(value) {
  const price = Number(value || 0);
  if (!Number.isFinite(price)) return 0;
  return Math.max(0, Math.min(9999, Math.round(price)));
}

async function loadDb() {
  await fs.mkdir(dataDir, { recursive: true });
  if (!fsSync.existsSync(dbPath)) {
    const initial = {
      users: [
        {
          id: "system",
          username: "Blorox",
          displayName: "Blorox",
          guest: false,
          premium: true,
          credits: 100000,
          inventory: [],
          passwordHash: null,
          createdAt: now()
        }
      ],
      sessions: {},
      games: builtInGames,
      assets: seedAssets,
      audit: []
    };
    await fs.writeFile(dbPath, JSON.stringify(initial, null, 2));
    return initial;
  }

  const loaded = JSON.parse(await fs.readFile(dbPath, "utf8"));
  loaded.users ||= [];
  loaded.sessions ||= {};
  loaded.games ||= [];
  loaded.assets ||= [];
  loaded.audit ||= [];
  for (const user of loaded.users) {
    user.inventory = Array.isArray(user.inventory) ? user.inventory : [];
    user.credits = Number(user.credits || 0);
  }

  for (const game of builtInGames) {
    if (!loaded.games.some((item) => item.id === game.id)) loaded.games.push(game);
  }
  for (const asset of seedAssets) {
    if (!loaded.assets.some((item) => item.id === asset.id)) loaded.assets.push(asset);
  }
  if (!loaded.users.some((user) => user.id === "system")) {
    loaded.users.unshift({
      id: "system",
      username: "Blorox",
      displayName: "Blorox",
      guest: false,
      premium: true,
      credits: 100000,
      inventory: [],
      passwordHash: null,
      createdAt: now()
    });
  }
  await saveDb(loaded);
  return loaded;
}

async function saveDb(nextDb = db) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(nextDb, null, 2));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const attempt = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempt, "hex"));
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    guest: Boolean(user.guest),
    premium: Boolean(user.premium),
    credits: Number(user.credits || 0),
    inventoryCount: Array.isArray(user.inventory) ? user.inventory.length : 0,
    createdAt: user.createdAt
  };
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString("base64url");
  db.sessions[token] = { userId, createdAt: now(), expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30 };
  return token;
}

function authFromRequest(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = token ? db.sessions[token] : null;
  if (!session || session.expiresAt < Date.now()) return { token: null, user: null };
  const user = db.users.find((item) => item.id === session.userId);
  return { token, user };
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1024 * 1024) throw new Error("Payload too large");
  }
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

async function handleApi(req, res, url) {
  try {
    const { user } = authFromRequest(req);
    const route = `${req.method} ${url.pathname}`;

    if (route === "POST /api/auth/guest") {
      const body = await readJson(req);
      const nickname = cleanText(body.nickname || "Guest", 28) || "Guest";
      const guestNumber = db.users.filter((item) => item.guest).length + 1;
      const guest = {
        id: createId("guest"),
        username: `${nickname.replace(/[^a-z0-9]/gi, "") || "Guest"}${guestNumber}`,
        displayName: nickname,
        guest: true,
        premium: false,
        credits: 50,
        inventory: [],
        passwordHash: null,
        createdAt: now()
      };
      db.users.push(guest);
      const token = createSession(guest.id);
      await saveDb();
      return sendJson(res, 200, { token, user: publicUser(guest) });
    }

    if (route === "POST /api/auth/register") {
      const body = await readJson(req);
      const username = cleanText(body.username, 24).replace(/[^a-z0-9_]/gi, "");
      const password = String(body.password || "");
      if (username.length < 3) return sendError(res, 400, "Username must be at least 3 characters.");
      if (password.length < 6) return sendError(res, 400, "Password must be at least 6 characters.");
      if (db.users.some((item) => item.username.toLowerCase() === username.toLowerCase())) {
        return sendError(res, 409, "Username is already taken.");
      }
      const account = {
        id: createId("user"),
        username,
        displayName: username,
        guest: false,
        premium: false,
        credits: 125,
        inventory: [],
        passwordHash: hashPassword(password),
        createdAt: now()
      };
      db.users.push(account);
      const token = createSession(account.id);
      await saveDb();
      return sendJson(res, 201, { token, user: publicUser(account) });
    }

    if (route === "POST /api/auth/login") {
      const body = await readJson(req);
      const username = cleanText(body.username, 24);
      const account = db.users.find((item) => item.username.toLowerCase() === username.toLowerCase());
      if (!account || !verifyPassword(body.password || "", account.passwordHash)) {
        return sendError(res, 401, "Invalid username or password.");
      }
      const token = createSession(account.id);
      await saveDb();
      return sendJson(res, 200, { token, user: publicUser(account) });
    }

    if (route === "GET /api/me") {
      if (!user) return sendError(res, 401, "Not signed in.");
      return sendJson(res, 200, {
        user: publicUser(user),
        games: db.games.filter((game) => game.creatorId === user.id),
        assets: db.assets.filter((asset) => asset.creatorId === user.id),
        inventory: db.assets
          .filter((asset) => (user.inventory || []).includes(asset.id))
          .map((asset) => ({
            ...asset,
            creatorName: db.users.find((item) => item.id === asset.creatorId)?.displayName || asset.creatorName || "Unknown"
          }))
      });
    }

    if (route === "POST /api/premium") {
      if (!user) return sendError(res, 401, "Not signed in.");
      user.premium = true;
      user.credits = Math.max(Number(user.credits || 0), 500);
      db.audit.push({ id: createId("audit"), action: "premium-upgrade", userId: user.id, createdAt: now() });
      await saveDb();
      return sendJson(res, 200, { user: publicUser(user) });
    }

    if (route === "GET /api/games") {
      const games = db.games
        .filter((game) => game.public || (user && game.creatorId === user.id))
        .map((game) => ({
          ...game,
          creatorName: db.users.find((item) => item.id === game.creatorId)?.displayName || "Unknown"
        }))
        .sort((a, b) => Number(Boolean(b.builtIn)) - Number(Boolean(a.builtIn)) || b.likes - a.likes);
      return sendJson(res, 200, { games });
    }

    if (route === "POST /api/games") {
      if (!user) return sendError(res, 401, "Not signed in.");
      const userGameCount = db.games.filter((game) => game.creatorId === user.id && !game.builtIn).length;
      if (!user.premium && userGameCount >= 5) {
        return sendError(res, 403, "Free creators can publish up to 5 games. Upgrade to premium to publish more.");
      }
      const body = await readJson(req);
      const game = {
        id: createId("game"),
        title: cleanText(body.title, 60) || "Untitled Game",
        genre: cleanText(body.genre, 32) || "Adventure",
        description: cleanText(body.description, 220) || "A Blorox creator experience.",
        thumbnail: body.thumbnail || "creator",
        creatorId: user.id,
        builtIn: false,
        public: body.public !== false,
        plays: 0,
        likes: 0,
        tags: Array.isArray(body.tags) ? body.tags.map((tag) => cleanText(tag, 18)).filter(Boolean).slice(0, 6) : ["creator"],
        createdAt: now(),
        updatedAt: now(),
        scene: sanitizeScene(body.scene),
        script: cleanText(body.script, 4000)
      };
      db.games.push(game);
      await saveDb();
      return sendJson(res, 201, { game });
    }

    const gameMatch = url.pathname.match(/^\/api\/games\/([^/]+)$/);
    if (req.method === "GET" && gameMatch) {
      const game = db.games.find((item) => item.id === gameMatch[1]);
      if (!game || (!game.public && (!user || user.id !== game.creatorId))) return sendError(res, 404, "Game not found.");
      game.plays = Number(game.plays || 0) + 1;
      await saveDb();
      return sendJson(res, 200, {
        game: {
          ...game,
          creatorName: db.users.find((item) => item.id === game.creatorId)?.displayName || "Unknown"
        }
      });
    }

    if (req.method === "PATCH" && gameMatch) {
      if (!user) return sendError(res, 401, "Not signed in.");
      const game = db.games.find((item) => item.id === gameMatch[1]);
      if (!game || game.creatorId !== user.id) return sendError(res, 404, "Game not found.");
      const body = await readJson(req);
      game.title = cleanText(body.title ?? game.title, 60) || game.title;
      game.genre = cleanText(body.genre ?? game.genre, 32) || game.genre;
      game.description = cleanText(body.description ?? game.description, 220) || game.description;
      game.public = body.public !== false;
      game.scene = sanitizeScene(body.scene ?? game.scene);
      game.script = cleanText(body.script ?? game.script, 4000);
      game.updatedAt = now();
      await saveDb();
      return sendJson(res, 200, { game });
    }

    if (route === "GET /api/catalog") {
      const assets = db.assets
        .filter((asset) => asset.public)
        .map((asset) => ({
          ...asset,
          creatorName: db.users.find((item) => item.id === asset.creatorId)?.displayName || asset.creatorName || "Unknown"
        }))
        .sort((a, b) => Number(b.downloads || 0) - Number(a.downloads || 0));
      return sendJson(res, 200, { assets });
    }

    if (route === "POST /api/assets") {
      if (!user) return sendError(res, 401, "Not signed in.");
      const body = await readJson(req);
      const asset = {
        id: createId("asset"),
        name: cleanText(body.name, 60) || "Untitled Asset",
        type: cleanText(body.type, 24) || "asset",
        price: normalizePrice(body.price),
        description: cleanText(body.description, 220) || "A creator marketplace item.",
        creatorId: user.id,
        creatorName: user.displayName || user.username,
        downloads: 0,
        public: body.public !== false,
        swatch: /^#[0-9a-f]{6}$/i.test(body.swatch || "") ? body.swatch : randomSwatch(),
        createdAt: now()
      };
      db.assets.push(asset);
      await saveDb();
      return sendJson(res, 201, { asset });
    }

    const assetAcquireMatch = url.pathname.match(/^\/api\/assets\/([^/]+)\/acquire$/);
    if (req.method === "POST" && assetAcquireMatch) {
      if (!user) return sendError(res, 401, "Not signed in.");
      user.inventory = Array.isArray(user.inventory) ? user.inventory : [];
      const asset = db.assets.find((item) => item.id === assetAcquireMatch[1]);
      if (!asset || !asset.public) return sendError(res, 404, "Asset not found.");

      const alreadyOwned = user.inventory.includes(asset.id);
      if (!alreadyOwned) {
        const price = normalizePrice(asset.price);
        if (price > Number(user.credits || 0) && asset.creatorId !== user.id) {
          return sendError(res, 403, "Not enough credits for this item.");
        }
        if (price > 0 && asset.creatorId !== user.id) {
          user.credits = Number(user.credits || 0) - price;
          const seller = db.users.find((item) => item.id === asset.creatorId);
          if (seller) seller.credits = Number(seller.credits || 0) + price;
        }
        user.inventory.push(asset.id);
        asset.downloads = Number(asset.downloads || 0) + 1;
        db.audit.push({
          id: createId("audit"),
          action: "asset-acquire",
          userId: user.id,
          assetId: asset.id,
          price,
          createdAt: now()
        });
        await saveDb();
      }

      return sendJson(res, 200, {
        asset: {
          ...asset,
          creatorName: db.users.find((item) => item.id === asset.creatorId)?.displayName || asset.creatorName || "Unknown"
        },
        user: publicUser(user),
        owned: true,
        alreadyOwned
      });
    }

    if (route === "GET /api/stats") {
      return sendJson(res, 200, {
        users: db.users.length,
        games: db.games.length,
        assets: db.assets.length,
        acquisitions: db.audit.filter((entry) => entry.action === "asset-acquire").length,
        liveRooms: rooms.size,
        livePlayers: clients.size
      });
    }

    return sendError(res, 404, "Route not found.");
  } catch (error) {
    console.error(error);
    return sendError(res, error.message === "Payload too large" ? 413 : 500, "Server error.");
  }
}

function sanitizeScene(scene) {
  const objects = Array.isArray(scene?.objects) ? scene.objects : [];
  return {
    objects: objects.slice(0, 200).map((object) => ({
      kind: cleanText(object.kind, 24) || "block",
      name: cleanText(object.name, 48),
      x: clampNumber(object.x, -1000, 1000),
      y: clampNumber(object.y, -1000, 1000),
      z: clampNumber(object.z, -1000, 1000),
      color: /^#[0-9a-f]{6}$/i.test(object.color || "") ? object.color : undefined,
      script: cleanText(object.script, 400)
    }))
  };
}

function clampNumber(value, min, max) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(min, Math.min(max, number));
}

function randomSwatch() {
  const swatches = ["#39d98a", "#f2b84b", "#ff6b6b", "#61dafb", "#c084fc", "#f472b6"];
  return swatches[Math.floor(Math.random() * swatches.length)];
}

async function serveStatic(req, res, url) {
  const requestPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const normalized = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, normalized);
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("Not a file");
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "content-type": mime[ext] || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-cache" : "public, max-age=3600"
    });
    fsSync.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }
  await serveStatic(req, res, url);
});

server.on("upgrade", (req, socket) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }
    const accept = crypto
      .createHash("sha1")
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");

    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    const token = url.searchParams.get("token") || "";
    const session = db.sessions[token];
    const user = session ? db.users.find((item) => item.id === session.userId) : null;
    const room = cleanText(url.searchParams.get("room") || "lobby", 80) || "lobby";
    const client = {
      id: createId("client"),
      socket,
      buffer: Buffer.alloc(0),
      room,
      userId: user?.id || createId("anon"),
      name: user?.displayName || user?.username || `Visitor ${Math.floor(Math.random() * 900 + 100)}`,
      joinedAt: now()
    };
    clients.set(client.id, client);
    if (!rooms.has(room)) rooms.set(room, new Set());
    rooms.get(room).add(client.id);

    sendWs(client, {
      type: "welcome",
      clientId: client.id,
      room,
      state: roomState.get(room) || {},
      players: listRoomPlayers(room)
    });
    broadcast(room, { type: "presence", players: listRoomPlayers(room) });

    socket.on("data", (chunk) => {
      client.buffer = Buffer.concat([client.buffer, chunk]);
      const extracted = extractFrames(client.buffer);
      client.buffer = extracted.remaining;
      for (const frame of extracted.frames) {
        if (frame.opcode === 8) {
          socket.end();
          return;
        }
        if (frame.opcode === 9) {
          sendRaw(socket, Buffer.from(frame.payload), 10);
          continue;
        }
        if (frame.opcode !== 1) continue;
        handleWsMessage(client, frame.payload.toString("utf8"));
      }
    });
    socket.on("close", () => disconnect(client));
    socket.on("error", () => disconnect(client));
  } catch {
    socket.destroy();
  }
});

function handleWsMessage(client, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }

  if (message.type === "chat") {
    broadcast(client.room, {
      type: "chat",
      id: createId("chat"),
      player: client.name,
      text: cleanText(message.text, 240),
      createdAt: now()
    });
    return;
  }

  if (message.type === "state") {
    const current = roomState.get(client.room) || {};
    const next = {
      ...current,
      [cleanText(message.scope || "shared", 40)]: message.payload,
      updatedAt: now()
    };
    roomState.set(client.room, next);
    broadcast(client.room, {
      type: "state",
      senderId: client.id,
      scope: cleanText(message.scope || "shared", 40),
      payload: message.payload,
      updatedAt: next.updatedAt
    }, client.id);
    return;
  }

  if (message.type === "player") {
    broadcast(client.room, {
      type: "player",
      senderId: client.id,
      name: client.name,
      payload: message.payload
    }, client.id);
    return;
  }

  if (message.type === "cards" || message.type === "rogue-action") {
    const current = roomState.get(client.room) || {};
    roomState.set(client.room, {
      ...current,
      [message.type === "cards" ? "cards" : "rogue"]: message.payload,
      updatedAt: now()
    });
  }

  if (message.type === "studio-patch" || message.type === "cards" || message.type === "rogue-action") {
    broadcast(client.room, {
      type: message.type,
      senderId: client.id,
      player: client.name,
      payload: message.payload,
      createdAt: now()
    }, message.echo ? null : client.id);
  }
}

function disconnect(client) {
  if (!clients.has(client.id)) return;
  clients.delete(client.id);
  const members = rooms.get(client.room);
  if (members) {
    members.delete(client.id);
    if (members.size === 0) {
      rooms.delete(client.room);
      roomState.delete(client.room);
    } else {
      broadcast(client.room, { type: "presence", players: listRoomPlayers(client.room) });
    }
  }
}

function listRoomPlayers(room) {
  return [...(rooms.get(room) || [])]
    .map((id) => clients.get(id))
    .filter(Boolean)
    .map((client) => ({ id: client.id, name: client.name, joinedAt: client.joinedAt }));
}

function broadcast(room, message, exceptClientId = null) {
  for (const id of rooms.get(room) || []) {
    if (id === exceptClientId) continue;
    const client = clients.get(id);
    if (client) sendWs(client, message);
  }
}

function sendWs(client, message) {
  sendRaw(client.socket, Buffer.from(JSON.stringify(message), "utf8"), 1);
}

function sendRaw(socket, payload, opcode = 1) {
  const length = payload.length;
  let header;
  if (length < 126) {
    header = Buffer.from([0x80 | opcode, length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function extractFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let headerLength = 2;
    if (length === 126) {
      if (offset + 4 > buffer.length) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (offset + 10 > buffer.length) break;
      const bigLength = buffer.readBigUInt64BE(offset + 2);
      if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) break;
      length = Number(bigLength);
      headerLength = 10;
    }
    const maskLength = masked ? 4 : 0;
    const frameLength = headerLength + maskLength + length;
    if (offset + frameLength > buffer.length) break;

    let payload = buffer.subarray(offset + headerLength + maskLength, offset + frameLength);
    if (masked) {
      const mask = buffer.subarray(offset + headerLength, offset + headerLength + 4);
      payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
    }
    frames.push({ opcode, payload });
    offset += frameLength;
  }
  return { frames, remaining: buffer.subarray(offset) };
}

server.listen(port, host, () => {
  console.log(`Blorox running at http://${host}:${port}`);
});
