import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";

const port = 19080 + Math.floor(Math.random() * 1000);
const server = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", BLOROX_DATA_DIR: `.smoke-data-${port}` },
  stdio: ["ignore", "pipe", "pipe"]
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(method, path, body, token) {
  const payload = body ? JSON.stringify(body) : null;
  const options = {
    hostname: "127.0.0.1",
    port,
    path,
    method,
    headers: {
      "content-type": "application/json",
      ...(payload ? { "content-length": Buffer.byteLength(payload) } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

try {
  await wait(600);
  const guest = await request("POST", "/api/auth/guest", { nickname: "Smoke Guest" });
  if (guest.status !== 200 || !guest.data.token) throw new Error("guest auth failed");

  const catalog = await request("GET", "/api/catalog");
  if (catalog.status !== 200 || catalog.data.assets.length < 3) throw new Error("catalog seed missing");

  const games = await request("GET", "/api/games");
  if (games.status !== 200 || games.data.games.length < 3) throw new Error("built-in games missing");

  const created = await request("POST", "/api/games", {
    title: "Smoke Obby",
    genre: "Obstacle",
    description: "Automated smoke test game",
    scene: { objects: [{ kind: "spawn", x: 0, y: 0, z: 0 }] },
    script: "onStart: welcome('Smoke')"
  }, guest.data.token);
  if (created.status !== 201 || !created.data.game.id) throw new Error("game creation failed");

  for (let i = 2; i <= 5; i += 1) {
    const extra = await request("POST", "/api/games", {
      title: `Smoke Obby ${i}`,
      genre: "Obstacle",
      description: "Automated smoke test game",
      scene: { objects: [{ kind: "spawn", x: 0, y: 0, z: 0 }] },
      script: "onStart: welcome('Smoke')"
    }, guest.data.token);
    if (extra.status !== 201) throw new Error(`game ${i} creation failed`);
  }

  const overLimit = await request("POST", "/api/games", {
    title: "Smoke Over Limit",
    genre: "Obstacle",
    description: "Automated smoke test limit",
    scene: { objects: [{ kind: "spawn", x: 0, y: 0, z: 0 }] },
    script: "onStart: welcome('Limit')"
  }, guest.data.token);
  if (overLimit.status !== 403) throw new Error("free creator limit was not enforced");

  const listing = await request("POST", "/api/assets", {
    name: "Smoke Hat",
    type: "clothing",
    price: 0,
    description: "A test listing"
  }, guest.data.token);
  if (listing.status !== 201 || !listing.data.asset.id) throw new Error("asset creation failed");

  const acquisition = await request("POST", "/api/assets/asset-neon-hoodie/acquire", {}, guest.data.token);
  if (acquisition.status !== 200 || !acquisition.data.owned) throw new Error("asset acquisition failed");
  if (acquisition.data.user.credits !== 15) throw new Error("asset acquisition did not debit credits");

  const duplicateAcquisition = await request("POST", "/api/assets/asset-neon-hoodie/acquire", {}, guest.data.token);
  if (duplicateAcquisition.status !== 200 || !duplicateAcquisition.data.alreadyOwned) {
    throw new Error("duplicate asset acquisition was not idempotent");
  }
  if (duplicateAcquisition.data.user.credits !== 15) throw new Error("duplicate acquisition charged twice");

  const tooExpensive = await request("POST", "/api/assets/asset-office-kit/acquire", {}, guest.data.token);
  if (tooExpensive.status !== 403) throw new Error("insufficient credit path failed");

  const wsResult = await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=smoke&token=${guest.data.token}`);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("websocket timeout"));
    }, 2500);

    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "welcome" && message.room === "smoke") {
        ws.send(JSON.stringify({ type: "chat", text: "hello smoke" }));
      }
      if (message.type === "chat" && message.text === "hello smoke") {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      }
    });
    ws.addEventListener("error", reject);
  });
  if (!wsResult) throw new Error("websocket failed");

  console.log("smoke ok");
} finally {
  server.kill("SIGTERM");
  await fs.rm(`.smoke-data-${port}`, { recursive: true, force: true });
}
