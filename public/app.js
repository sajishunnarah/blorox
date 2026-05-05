(() => {
  const app = document.querySelector("#app");
  const storage = window.localStorage;

  const state = {
    token: storage.getItem("blorox-token") || "",
    user: null,
    games: [],
    assets: [],
    inventory: [],
    stats: null,
    ws: null,
    wsRoom: "",
    clientId: "",
    players: [],
    chat: [],
    keys: {},
    cleanup: null,
    studio: {
      title: "My Blorox World",
      genre: "Sandbox",
      description: "A browser-built game with blocks, NPCs, sound cues, and scripts.",
      public: true,
      kind: "block",
      color: "#39d98a",
      objects: [
        { kind: "spawn", name: "Spawn", x: 0, y: 0, z: 0, color: "#39d98a" },
        { kind: "block", name: "Starter platform", x: 0, y: -0.5, z: 0, color: "#5f6f86" }
      ],
      script: "onStart: welcome('Build something impossible')\nonTouch coin: award(5)\nonChat dance: emote('spin')"
    },
    cards: null,
    island: null,
    rogue: null
  };
  let activeStudioRenderer = null;

  const routes = {
    discover: ["Discover", "Play built-ins, join rooms, and launch creator games."],
    studio: ["Studio", "Build, script, publish, and playtest browser games."],
    market: ["Marketplace", "Clothes, UI kits, effects, sounds, and creator assets."],
    rooms: ["Rooms", "Realtime lobby chat and live player presence."],
    profile: ["Profile", "Account, premium status, credits, and creator limits."]
  };

  const prompts = [
    "The board meeting got weird when someone presented ____.",
    "My new horror game needs more ____.",
    "The fastest way to win a lobby argument is ____.",
    "The studio update accidentally shipped with ____.",
    "The final boss was defeated by ____.",
    "The marketplace banned ____ after one very strange weekend.",
    "The tutorial NPC refused to talk until I brought ____.",
    "The secret ingredient in the raid plan was ____."
  ];

  const answers = [
    "a suspiciously confident intern",
    "sixteen unpaid side quests",
    "a fog machine with admin rights",
    "the phrase 'trust me, I tested it'",
    "a chair that understands physics",
    "premium-only stairs",
    "a haunted spreadsheet",
    "one perfectly timed banana peel",
    "an NPC union representative",
    "a lore document nobody read",
    "a lobby full of judges",
    "the forbidden elevator button",
    "a dramatic monologue in voice chat",
    "a rubber stamp labeled approved",
    "three ducks in a trench coat",
    "an emergency patch at 2 a.m.",
    "a boss fight against bad UX",
    "a suspiciously free asset pack"
  ];

  const islandNpcs = [
    {
      id: "hawking",
      name: "Professor Hawking",
      x: -8,
      z: -4,
      quest: "Route math",
      line: "The stars give us a route, but my chair battery is gone. Bring the battery and star map."
    },
    {
      id: "marina",
      name: "Marina",
      x: 10,
      z: 4,
      quest: "Dock access",
      line: "I can start the boat if you bring proof from the mansion and a clean launch key."
    },
    {
      id: "chef",
      name: "Chef Luis",
      x: 3,
      z: -9,
      quest: "Generator",
      line: "The kitchen freezer has a radio fuse. Fix the generator and the dock lights come back."
    },
    {
      id: "journalist",
      name: "Dana Vale",
      x: -11,
      z: 8,
      quest: "Ledger",
      line: "The ledger is in the north mansion. Keep low when Epstein patrols the courtyard."
    }
  ];

  const islandItems = [
    { id: "battery", name: "chair battery", x: -13, z: -10, found: false },
    { id: "starMap", name: "star map", x: 8, z: -12, found: false },
    { id: "fuse", name: "radio fuse", x: 4, z: -13, found: false },
    { id: "ledger", name: "island ledger", x: 0, z: 14, found: false },
    { id: "flare", name: "signal flare", x: 13, z: 12, found: false },
    { id: "launchKey", name: "launch key", x: 12, z: 1, found: false, locked: true }
  ];

  const rogueEvents = [
    "Front desk audit checkpoint",
    "Glass hallway with camera arcs",
    "Celebrity center reception",
    "Locked records archive",
    "Donation terminal maze",
    "Policy office with silent alarms",
    "Basement elevator inspection",
    "Legal wing paper storm",
    "E-meter calibration room",
    "Sea Org dorm corridor",
    "Vault door below sublevel eleven",
    "Xenu chamber"
  ];

  document.addEventListener("keydown", (event) => {
    state.keys[event.key.toLowerCase()] = true;
  });
  document.addEventListener("keyup", (event) => {
    state.keys[event.key.toLowerCase()] = false;
  });
  window.addEventListener("hashchange", render);

  boot();

  async function boot() {
    try {
      if (state.token) {
        const me = await api("/api/me");
        state.user = me.user;
      }
    } catch {
      state.token = "";
      storage.removeItem("blorox-token");
    }

    if (!state.user) {
      await guestSignIn();
    }

    await loadAll();
    connectRoom("lobby");
    render();
  }

  async function guestSignIn() {
    const guest = await api("/api/auth/guest", {
      method: "POST",
      body: { nickname: `Guest ${Math.floor(Math.random() * 900 + 100)}` }
    });
    setSession(guest.token, guest.user);
  }

  function setSession(token, user) {
    state.token = token;
    state.user = user;
    storage.setItem("blorox-token", token);
  }

  async function loadAll() {
    const [games, catalog, stats, me] = await Promise.all([
      api("/api/games"),
      api("/api/catalog"),
      api("/api/stats"),
      api("/api/me")
    ]);
    state.games = games.games;
    state.assets = catalog.assets;
    state.stats = stats;
    state.user = me.user;
    state.inventory = me.inventory || [];
  }

  async function api(path, options = {}) {
    const headers = {
      "content-type": "application/json",
      ...(state.token ? { authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    };
    const response = await fetch(path, {
      ...options,
      headers,
      body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  function currentRoute() {
    const hash = location.hash.replace(/^#/, "");
    if (hash.startsWith("game/")) return "game";
    return hash || "discover";
  }

  function render() {
    if (state.cleanup) {
      state.cleanup();
      state.cleanup = null;
    }

    const route = currentRoute();
    const [title, subtitle] = route === "game"
      ? ["Play", "Realtime rooms, 3D worlds, UI games, and creator scenes."]
      : routes[route] || routes.discover;

    let content = "";
    if (route === "discover") content = renderDiscover();
    else if (route === "studio") content = renderStudio();
    else if (route === "market") content = renderMarket();
    else if (route === "rooms") content = renderRooms();
    else if (route === "profile") content = renderProfile();
    else if (route === "game") content = renderGameShell(location.hash.replace("#game/", ""));
    else content = renderDiscover();

    app.innerHTML = `
      <div class="app-shell">
        <aside class="sidebar">
          <div class="brand">
            <div class="brand-mark">B</div>
            <div><h1>Blorox</h1><span>browser game platform</span></div>
          </div>
          <nav class="nav">
            ${navLink("discover", "Discover", route)}
            ${navLink("studio", "Studio", route)}
            ${navLink("market", "Market", route)}
            ${navLink("rooms", "Rooms", route)}
            ${navLink("profile", "Profile", route)}
          </nav>
          <button class="side-room" data-action="join-lobby"><span>Lobby</span><span class="pill">${state.players.length} live</span></button>
          <div class="sidebar-bottom">
            <div class="pill green">${escapeHtml(state.user?.guest ? "Guest" : "Account")}</div>
            <div class="pill gold">${Number(state.user?.credits || 0)} credits</div>
            <div class="pill">${state.stats?.games || 0} games</div>
          </div>
        </aside>
        <main class="main">
          <header class="topbar">
            <div><h2>${title}</h2><p>${subtitle}</p></div>
            <div class="user-strip">
              <div class="avatar">${escapeHtml((state.user?.displayName || "B").slice(0, 1).toUpperCase())}</div>
              <div>
                <strong>${escapeHtml(state.user?.displayName || "Guest")}</strong>
                <div class="muted">${state.user?.premium ? "Premium creator" : "Free creator"}</div>
              </div>
            </div>
          </header>
          <section class="content">${content}</section>
        </main>
      </div>
      <div class="toast" id="toast"></div>
    `;

    bindGlobal();
    if (route === "studio") mountStudio();
    if (route === "rooms") mountRooms();
    if (route === "market") mountMarket();
    if (route === "profile") mountProfile();
    if (route === "game") mountGame(location.hash.replace("#game/", ""));
  }

  function navLink(route, label, activeRoute) {
    return `<a href="#${route}" class="${activeRoute === route ? "active" : ""}"><span>${label}</span><span>${navGlyph(label)}</span></a>`;
  }

  function navGlyph(label) {
    return { Discover: ">", Studio: "+", Market: "$", Rooms: "#", Profile: "*" }[label] || ">";
  }

  function bindGlobal() {
    const lobbyButton = document.querySelector("[data-action='join-lobby']");
    if (lobbyButton) {
      lobbyButton.addEventListener("click", () => {
        connectRoom("lobby");
        location.hash = "rooms";
      });
    }
  }

  function renderDiscover() {
    const games = state.games.map(renderGameCard).join("");
    return `
      <div class="grid cols-4">
        ${statCard("Live Players", state.stats?.livePlayers || 0, "green")}
        ${statCard("Published Games", state.stats?.games || 0, "gold")}
        ${statCard("Marketplace Items", state.stats?.assets || 0, "pink")}
        ${statCard("Asset Acquisitions", state.stats?.acquisitions || 0, "cyan")}
      </div>
      <section class="band">
        <div class="band-head">
          <div><h3>Experiences</h3><p>Built-in games and creator worlds.</p></div>
          <a class="btn primary" href="#studio">Create</a>
        </div>
        <div class="grid cols-3" style="padding:16px">${games}</div>
      </section>
    `;
  }

  function statCard(label, value, color) {
    return `
      <div class="stat-card card-body">
        <span class="pill ${color === "pink" ? "" : color}">${label}</span>
        <h4 style="font-size:28px">${escapeHtml(String(value))}</h4>
      </div>
    `;
  }

  function renderGameCard(game) {
    return `
      <article class="game-card">
        <div class="thumb ${escapeHtml(game.thumbnail || "creator")}"><span>${escapeHtml(game.genre)}</span></div>
        <div class="card-body">
          <div class="split">
            <h4>${escapeHtml(game.title)}</h4>
            ${game.builtIn ? "<span class='pill green'>built-in</span>" : "<span class='pill'>creator</span>"}
          </div>
          <p>${escapeHtml(game.description)}</p>
          <div class="row">
            ${(game.tags || []).slice(0, 3).map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}
          </div>
          <div class="split">
            <span class="muted">${Number(game.plays || 0)} plays</span>
            <a class="btn primary" href="#game/${encodeURIComponent(game.id)}">Play</a>
          </div>
        </div>
      </article>
    `;
  }

  function renderStudio() {
    const mine = state.games.filter((game) => game.creatorId === state.user?.id && !game.builtIn);
    const max = state.user?.premium ? "unlimited" : "5";
    return `
      <div class="studio-layout">
        <aside class="studio-tools">
          <section class="band">
            <div class="band-head"><h3>Project</h3><span class="pill">${mine.length}/${max}</span></div>
            <div class="card-body">
              <div class="field"><label>Title</label><input id="studioTitle" value="${attr(state.studio.title)}"></div>
              <div class="field"><label>Genre</label><select id="studioGenre">
                ${["Sandbox", "Obby", "Roleplay", "Shooter", "Horror", "UI Game", "Roguelite"].map((genre) => `<option ${state.studio.genre === genre ? "selected" : ""}>${genre}</option>`).join("")}
              </select></div>
              <div class="field"><label>Description</label><textarea id="studioDescription">${escapeHtml(state.studio.description)}</textarea></div>
              <div class="row">
                <button class="btn primary" id="publishGame">Publish</button>
                <button class="btn ghost" id="playtestGame">Playtest</button>
              </div>
            </div>
          </section>
          <section class="band">
            <div class="band-head"><h3>Palette</h3><span class="pill">${state.studio.objects.length} objects</span></div>
            <div class="card-body">
              <div class="field"><label>Object</label><select id="studioKind">
                ${["block", "spawn", "npc", "hazard", "coin", "door", "sound", "trigger"].map((kind) => `<option ${state.studio.kind === kind ? "selected" : ""}>${kind}</option>`).join("")}
              </select></div>
              <div class="field"><label>Color</label><input type="color" id="studioColor" value="${attr(state.studio.color)}"></div>
              <div class="row">
                <button class="btn gold" id="addObject">Add</button>
                <button class="btn ghost" id="clearObjects">Clear</button>
              </div>
              <div id="objectList" class="grid">${renderObjectList()}</div>
            </div>
          </section>
          <section class="band">
            <div class="band-head"><h3>Scripts</h3><span class="pill">visual text</span></div>
            <div class="card-body">
              <textarea id="studioScript" class="script-box">${escapeHtml(state.studio.script)}</textarea>
            </div>
          </section>
        </aside>
        <div class="stage" id="studioStage">
          <div class="overlay-top">
            <span class="pill green">Three.js scene</span>
            <span class="pill">collab room ${escapeHtml(`studio-${state.user?.id || "guest"}`)}</span>
          </div>
          <div class="overlay-bottom">
            <button class="btn icon" id="nudgeLeft" title="Nudge selected left">L</button>
            <button class="btn icon" id="nudgeRight" title="Nudge selected right">R</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderObjectList() {
    if (!state.studio.objects.length) return `<div class="empty">No objects.</div>`;
    return state.studio.objects.map((object, index) => `
      <div class="tool-card card-body">
        <div class="split">
          <strong>${escapeHtml(object.name || object.kind)}</strong>
          <button class="btn icon ghost" data-delete-object="${index}" title="Delete object">x</button>
        </div>
        <span class="muted">${escapeHtml(object.kind)} at ${object.x}, ${object.y}, ${object.z}</span>
      </div>
    `).join("");
  }

  function mountStudio() {
    connectRoom(`studio-${state.user?.id || "guest"}`);
    const stage = document.querySelector("#studioStage");
    const renderer = new SceneRenderer(stage, { theme: "studio" });
    activeStudioRenderer = renderer;
    renderer.setObjects(state.studio.objects);
    state.cleanup = () => {
      renderer.dispose();
      if (activeStudioRenderer === renderer) activeStudioRenderer = null;
    };

    const syncFields = () => {
      state.studio.title = document.querySelector("#studioTitle")?.value || state.studio.title;
      state.studio.genre = document.querySelector("#studioGenre")?.value || state.studio.genre;
      state.studio.description = document.querySelector("#studioDescription")?.value || state.studio.description;
      state.studio.kind = document.querySelector("#studioKind")?.value || state.studio.kind;
      state.studio.color = document.querySelector("#studioColor")?.value || state.studio.color;
      state.studio.script = document.querySelector("#studioScript")?.value || state.studio.script;
    };

    ["studioTitle", "studioGenre", "studioDescription", "studioKind", "studioColor", "studioScript"].forEach((id) => {
      document.querySelector(`#${id}`)?.addEventListener("input", syncFields);
    });

    document.querySelector("#addObject")?.addEventListener("click", () => {
      syncFields();
      const count = state.studio.objects.length;
      const object = {
        kind: state.studio.kind,
        name: `${capitalize(state.studio.kind)} ${count + 1}`,
        x: Math.round(Math.cos(count * 1.7) * (2 + count % 5)),
        y: state.studio.kind === "coin" ? 1 : 0,
        z: Math.round(Math.sin(count * 1.3) * (2 + count % 5)),
        color: state.studio.color,
        script: state.studio.kind === "trigger" ? "onTouch: open(door)" : ""
      };
      state.studio.objects.push(object);
      renderer.setObjects(state.studio.objects);
      document.querySelector("#objectList").innerHTML = renderObjectList();
      bindObjectDeletes(renderer);
      sendWs({ type: "studio-patch", payload: { action: "add", object } });
    });

    document.querySelector("#clearObjects")?.addEventListener("click", () => {
      state.studio.objects = [{ kind: "spawn", name: "Spawn", x: 0, y: 0, z: 0, color: "#39d98a" }];
      renderer.setObjects(state.studio.objects);
      document.querySelector("#objectList").innerHTML = renderObjectList();
      bindObjectDeletes(renderer);
      sendWs({ type: "studio-patch", payload: { action: "clear" } });
    });

    document.querySelector("#publishGame")?.addEventListener("click", async () => {
      syncFields();
      try {
        const created = await api("/api/games", {
          method: "POST",
          body: {
            title: state.studio.title,
            genre: state.studio.genre,
            description: state.studio.description,
            public: state.studio.public,
            thumbnail: "creator",
            tags: ["creator", state.studio.genre.toLowerCase(), "web"],
            scene: { objects: state.studio.objects },
            script: state.studio.script
          }
        });
        await loadAll();
        toast(`Published ${created.game.title}`);
        location.hash = `game/${created.game.id}`;
      } catch (error) {
        toast(error.message, "red");
      }
    });

    document.querySelector("#playtestGame")?.addEventListener("click", () => {
      syncFields();
      mountCreatorGame({
        id: "playtest",
        title: state.studio.title,
        description: state.studio.description,
        scene: { objects: state.studio.objects },
        script: state.studio.script
      }, true);
    });

    bindObjectDeletes(renderer);
  }

  function bindObjectDeletes(renderer) {
    document.querySelectorAll("[data-delete-object]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.deleteObject);
        state.studio.objects.splice(index, 1);
        renderer.setObjects(state.studio.objects);
        document.querySelector("#objectList").innerHTML = renderObjectList();
        bindObjectDeletes(renderer);
        sendWs({ type: "studio-patch", payload: { action: "delete", index } });
      });
    });
  }

  function renderMarket() {
    return `
      <div class="grid cols-2">
        <section class="band">
          <div class="band-head"><h3>List Asset</h3><span class="pill gold">creator economy</span></div>
          <form class="card-body" id="assetForm">
            <div class="field"><label>Name</label><input name="name" value="My Creator Asset"></div>
            <div class="field"><label>Type</label><select name="type">
              ${["clothing", "3d", "sound", "ui", "effect", "script"].map((type) => `<option>${type}</option>`).join("")}
            </select></div>
            <div class="field"><label>Price</label><input type="number" min="0" name="price" value="0"></div>
            <div class="field"><label>Description</label><textarea name="description">A reusable asset for Blorox games.</textarea></div>
            <div class="field"><label>Swatch</label><input type="color" name="swatch" value="#f2b84b"></div>
            <button class="btn primary" type="submit">List</button>
          </form>
        </section>
        <section class="band">
          <div class="band-head"><h3>Featured</h3><span class="pill">${state.assets.length} items</span></div>
          <div class="grid cols-2" style="padding:16px">${state.assets.map(renderAsset).join("")}</div>
        </section>
      </div>
    `;
  }

  function renderAsset(asset) {
    const owned = state.inventory.some((item) => item.id === asset.id);
    return `
      <article class="asset-card">
        <div class="asset-swatch" style="--swatch:${attr(asset.swatch || "#39d98a")}"></div>
        <div class="card-body">
          <div class="split">
            <h4>${escapeHtml(asset.name)}</h4>
            <span class="pill ${asset.price ? "gold" : "green"}">${asset.price ? `${asset.price} cr` : "free"}</span>
          </div>
          <p>${escapeHtml(asset.description)}</p>
          <div class="split">
            <span class="muted">${escapeHtml(asset.type)} by ${escapeHtml(asset.creatorName || "Unknown")} · ${Number(asset.downloads || 0)} gets</span>
            <button class="btn ${owned ? "ghost" : "primary"}" data-buy="${escapeHtml(asset.id)}">${owned ? "Owned" : "Get"}</button>
          </div>
        </div>
      </article>
    `;
  }

  function mountMarket() {
    document.querySelector("#assetForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      try {
        await api("/api/assets", { method: "POST", body: data });
        await loadAll();
        toast("Asset listed");
        render();
      } catch (error) {
        toast(error.message, "red");
      }
    });

    document.querySelectorAll("[data-buy]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (button.textContent === "Owned") {
          toast("Already in your creator inventory");
          return;
        }
        try {
          const result = await api(`/api/assets/${encodeURIComponent(button.dataset.buy)}/acquire`, {
            method: "POST",
            body: {}
          });
          state.user = result.user;
          await loadAll();
          toast(result.alreadyOwned ? "Already in your creator inventory" : "Added to your creator inventory");
          render();
        } catch (error) {
          toast(error.message, "red");
        }
      });
    });
  }

  function renderRooms() {
    const players = state.players.map((player) => `
      <div class="player-card card-body">
        <strong>${escapeHtml(player.name)}</strong>
        <span class="muted">${player.id === state.clientId ? "you" : "online"}</span>
      </div>
    `).join("") || `<div class="empty">No live players.</div>`;
    return `
      <div class="grid cols-2">
        <section class="band">
          <div class="band-head"><h3>Lobby</h3><span class="pill green">${state.wsRoom || "lobby"}</span></div>
          <div class="card-body">${renderChat()}</div>
        </section>
        <section class="band">
          <div class="band-head"><h3>Players</h3><span class="pill">${state.players.length} present</span></div>
          <div class="grid" style="padding:16px">${players}</div>
        </section>
      </div>
    `;
  }

  function mountRooms() {
    connectRoom("lobby");
    bindChat();
  }

  function renderChat() {
    return `
      <div class="chat">
        <div class="chat-log" id="chatLog">
          ${state.chat.slice(-30).map((line) => `<div class="chat-line"><b>${escapeHtml(line.player)}:</b> ${escapeHtml(line.text)}</div>`).join("") || `<div class="chat-line">Room opened.</div>`}
        </div>
        <form class="row" id="chatForm">
          <input name="text" placeholder="Message room" autocomplete="off">
          <button class="btn primary" type="submit">Send</button>
        </form>
      </div>
    `;
  }

  function bindChat() {
    const form = document.querySelector("#chatForm");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = form.elements.text;
      const text = input.value.trim();
      if (!text) return;
      sendWs({ type: "chat", text });
      input.value = "";
    });
    scrollChat();
  }

  function updateChatDom() {
    const log = document.querySelector("#chatLog");
    if (!log) return;
    log.innerHTML = state.chat.slice(-30).map((line) => `<div class="chat-line"><b>${escapeHtml(line.player)}:</b> ${escapeHtml(line.text)}</div>`).join("");
    scrollChat();
  }

  function scrollChat() {
    const log = document.querySelector("#chatLog");
    if (log) log.scrollTop = log.scrollHeight;
  }

  function renderProfile() {
    const mine = state.games.filter((game) => game.creatorId === state.user?.id && !game.builtIn);
    const inventory = state.inventory.length
      ? state.inventory.map((asset) => `
        <article class="asset-card">
          <div class="asset-swatch" style="--swatch:${attr(asset.swatch || "#39d98a")}"></div>
          <div class="card-body">
            <div class="split"><h4>${escapeHtml(asset.name)}</h4><span class="pill green">owned</span></div>
            <p>${escapeHtml(asset.description)}</p>
            <span class="muted">${escapeHtml(asset.type)} by ${escapeHtml(asset.creatorName || "Unknown")}</span>
          </div>
        </article>
      `).join("")
      : `<div class="empty">Your creator inventory is empty.</div>`;
    return `
      <div class="grid cols-3">
        <section class="profile-card card-body">
          <span class="pill ${state.user?.premium ? "green" : "gold"}">${state.user?.premium ? "premium" : "free"}</span>
          <h4>${escapeHtml(state.user?.displayName || "Guest")}</h4>
          <p>${state.user?.guest ? "Guest sessions can play, create, and publish until the session is replaced." : "Registered account with persistent creations."}</p>
          <button class="btn primary" id="upgradePremium">Upgrade Demo</button>
        </section>
        <section class="profile-card card-body">
          <span class="pill">Creator Limit</span>
          <h4>${mine.length}/${state.user?.premium ? "unlimited" : "5"} games</h4>
          <p>Free accounts stop at five published games. Premium removes that ceiling.</p>
        </section>
        <section class="profile-card card-body">
          <span class="pill gold">Wallet</span>
          <h4>${Number(state.user?.credits || 0)} credits</h4>
          <p>Credits are used for marketplace items and creator economy flows.</p>
        </section>
      </div>
      <div class="grid cols-2">
        <section class="band">
          <div class="band-head"><h3>Create Account</h3><span class="pill">save session</span></div>
          <form class="card-body" id="registerForm">
            <div class="field"><label>Username</label><input name="username" autocomplete="username"></div>
            <div class="field"><label>Password</label><input name="password" type="password" autocomplete="new-password"></div>
            <button class="btn primary" type="submit">Register</button>
          </form>
        </section>
        <section class="band">
          <div class="band-head"><h3>Login</h3><span class="pill">returning player</span></div>
          <form class="card-body" id="loginForm">
            <div class="field"><label>Username</label><input name="username" autocomplete="username"></div>
            <div class="field"><label>Password</label><input name="password" type="password" autocomplete="current-password"></div>
            <button class="btn gold" type="submit">Login</button>
          </form>
        </section>
      </div>
      <section class="band">
        <div class="band-head"><h3>Creator Inventory</h3><span class="pill">${state.inventory.length} owned</span></div>
        <div class="grid cols-3" style="padding:16px">${inventory}</div>
      </section>
    `;
  }

  function mountProfile() {
    document.querySelector("#upgradePremium")?.addEventListener("click", async () => {
      try {
        const upgraded = await api("/api/premium", { method: "POST", body: {} });
        state.user = upgraded.user;
        toast("Premium enabled");
        render();
      } catch (error) {
        toast(error.message, "red");
      }
    });

    document.querySelector("#registerForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      try {
        const result = await api("/api/auth/register", { method: "POST", body: data });
        setSession(result.token, result.user);
        await loadAll();
        toast("Account created");
        render();
      } catch (error) {
        toast(error.message, "red");
      }
    });

    document.querySelector("#loginForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      try {
        const result = await api("/api/auth/login", { method: "POST", body: data });
        setSession(result.token, result.user);
        await loadAll();
        toast("Logged in");
        render();
      } catch (error) {
        toast(error.message, "red");
      }
    });
  }

  function renderGameShell(gameId) {
    const game = state.games.find((item) => item.id === decodeURIComponent(gameId));
    if (!game) return `<div class="band empty">Game not found.</div>`;
    return `
      <section class="band">
        <div class="band-head">
          <div><h3>${escapeHtml(game.title)}</h3><p>${escapeHtml(game.description)}</p></div>
          <div class="row">
            <span class="pill green">${escapeHtml(game.genre)}</span>
            <a class="btn ghost" href="#discover">Exit</a>
          </div>
        </div>
        <div class="card-body" id="gameMount"></div>
      </section>
    `;
  }

  async function mountGame(gameId) {
    const id = decodeURIComponent(gameId);
    const game = state.games.find((item) => item.id === id);
    if (!game) return;
    connectRoom(`game-${id}`);
    try {
      await api(`/api/games/${encodeURIComponent(id)}`);
    } catch {
      // Plays are a convenience metric; the game can still run locally.
    }

    if (id === "builtin-cards") mountCards(game);
    else if (id === "builtin-island") mountIsland(game);
    else if (id === "builtin-xenu") mountRogue(game);
    else mountCreatorGame(game);
  }

  function mountCards() {
    if (!state.cards) state.cards = createCardState();
    drawCards();
    state.cleanup = () => {};
  }

  function createCardState() {
    const bots = ["Mira", "Jax", "Nia"];
    return {
      round: 1,
      prompt: sample(prompts),
      hand: shuffle(answers).slice(0, 6),
      submissions: [],
      selected: "",
      phase: "select",
      judge: "table",
      scores: Object.fromEntries([state.user.displayName, ...bots].map((name) => [name, 0])),
      bots
    };
  }

  function drawCards() {
    const mount = document.querySelector("#gameMount");
    if (!mount || !state.cards) return;
    const cards = state.cards;
    const submissions = cards.submissions.map((entry, index) => `
      <button class="playing-card ${cards.phase === "judge" ? "" : "black"}" data-pick-winner="${index}">
        <strong>${cards.phase === "judge" ? escapeHtml(entry.player) : "Submitted"}</strong>
        <span>${cards.phase === "judge" ? escapeHtml(entry.answer) : "Face down"}</span>
      </button>
    `).join("");
    mount.innerHTML = `
      <div class="card-table">
        <div class="grid">
          <div class="playing-card black">
            <strong>Round ${cards.round}</strong>
            <span>${escapeHtml(cards.prompt)}</span>
            <small>${cards.phase === "select" ? "Pick one card." : "Judge the table."}</small>
          </div>
          <div class="hand-grid">
            ${cards.hand.map((answer, index) => `
              <button class="playing-card ${cards.selected === answer ? "selected" : ""}" data-card="${index}">
                <span>${escapeHtml(answer)}</span>
                <small>Play</small>
              </button>
            `).join("")}
          </div>
        </div>
        <aside class="game-hud">
          <section class="band">
            <div class="band-head"><h3>Table</h3><span class="pill">${state.players.length || 1} live</span></div>
            <div class="card-body">
              <div class="submissions">${submissions || "<div class='empty'>No submissions.</div>"}</div>
              <button class="btn gold" id="nextCardsRound">Next Round</button>
            </div>
          </section>
          <section class="band">
            <div class="band-head"><h3>Scores</h3><span class="pill green">${cards.phase}</span></div>
            <div class="card-body">
              ${Object.entries(cards.scores).map(([name, score]) => `<div class="split"><span>${escapeHtml(name)}</span><strong>${score}</strong></div>`).join("")}
            </div>
          </section>
          <section class="band"><div class="card-body">${renderChat()}</div></section>
        </aside>
      </div>
    `;

    bindChat();
    document.querySelectorAll("[data-card]").forEach((button) => {
      button.addEventListener("click", () => {
        if (state.cards.phase !== "select") return;
        const answer = state.cards.hand[Number(button.dataset.card)];
        submitCard(answer);
      });
    });
    document.querySelectorAll("[data-pick-winner]").forEach((button) => {
      button.addEventListener("click", () => {
        if (state.cards.phase !== "judge") return;
        pickWinner(Number(button.dataset.pickWinner));
      });
    });
    document.querySelector("#nextCardsRound")?.addEventListener("click", nextCardsRound);
  }

  function submitCard(answer) {
    const cards = state.cards;
    cards.selected = answer;
    cards.submissions = cards.submissions.filter((entry) => entry.player !== state.user.displayName);
    cards.submissions.push({ player: state.user.displayName, answer });
    const used = new Set(cards.submissions.map((entry) => entry.player));
    for (const bot of cards.bots) {
      if (!used.has(bot)) cards.submissions.push({ player: bot, answer: sample(answers) });
    }
    cards.phase = "judge";
    sendWs({ type: "cards", payload: cards, echo: true });
    drawCards();
  }

  function pickWinner(index) {
    const winner = state.cards.submissions[index];
    if (!winner) return;
    state.cards.scores[winner.player] = Number(state.cards.scores[winner.player] || 0) + 1;
    toast(`${winner.player} wins the round`);
    nextCardsRound();
  }

  function nextCardsRound() {
    state.cards.round += 1;
    state.cards.prompt = sample(prompts);
    state.cards.hand = shuffle(answers).slice(0, 6);
    state.cards.submissions = [];
    state.cards.selected = "";
    state.cards.phase = "select";
    sendWs({ type: "cards", payload: state.cards, echo: true });
    drawCards();
  }

  function mountIsland() {
    const mount = document.querySelector("#gameMount");
    if (!state.island || state.island.done) state.island = createIslandState();
    mount.innerHTML = `
      <div class="game-layout">
        <aside class="game-hud" id="islandHud"></aside>
        <div class="stage" id="islandStage">
          <div class="overlay-top"><span class="pill green">WASD move</span><span class="pill gold">single player</span></div>
          <div class="overlay-bottom"><button class="btn primary" id="islandInteract">Interact</button></div>
        </div>
      </div>
    `;
    const renderer = new SceneRenderer(document.querySelector("#islandStage"), { theme: "island" });
    const tick = () => updateIsland(renderer);
    const interval = setInterval(tick, 60);
    document.querySelector("#islandInteract")?.addEventListener("click", islandInteract);
    state.cleanup = () => {
      clearInterval(interval);
      renderer.dispose();
    };
    tick();
  }

  function createIslandState() {
    return {
      player: { x: 0, z: 8 },
      epstein: { x: 0, z: -10, angle: 0 },
      minute: 8 * 60,
      stamina: 100,
      inventory: [],
      flags: {},
      items: islandItems.map((item) => ({ ...item })),
      dialogue: "The dock is south. The mansion is north. Dusk is coming.",
      done: false,
      caught: false
    };
  }

  function updateIsland(renderer) {
    const s = state.island;
    if (!s || s.done) return;
    const speed = state.keys.shift ? 0.2 : 0.13;
    let dx = 0;
    let dz = 0;
    if (state.keys.w || state.keys.arrowup) dz -= speed;
    if (state.keys.s || state.keys.arrowdown) dz += speed;
    if (state.keys.a || state.keys.arrowleft) dx -= speed;
    if (state.keys.d || state.keys.arrowright) dx += speed;
    s.player.x = clamp(s.player.x + dx, -16, 16);
    s.player.z = clamp(s.player.z + dz, -16, 16);
    s.minute += 0.018;

    s.epstein.angle += 0.018;
    s.epstein.x = Math.cos(s.epstein.angle) * 8 + (distance(s.player, s.epstein) < 7 ? (s.player.x - s.epstein.x) * 0.02 : 0);
    s.epstein.z = Math.sin(s.epstein.angle * 0.8) * 10 - 1 + (distance(s.player, s.epstein) < 7 ? (s.player.z - s.epstein.z) * 0.02 : 0);

    if (distance(s.player, s.epstein) < 1.25) {
      s.caught = true;
      s.done = true;
      s.dialogue = "Epstein caught you in the courtyard. Restart and use cover.";
    }
    if (s.minute >= 18 * 60) {
      s.done = true;
      s.dialogue = "Night fell before the boat launched. Restart and move faster.";
    }

    const objects = islandSceneObjects(s);
    renderer.setObjects(objects);
    renderer.setPlayer(s.player);
    drawIslandHud();
  }

  function islandSceneObjects(s) {
    const objects = [
      { kind: "block", name: "dock", x: 0, y: -0.4, z: 16, color: "#8b6f47" },
      { kind: "block", name: "mansion", x: 0, y: 0, z: -15, color: "#d7d0bd" },
      { kind: "block", name: "lab", x: -13, y: 0, z: -10, color: "#61dafb" },
      { kind: "block", name: "kitchen", x: 4, y: 0, z: -13, color: "#f2b84b" },
      { kind: "block", name: "tower", x: 13, y: 0, z: 12, color: "#f472b6" },
      ...islandNpcs.map((npc) => ({ kind: "npc", name: npc.name, x: npc.x, y: 0, z: npc.z, color: "#39d98a" })),
      { kind: "hazard", name: "Epstein", x: s.epstein.x, y: 0, z: s.epstein.z, color: "#ff6b6b" },
      ...s.items.filter((item) => !item.found && !item.locked).map((item) => ({ kind: "coin", name: item.name, x: item.x, y: 0.6, z: item.z, color: "#f2b84b" }))
    ];
    return objects;
  }

  function drawIslandHud() {
    const s = state.island;
    const hud = document.querySelector("#islandHud");
    if (!hud) return;
    const clock = `${Math.floor(s.minute / 60)}:${String(Math.floor(s.minute % 60)).padStart(2, "0")}`;
    const completed = ["battery", "starMap", "fuse", "ledger", "flare", "launchKey"].filter((item) => s.inventory.includes(item)).length;
    hud.innerHTML = `
      <section class="band">
        <div class="band-head"><h3>Nightfall</h3><span class="pill ${s.minute > 16 * 60 ? "red" : "gold"}">${clock}</span></div>
        <div class="card-body">
          <div class="meter gold"><span style="width:${Math.min(100, ((s.minute - 8 * 60) / (10 * 60)) * 100)}%"></span></div>
          <div class="dialogue">${escapeHtml(s.dialogue)}</div>
          <div class="inventory">${s.inventory.map((item) => `<span class="pill green">${escapeHtml(labelItem(item))}</span>`).join("") || "<span class='pill'>empty</span>"}</div>
        </div>
      </section>
      <section class="band">
        <div class="band-head"><h3>Quests</h3><span class="pill">${completed}/6</span></div>
        <div class="card-body">
          ${questLine("Professor route", s.flags.routeReady)}
          ${questLine("Generator fuse", s.inventory.includes("fuse"))}
          ${questLine("Mansion ledger", s.inventory.includes("ledger"))}
          ${questLine("Signal flare", s.inventory.includes("flare"))}
          ${questLine("Launch key", s.inventory.includes("launchKey"))}
          ${questLine("Escape by boat", s.flags.escaped)}
          ${s.done ? `<button class="btn primary" id="restartIsland">Restart</button>` : ""}
        </div>
      </section>
    `;
    document.querySelector("#restartIsland")?.addEventListener("click", () => {
      state.island = createIslandState();
    });
  }

  function questLine(label, done) {
    return `<div class="split"><span>${escapeHtml(label)}</span><span class="pill ${done ? "green" : ""}">${done ? "done" : "open"}</span></div>`;
  }

  function islandInteract() {
    const s = state.island;
    if (!s || s.done) return;
    const item = s.items.find((candidate) => !candidate.found && !candidate.locked && distance(s.player, candidate) < 1.8);
    if (item) {
      item.found = true;
      s.inventory.push(item.id);
      s.dialogue = `Picked up ${item.name}.`;
      return;
    }
    const npc = islandNpcs.find((candidate) => distance(s.player, candidate) < 2.1);
    if (npc) {
      if (npc.id === "hawking" && s.inventory.includes("battery") && s.inventory.includes("starMap")) {
        s.flags.routeReady = true;
        s.dialogue = "Professor Hawking plots a route through the reef and marks the safe channel.";
      } else if (npc.id === "marina" && s.inventory.includes("ledger") && s.flags.routeReady) {
        const key = s.items.find((candidate) => candidate.id === "launchKey");
        key.locked = false;
        s.dialogue = "Marina trusts the plan. The launch key is now on the dock crate.";
      } else if (npc.id === "chef" && s.inventory.includes("fuse")) {
        s.flags.generator = true;
        s.dialogue = "Chef Luis slots the fuse. Dock lights flicker on through the fog.";
      } else {
        s.dialogue = `${npc.name}: ${npc.line}`;
      }
      return;
    }
    if (distance(s.player, { x: 0, z: 16 }) < 2.6) {
      const ready = s.flags.routeReady && s.flags.generator && s.inventory.includes("launchKey") && s.inventory.includes("flare");
      if (ready) {
        s.flags.escaped = true;
        s.done = true;
        s.dialogue = "The flare burns green. The boat slips out before nightfall. You escaped.";
      } else {
        s.dialogue = "The boat needs route math, dock power, a launch key, and a flare.";
      }
      return;
    }
    s.dialogue = "Nothing close enough to use.";
  }

  function mountRogue() {
    const mount = document.querySelector("#gameMount");
    if (!state.rogue || state.rogue.done) state.rogue = createRogueState();
    mount.innerHTML = `
      <div class="game-layout">
        <aside class="game-hud" id="rogueHud"></aside>
        <div class="stage" id="rogueStage">
          <div class="overlay-top"><span class="pill green">co-op room</span><span class="pill gold">randomized floors</span></div>
        </div>
      </div>
    `;
    const renderer = new SceneRenderer(document.querySelector("#rogueStage"), { theme: "rogue" });
    state.cleanup = () => renderer.dispose();
    drawRogue(renderer);
  }

  function createRogueState() {
    return {
      depth: 1,
      heat: 0,
      resolve: 100,
      intel: 1,
      keys: 0,
      supplies: 3,
      done: false,
      won: false,
      log: ["The party enters through the public lobby."],
      event: rogueEvents[0]
    };
  }

  function drawRogue(renderer) {
    const s = state.rogue;
    renderer.setObjects(rogueSceneObjects(s));
    renderer.setPlayer({ x: 0, z: clamp(8 - s.depth, -6, 8) });
    const hud = document.querySelector("#rogueHud");
    if (!hud) return;
    hud.innerHTML = `
      <section class="band">
        <div class="band-head"><h3>Depth ${s.depth}</h3><span class="pill ${s.done ? (s.won ? "green" : "red") : "gold"}">${escapeHtml(s.event)}</span></div>
        <div class="card-body">
          <div class="split"><span>Resolve</span><strong>${s.resolve}</strong></div>
          <div class="meter"><span style="width:${clamp(s.resolve, 0, 100)}%"></span></div>
          <div class="split"><span>Heat</span><strong>${s.heat}</strong></div>
          <div class="meter red"><span style="width:${clamp(s.heat, 0, 100)}%"></span></div>
          <div class="row">
            <span class="pill">intel ${s.intel}</span>
            <span class="pill">keys ${s.keys}</span>
            <span class="pill">supplies ${s.supplies}</span>
          </div>
        </div>
      </section>
      <section class="band">
        <div class="band-head"><h3>Actions</h3><span class="pill">${state.players.length || 1} party</span></div>
        <div class="card-body">
          ${s.done ? `<button class="btn primary" id="restartRogue">New Run</button>` : `
            <button class="btn primary" data-rogue-action="sneak">Sneak</button>
            <button class="btn gold" data-rogue-action="talk">Talk Past</button>
            <button class="btn" data-rogue-action="distract">Distract</button>
            <button class="btn red" data-rogue-action="rush">Rush Elevator</button>
          `}
        </div>
      </section>
      <section class="band">
        <div class="band-head"><h3>Run Log</h3><span class="pill">${s.log.length}</span></div>
        <div class="card-body">${s.log.slice(-8).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>
      </section>
    `;
    document.querySelector("#restartRogue")?.addEventListener("click", () => {
      state.rogue = createRogueState();
      drawRogue(renderer);
      sendWs({ type: "rogue-action", payload: state.rogue, echo: true });
    });
    document.querySelectorAll("[data-rogue-action]").forEach((button) => {
      button.addEventListener("click", () => rogueAction(button.dataset.rogueAction, renderer));
    });
  }

  function rogueSceneObjects(s) {
    const objects = [];
    for (let i = 0; i < 10; i += 1) {
      objects.push({ kind: "block", name: "wall", x: -5, y: 0, z: i - 5, color: "#4b5568" });
      objects.push({ kind: "block", name: "wall", x: 5, y: 0, z: i - 5, color: "#4b5568" });
      if ((i + s.depth) % 3 === 0) objects.push({ kind: "hazard", name: "guard", x: (i % 2 ? -2 : 2), y: 0, z: i - 5, color: "#ff6b6b" });
      if ((i + s.depth) % 4 === 0) objects.push({ kind: "coin", name: "file", x: 0, y: 0.5, z: i - 5, color: "#f2b84b" });
    }
    objects.push({ kind: "goal", name: s.depth >= 12 ? "Xenu" : "elevator", x: 0, y: 0, z: -6, color: s.depth >= 12 ? "#f472b6" : "#39d98a" });
    return objects;
  }

  function rogueAction(action, renderer) {
    const s = state.rogue;
    if (s.done) return;
    const risk = { sneak: 18, talk: 25, distract: 32, rush: 48 }[action];
    const reward = { sneak: "intel", talk: "keys", distract: "supplies", rush: "depth" }[action];
    const roll = Math.floor(Math.random() * 100) + (action === "sneak" ? s.intel * 4 : 0) + (action === "talk" ? s.keys * 3 : 0);
    if (roll > risk) {
      if (reward === "depth") s.depth += 2;
      else s[reward] += 1;
      s.depth += 1;
      s.heat = Math.max(0, s.heat - 4);
      s.log.push(`${state.user.displayName} used ${action} and advanced to sublevel ${s.depth}.`);
    } else {
      s.heat += risk;
      s.resolve -= Math.round(risk / 2);
      s.log.push(`${state.user.displayName}'s ${action} went loud. Security heat rises.`);
    }
    if (s.depth >= 12) {
      s.done = true;
      s.won = true;
      s.event = "Xenu chamber";
      s.log.push("The party reaches Xenu and wins the run.");
    } else if (s.heat >= 100 || s.resolve <= 0) {
      s.done = true;
      s.won = false;
      s.log.push("The group is blocked, escorted out, and the run ends.");
    } else {
      s.event = rogueEvents[Math.min(s.depth - 1, rogueEvents.length - 1)];
    }
    sendWs({ type: "rogue-action", payload: s, echo: true });
    drawRogue(renderer);
  }

  function mountCreatorGame(game, inline = false) {
    const mount = inline ? document.querySelector("#studioStage") : document.querySelector("#gameMount");
    if (!mount) return;
    mount.innerHTML = `
      <div class="game-layout">
        <aside class="game-hud">
          <section class="band">
            <div class="band-head"><h3>${escapeHtml(game.title)}</h3><span class="pill green">${inline ? "playtest" : "creator"}</span></div>
            <div class="card-body">
              <p>${escapeHtml(game.description || "")}</p>
              <div class="dialogue script-box">${escapeHtml(game.script || "No script.")}</div>
            </div>
          </section>
          <section class="band"><div class="card-body">${renderChat()}</div></section>
        </aside>
        <div class="stage" id="creatorStage">
          <div class="overlay-top"><span class="pill green">runtime scene</span><span class="pill">${(game.scene?.objects || []).length} objects</span></div>
        </div>
      </div>
    `;
    const renderer = new SceneRenderer(document.querySelector("#creatorStage"), { theme: "creator" });
    renderer.setObjects(game.scene?.objects || []);
    renderer.setPlayer({ x: 0, z: 5 });
    bindChat();
    state.cleanup = () => renderer.dispose();
  }

  function connectRoom(room) {
    if (state.wsRoom === room && state.ws && state.ws.readyState === WebSocket.OPEN) return;
    if (state.ws) state.ws.close();
    state.wsRoom = room;
    state.players = [];
    state.chat = [];
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${location.host}/ws?room=${encodeURIComponent(room)}&token=${encodeURIComponent(state.token)}`;
    const ws = new WebSocket(url);
    state.ws = ws;
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "welcome") {
        state.clientId = message.clientId;
        state.players = message.players || [];
        if (message.state?.cards) state.cards = message.state.cards;
        if (message.state?.rogue) state.rogue = message.state.rogue;
      } else if (message.type === "presence") {
        state.players = message.players || [];
      } else if (message.type === "chat") {
        state.chat.push(message);
        updateChatDom();
      } else if (message.type === "cards") {
        state.cards = message.payload;
        drawCards();
      } else if (message.type === "studio-patch") {
        applyStudioPatch(message.payload);
      } else if (message.type === "rogue-action") {
        state.rogue = message.payload;
        if (currentRoute() === "game" && location.hash.includes("builtin-xenu")) mountRogue();
      }
      updatePresenceBits();
    });
    ws.addEventListener("open", () => updatePresenceBits());
    ws.addEventListener("close", () => updatePresenceBits());
  }

  function sendWs(message) {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.send(JSON.stringify(message));
    }
  }

  function applyStudioPatch(payload) {
    if (currentRoute() !== "studio" || !payload) return;
    if (payload.action === "add" && payload.object) {
      state.studio.objects.push(payload.object);
    } else if (payload.action === "clear") {
      state.studio.objects = [{ kind: "spawn", name: "Spawn", x: 0, y: 0, z: 0, color: "#39d98a" }];
    } else if (payload.action === "delete") {
      state.studio.objects.splice(Number(payload.index), 1);
    } else {
      return;
    }
    activeStudioRenderer?.setObjects(state.studio.objects);
    const list = document.querySelector("#objectList");
    if (list) {
      list.innerHTML = renderObjectList();
      if (activeStudioRenderer) bindObjectDeletes(activeStudioRenderer);
    }
    toast("Studio updated by collaborator");
  }

  function updatePresenceBits() {
    document.querySelectorAll(".side-room .pill").forEach((pill) => {
      pill.textContent = `${state.players.length} live`;
    });
  }

  class SceneRenderer {
    constructor(stage, options = {}) {
      this.stage = stage;
      this.options = options;
      this.objects = [];
      this.player = { x: 0, z: 0 };
      this.frame = 0;
      this.disposed = false;
      this.useThree = Boolean(window.THREE && stage);
      if (this.useThree) this.initThree();
      else this.initCanvas();
    }

    initThree() {
      const THREE = window.THREE;
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(this.backgroundColor());
      this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1000);
      this.camera.position.set(8, 9, 12);
      this.camera.lookAt(0, 0, 0);
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.stage.appendChild(this.renderer.domElement);
      this.group = new THREE.Group();
      this.scene.add(this.group);
      const ambient = new THREE.AmbientLight(0xffffff, 0.72);
      this.scene.add(ambient);
      const light = new THREE.DirectionalLight(0xffffff, 0.9);
      light.position.set(8, 14, 10);
      this.scene.add(light);
      const ground = new THREE.Mesh(
        new THREE.BoxGeometry(40, 0.1, 40),
        new THREE.MeshLambertMaterial({ color: this.groundColor() })
      );
      ground.position.y = -0.58;
      this.scene.add(ground);
      this.playerMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.4, 0.8),
        new THREE.MeshLambertMaterial({ color: 0x39d98a })
      );
      this.playerMesh.position.y = 0.2;
      this.scene.add(this.playerMesh);
      this.resize = () => {
        if (!this.stage || !this.renderer) return;
        const width = Math.max(1, this.stage.clientWidth);
        const height = Math.max(1, this.stage.clientHeight);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
      };
      window.addEventListener("resize", this.resize);
      this.resize();
      this.animate = () => {
        if (this.disposed) return;
        this.frame += 0.01;
        this.group.rotation.y = Math.sin(this.frame) * 0.035;
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.animate);
      };
      this.animate();
    }

    initCanvas() {
      this.canvas = document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d");
      this.stage.appendChild(this.canvas);
      this.resize = () => {
        const rect = this.stage.getBoundingClientRect();
        this.canvas.width = Math.max(1, Math.floor(rect.width * (window.devicePixelRatio || 1)));
        this.canvas.height = Math.max(1, Math.floor(rect.height * (window.devicePixelRatio || 1)));
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.drawCanvas();
      };
      window.addEventListener("resize", this.resize);
      this.resize();
    }

    backgroundColor() {
      return { island: 0x0d1511, rogue: 0x141118, studio: 0x10141c, creator: 0x10141c }[this.options.theme] || 0x111318;
    }

    groundColor() {
      return { island: 0x214f3d, rogue: 0x2d3038, studio: 0x26303b, creator: 0x26303b }[this.options.theme] || 0x26303b;
    }

    setObjects(objects = []) {
      this.objects = objects;
      if (this.useThree) {
        while (this.group.children.length) this.group.remove(this.group.children[0]);
        for (const object of objects) this.group.add(this.meshFor(object));
      } else {
        this.drawCanvas();
      }
    }

    setPlayer(player) {
      this.player = player || this.player;
      if (this.useThree && this.playerMesh) {
        this.playerMesh.position.x = this.player.x;
        this.playerMesh.position.z = this.player.z;
        this.camera.position.x += ((this.player.x + 8) - this.camera.position.x) * 0.08;
        this.camera.position.z += ((this.player.z + 12) - this.camera.position.z) * 0.08;
        this.camera.lookAt(this.player.x, 0, this.player.z);
      } else {
        this.drawCanvas();
      }
    }

    meshFor(object) {
      const THREE = window.THREE;
      const color = parseInt(String(object.color || defaultColor(object.kind)).replace("#", ""), 16);
      let geometry;
      if (object.kind === "coin" || object.kind === "sound") geometry = new THREE.SphereGeometry(0.45, 24, 16);
      else if (object.kind === "npc") geometry = THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.35, 1, 4, 8) : new THREE.BoxGeometry(0.7, 1.4, 0.7);
      else if (object.kind === "hazard") geometry = new THREE.ConeGeometry(0.55, 1.5, 4);
      else if (object.kind === "goal") geometry = new THREE.CylinderGeometry(0.65, 0.65, 1.4, 8);
      else geometry = new THREE.BoxGeometry(object.kind === "block" ? 1.8 : 1, object.kind === "block" ? 1 : 1.2, object.kind === "block" ? 1.8 : 1);
      const material = new THREE.MeshLambertMaterial({ color });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(Number(object.x || 0), Number(object.y || 0), Number(object.z || 0));
      if (object.kind === "block") mesh.position.y += 0.05;
      return mesh;
    }

    drawCanvas() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const width = this.canvas.width;
      const height = this.canvas.height;
      ctx.fillStyle = this.options.theme === "island" ? "#183629" : "#12151b";
      ctx.fillRect(0, 0, width, height);
      const scale = Math.min(width, height) / 48;
      const centerX = width / 2;
      const centerY = height / 2;
      const labels = [];
      for (const object of this.objects) {
        const x = centerX + Number(object.x || 0) * scale;
        const y = centerY + Number(object.z || 0) * scale;
        ctx.fillStyle = object.color || defaultColor(object.kind);
        ctx.beginPath();
        if (object.kind === "coin" || object.kind === "npc" || object.kind === "hazard") {
          ctx.arc(x, y, object.kind === "hazard" ? 9 : 7, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(x - 10, y - 10, 20, 20);
        }
        if (object.name) {
          labels.push({ text: object.name, x, y });
        }
      }
      this.drawCanvasLabels(labels);
      const px = centerX + Number(this.player.x || 0) * scale;
      const py = centerY + Number(this.player.z || 0) * scale;
      ctx.fillStyle = "#39d98a";
      ctx.fillRect(px - 7, py - 7, 14, 14);
    }

    drawCanvasLabels(labels) {
      const ratio = window.devicePixelRatio || 1;
      const fontSize = 12 * ratio;
      const paddingX = 4 * ratio;
      const paddingY = 3 * ratio;
      const placed = [];
      this.ctx.font = `${fontSize}px sans-serif`;
      for (const label of labels) {
        const text = String(label.text);
        const width = this.ctx.measureText(text).width + paddingX * 2;
        const height = fontSize + paddingY * 2;
        const attempts = [
          [10 * ratio, -10 * ratio],
          [10 * ratio, 10 * ratio],
          [-width - 10 * ratio, -10 * ratio],
          [-width - 10 * ratio, 10 * ratio],
          [-width / 2, -24 * ratio],
          [-width / 2, 14 * ratio]
        ];
        const box = attempts
          .map(([dx, dy]) => ({
            x: Math.max(4 * ratio, Math.min(this.canvas.width - width - 4 * ratio, label.x + dx)),
            y: Math.max(4 * ratio, Math.min(this.canvas.height - height - 4 * ratio, label.y + dy)),
            width,
            height
          }))
          .find((candidate) => !placed.some((other) => boxesOverlap(candidate, other)));
        if (!box) continue;
        placed.push(box);
        this.ctx.fillStyle = "rgb(13 15 19 / 76%)";
        this.ctx.fillRect(box.x, box.y, box.width, box.height);
        this.ctx.fillStyle = "#f4f1e8";
        this.ctx.fillText(text, box.x + paddingX, box.y + fontSize + paddingY / 2);
      }
    }

    dispose() {
      this.disposed = true;
      window.removeEventListener("resize", this.resize);
      if (this.renderer?.domElement?.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    }
  }

  function defaultColor(kind) {
    return {
      npc: "#39d98a",
      hazard: "#ff6b6b",
      coin: "#f2b84b",
      goal: "#f472b6",
      spawn: "#61dafb",
      sound: "#c084fc",
      trigger: "#f472b6",
      door: "#8b6f47"
    }[kind] || "#5f6f86";
  }

  function boxesOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function labelItem(id) {
    return islandItems.find((item) => item.id === id)?.name || id;
  }

  function distance(a, b) {
    return Math.hypot(Number(a.x || 0) - Number(b.x || 0), Number(a.z || 0) - Number(b.z || 0));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value || 0)));
  }

  function sample(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function capitalize(value) {
    return String(value).slice(0, 1).toUpperCase() + String(value).slice(1);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function attr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function toast(message, tone = "green") {
    const root = document.querySelector("#toast");
    if (!root) return;
    const item = document.createElement("div");
    item.className = "toast-item";
    item.style.borderLeftColor = tone === "red" ? "var(--red)" : "var(--green)";
    item.textContent = message;
    root.appendChild(item);
    setTimeout(() => item.remove(), 3200);
  }
})();
