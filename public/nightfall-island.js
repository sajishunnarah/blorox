const NPCS = [
  {
    id: "hawking",
    name: "Professor Hawking",
    x: -17,
    z: -8,
    quest: "Reef route",
    line: "A safe channel exists, but I need my chair battery and the observatory star map to calculate it."
  },
  {
    id: "dana",
    name: "Dana Vale",
    x: -6,
    z: -23,
    quest: "Evidence trail",
    line: "The north mansion has a ledger. Security kept a camera tape. Bring both and I can decode the radio phrase."
  },
  {
    id: "chef",
    name: "Chef Luis",
    x: 8,
    z: -16,
    quest: "Dock power",
    line: "The generator needs a kitchen fuse and a power cell from the service shed."
  },
  {
    id: "marina",
    name: "Marina",
    x: 18,
    z: 22,
    quest: "Launch prep",
    line: "I can unlock the launch key once the route, radio phrase, and dock power are ready."
  },
  {
    id: "porter",
    name: "Porter Ives",
    x: 22,
    z: -2,
    quest: "Service gate",
    line: "Bolt cutters are in the boathouse. They open the service gate behind the mansion."
  }
];

const ITEMS = [
  { id: "battery", name: "chair battery", x: -24, z: -12, area: "lab", hint: "A battery hums on a lab bench." },
  { id: "starMap", name: "star map", x: -7, z: 17, area: "observatory", hint: "A star chart is pinned under a brass weight." },
  { id: "fuse", name: "radio fuse", x: 10, z: -20, area: "kitchen", hint: "A fuse box hangs open beside the freezer." },
  { id: "ledger", name: "island ledger", x: 1, z: -29, area: "mansion", hint: "A ledger sits in the mansion office." },
  { id: "cameraTape", name: "camera tape", x: -6, z: -27, area: "security room", hint: "A tape is still warm in the recorder." },
  { id: "powerCell", name: "power cell", x: 18, z: -12, area: "service shed", hint: "A portable power cell is behind the shed." },
  { id: "boltCutters", name: "bolt cutters", x: 23, z: 16, area: "boathouse", hint: "Bolt cutters hang by the boathouse door." },
  { id: "flare", name: "signal flare", x: 26, z: 7, area: "radio tower", hint: "A flare rests under the tower ladder." },
  { id: "radioCode", name: "radio phrase", x: -12, z: -24, area: "security room", locked: (s) => !s.flags.evidenceReady, hint: "Dana can decode the phrase after reviewing evidence." },
  { id: "launchKey", name: "launch key", x: 17, z: 25, area: "dock crate", locked: (s) => !s.flags.launchKeyReady, hint: "Marina will release this when the escape plan is credible." }
];

const QUESTS = [
  ["Route math", (s) => s.flags.routeReady],
  ["Evidence decoded", (s) => s.flags.evidenceReady],
  ["Dock generator", (s) => s.flags.generator],
  ["Service gate", (s) => s.flags.gateOpen],
  ["Launch key", (s) => s.inventory.has("launchKey")],
  ["Boat escape", (s) => s.flags.escaped]
];

const PATROL = [
  { x: 0, z: -27 },
  { x: 15, z: -18 },
  { x: 20, z: 0 },
  { x: 5, z: 13 },
  { x: -16, z: 7 },
  { x: -13, z: -18 }
];

const BUILDINGS = [
  { name: "Mansion", x: 0, z: -27, w: 17, d: 11, color: 0xd8cfb7, interior: true },
  { name: "Lab", x: -24, z: -12, w: 9, d: 7, color: 0x7bc8de, interior: true },
  { name: "Kitchen", x: 9, z: -19, w: 9, d: 8, color: 0xe2a84b, interior: true },
  { name: "Security", x: -8, z: -25, w: 7, d: 6, color: 0x8992a5, interior: true },
  { name: "Service Shed", x: 18, z: -12, w: 6, d: 5, color: 0x6f7d64, interior: true },
  { name: "Observatory", x: -7, z: 17, w: 8, d: 8, color: 0x58617c, interior: true },
  { name: "Boathouse", x: 23, z: 16, w: 8, d: 7, color: 0x8b6f47, interior: true },
  { name: "Radio Tower", x: 26, z: 7, w: 4, d: 4, color: 0xb67de2, interior: false },
  { name: "Dock", x: 17, z: 25, w: 14, d: 4, color: 0x8b6f47, interior: false }
];

const COVER = [
  { x: -12, z: 3, r: 3.6 },
  { x: -21, z: 8, r: 3 },
  { x: 13, z: 8, r: 3.2 },
  { x: 2, z: -7, r: 2.7 },
  { x: 26, z: -8, r: 2.9 },
  { x: -29, z: -20, r: 2.8 }
];

export class NightfallIslandGame {
  constructor({ mount, keys, playTone, escapeHtml }) {
    this.mount = mount;
    this.keys = keys;
    this.playTone = playTone;
    this.escapeHtml = escapeHtml;
    this.THREE = window.THREE;
    this.state = this.createState();
    this.entities = new Map();
    this.itemMeshes = new Map();
    this.npcMeshes = new Map();
    this.clock = null;
    this.raf = 0;
    this.disposed = false;
    this.lastHud = 0;
    this.interactLatch = false;
  }

  createState() {
    return {
      player: { x: 0, z: 24, angle: Math.PI, stamina: 100, crouch: false },
      enemy: { x: -8, z: -16, mode: "patrol", waypoint: 0, alert: 0, lastSeen: null },
      minute: 15 * 60 + 25,
      inventory: new Set(),
      flags: {},
      itemFound: new Set(),
      dialogue: "Find a route, restore the dock, gather evidence, and launch before nightfall.",
      nearby: "Move with WASD. Hold Shift to sprint, C to crouch, E to interact.",
      done: false,
      won: false,
      caught: false
    };
  }

  start() {
    if (!this.THREE) {
      this.mount.innerHTML = `<div class="empty">Three.js did not load, so Nightfall Island cannot start.</div>`;
      return;
    }
    this.mount.innerHTML = `
      <div class="game-layout nightfall-layout">
        <aside class="game-hud" id="islandHud"></aside>
        <div class="stage nightfall-stage" id="islandStage" data-game="nightfall-island">
          <div class="overlay-top">
            <span class="pill green">Three.js / WebGL</span>
            <span class="pill">WASD</span>
            <span class="pill">Shift sprint</span>
            <span class="pill">C crouch</span>
          </div>
          <div class="overlay-bottom">
            <button class="btn primary" id="islandInteract">Interact</button>
            <button class="btn ghost" id="islandCrouch">Crouch</button>
          </div>
        </div>
      </div>
    `;
    this.hud = this.mount.querySelector("#islandHud");
    this.stage = this.mount.querySelector("#islandStage");
    this.mount.querySelector("#islandInteract")?.addEventListener("click", () => this.interact());
    this.mount.querySelector("#islandCrouch")?.addEventListener("click", () => {
      this.state.player.crouch = !this.state.player.crouch;
      this.drawHud(true);
    });
    this.initThree();
    this.buildWorld();
    this.clock = new this.THREE.Clock();
    this.loop();
  }

  initThree() {
    const THREE = this.THREE;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07100d);
    this.scene.fog = new THREE.FogExp2(0x07100d, 0.026);
    this.camera = new THREE.PerspectiveCamera(66, 1, 0.1, 450);
    this.camera.position.set(0, 12, 35);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.dataset.engine = "three";
    this.renderer.domElement.dataset.game = "nightfall-island";
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.stage.appendChild(this.renderer.domElement);
    this.resize = () => {
      const width = Math.max(1, this.stage.clientWidth);
      const height = Math.max(1, this.stage.clientHeight);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
    };
    window.addEventListener("resize", this.resize);
    this.resize();

    const ambient = new THREE.HemisphereLight(0x9fc8b0, 0x1f2a26, 0.78);
    this.scene.add(ambient);
    this.sun = new THREE.DirectionalLight(0xffd99a, 1.25);
    this.sun.position.set(-24, 34, 18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.sun);
    this.moon = new THREE.DirectionalLight(0x7fa8ff, 0.22);
    this.moon.position.set(25, 22, -18);
    this.scene.add(this.moon);
  }

  buildWorld() {
    const THREE = this.THREE;
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 180),
      new THREE.MeshPhongMaterial({
        color: 0x102f3a,
        map: this.makeTexture("#102f3a", "#1d5365", "water"),
        shininess: 70,
        transparent: true,
        opacity: 0.88
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.75;
    this.scene.add(water);

    const terrain = new THREE.PlaneGeometry(76, 76, 80, 80);
    terrain.rotateX(-Math.PI / 2);
    const pos = terrain.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const edge = Math.max(0, Math.hypot(x * 0.92, z * 1.05) - 30);
      const y = Math.sin(x * 0.21) * 0.22 + Math.cos(z * 0.27) * 0.18 - edge * 0.32;
      pos.setY(i, y);
    }
    terrain.computeVertexNormals();
    const ground = new THREE.Mesh(
      terrain,
      new THREE.MeshLambertMaterial({ color: 0x245f43, map: this.makeTexture("#245f43", "#143f2a", "grass") })
    );
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.addForest();
    for (const building of BUILDINGS) this.addBuilding(building);
    for (const cover of COVER) this.addCover(cover);
    for (const npc of NPCS) this.addNpc(npc);
    for (const item of ITEMS) this.addItem(item);
    this.addEscapeBoat();
    this.addPlayer();
    this.addEnemy();
  }

  addForest() {
    for (let i = 0; i < 46; i += 1) {
      const angle = i * 2.399;
      const radius = 12 + (i * 7) % 22;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (Math.abs(x) < 7 && z > 17) continue;
      if (Math.hypot(x * 0.92, z * 1.05) > 33) continue;
      this.scene.add(this.makeTree(x, z, 1 + (i % 4) * 0.12));
    }
  }

  makeTree(x, z, scale = 1) {
    const THREE = this.THREE;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18 * scale, 0.26 * scale, 1.7 * scale, 8),
      new THREE.MeshLambertMaterial({ color: 0x5b3d27 })
    );
    trunk.position.y = 0.55 * scale;
    trunk.castShadow = true;
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(1.05 * scale, 2.4 * scale, 9),
      new THREE.MeshLambertMaterial({ color: 0x143f2a })
    );
    leaves.position.y = 2.15 * scale;
    leaves.castShadow = true;
    tree.add(trunk, leaves);
    tree.position.set(x, 0, z);
    return tree;
  }

  addCover(cover) {
    const THREE = this.THREE;
    const grass = new THREE.Mesh(
      new THREE.CylinderGeometry(cover.r, cover.r * 0.92, 0.42, 18),
      new THREE.MeshLambertMaterial({ color: 0x1a6a45, transparent: true, opacity: 0.78 })
    );
    grass.position.set(cover.x, 0.05, cover.z);
    grass.receiveShadow = true;
    this.scene.add(grass);
  }

  addBuilding(building) {
    const THREE = this.THREE;
    const group = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(building.w, 0.22, building.d),
      new THREE.MeshLambertMaterial({ color: building.color })
    );
    floor.position.y = 0.02;
    floor.receiveShadow = true;
    group.add(floor);
    const wallMat = new THREE.MeshLambertMaterial({
      color: building.color,
      map: this.makeTexture(`#${building.color.toString(16).padStart(6, "0")}`, "#111318", building.interior ? "plaster" : "wood"),
      transparent: true,
      opacity: building.interior ? 0.92 : 1
    });
    const height = building.interior ? 1.8 : 3.2;
    const walls = [
      [0, height / 2, -building.d / 2, building.w, height, 0.28],
      [0, height / 2, building.d / 2, building.w, height, 0.28],
      [-building.w / 2, height / 2, 0, 0.28, height, building.d],
      [building.w / 2, height / 2, 0, 0.28, height, building.d]
    ];
    for (const [x, y, z, w, h, d] of walls) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      wall.position.set(x, y, z);
      wall.castShadow = true;
      group.add(wall);
    }
    if (building.name === "Radio Tower") {
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.42, 8, 8),
        new THREE.MeshLambertMaterial({ color: 0xb67de2 })
      );
      tower.position.y = 4;
      tower.castShadow = true;
      group.add(tower);
    }
    group.position.set(building.x, 0, building.z);
    group.add(this.makeLabel(building.name, 0, height + 0.9, 0));
    this.scene.add(group);
  }

  addNpc(npc) {
    const body = this.makeCharacter(0x39d98a, npc.name);
    body.position.set(npc.x, 0, npc.z);
    this.npcMeshes.set(npc.id, body);
    this.scene.add(body);
  }

  addItem(item) {
    const THREE = this.THREE;
    const group = new THREE.Group();
    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 1),
      new THREE.MeshLambertMaterial({ color: 0xf2b84b, emissive: 0x332000 })
    );
    orb.position.y = 0.7;
    orb.castShadow = true;
    group.add(orb, this.makeLabel(item.name, 0, 1.45, 0));
    group.position.set(item.x, 0, item.z);
    this.itemMeshes.set(item.id, group);
    this.scene.add(group);
  }

  addEscapeBoat() {
    const THREE = this.THREE;
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.8, 1.7),
      new THREE.MeshLambertMaterial({ color: 0x6a4028 })
    );
    hull.position.y = 0.25;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1, 1.2),
      new THREE.MeshLambertMaterial({ color: 0xd8cfb7 })
    );
    cabin.position.set(0.2, 1.05, 0);
    boat.add(hull, cabin, this.makeLabel("escape boat", 0, 2.1, 0));
    boat.position.set(18, -0.25, 29);
    this.scene.add(boat);
  }

  addPlayer() {
    this.playerMesh = this.makeCharacter(0x61dafb, "you");
    this.scene.add(this.playerMesh);
  }

  addEnemy() {
    const THREE = this.THREE;
    this.enemyMesh = this.makeCharacter(0xff4d4d, "Epstein");
    this.scene.add(this.enemyMesh);
    this.enemyLight = new THREE.SpotLight(0xff6b6b, 1.2, 12, Math.PI / 7, 0.45, 1);
    this.enemyLight.position.set(0, 3.2, 0);
    this.enemyTarget = new THREE.Object3D();
    this.scene.add(this.enemyLight, this.enemyTarget);
    this.enemyLight.target = this.enemyTarget;
  }

  makeCharacter(color, label) {
    const THREE = this.THREE;
    const group = new THREE.Group();
    const material = new THREE.MeshLambertMaterial({ color });
    const body = THREE.CapsuleGeometry
      ? new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.1, 5, 10), material)
      : new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), material);
    body.position.y = 0.85;
    body.castShadow = true;
    group.add(body, this.makeLabel(label, 0, 2.2, 0));
    return group;
  }

  makeTexture(base, accent, type) {
    const THREE = this.THREE;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 128;
    canvas.height = 128;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = type === "water" ? 0.22 : 0.16;
    ctx.strokeStyle = accent;
    ctx.lineWidth = type === "plaster" ? 2 : 1;
    for (let i = 0; i < 42; i += 1) {
      const x = (i * 37) % 128;
      const y = (i * 53) % 128;
      if (type === "water") {
        ctx.beginPath();
        ctx.moveTo(x - 26, y);
        ctx.bezierCurveTo(x - 6, y - 9, x + 18, y + 9, x + 42, y);
        ctx.stroke();
      } else if (type === "wood") {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo((x + 22) % 128, 128);
        ctx.stroke();
      } else {
        ctx.fillRect(x, y, 2 + (i % 5), 2 + (i % 7));
      }
    }
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(type === "water" ? 9 : 5, type === "water" ? 9 : 5);
    return texture;
  }

  makeLabel(text, x, y, z) {
    const THREE = this.THREE;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 256;
    canvas.height = 64;
    ctx.fillStyle = "rgba(13,15,19,0.78)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f4f1e8";
    ctx.font = "700 26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.position.set(x, y, z);
    sprite.scale.set(3.2, 0.8, 1);
    return sprite;
  }

  loop() {
    if (this.disposed) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(() => this.loop());
  }

  update(dt) {
    const s = this.state;
    if (!s.done) {
      this.handleInput(dt);
      this.updateEnemy(dt);
      this.updateClock(dt);
      this.updateItems();
      this.checkEndStates();
    }
    this.updateMeshes(dt);
    const elapsed = performance.now();
    if (elapsed - this.lastHud > 160 || s.done) {
      this.drawHud();
      this.lastHud = elapsed;
    }
  }

  handleInput(dt) {
    const p = this.state.player;
    if (this.keys.c && !this.crouchLatch) {
      p.crouch = !p.crouch;
      this.crouchLatch = true;
    }
    if (!this.keys.c) this.crouchLatch = false;
    if (this.keys.e && !this.interactLatch) {
      this.interact();
      this.interactLatch = true;
    }
    if (!this.keys.e) this.interactLatch = false;

    let dx = 0;
    let dz = 0;
    if (this.keys.w || this.keys.arrowup) dz -= 1;
    if (this.keys.s || this.keys.arrowdown) dz += 1;
    if (this.keys.a || this.keys.arrowleft) dx -= 1;
    if (this.keys.d || this.keys.arrowright) dx += 1;
    const length = Math.hypot(dx, dz);
    if (!length) {
      p.stamina = Math.min(100, p.stamina + dt * 10);
      return;
    }
    dx /= length;
    dz /= length;
    const sprinting = this.keys.shift && p.stamina > 4 && !p.crouch;
    const speed = p.crouch ? 4.2 : sprinting ? 9.2 : 6.1;
    if (sprinting) p.stamina = Math.max(0, p.stamina - dt * 18);
    else p.stamina = Math.min(100, p.stamina + dt * 7);
    const next = { x: p.x + dx * speed * dt, z: p.z + dz * speed * dt };
    if (this.isWalkable(next.x, next.z)) {
      p.x = next.x;
      p.z = next.z;
      p.angle = Math.atan2(dx, dz);
    }
  }

  updateClock(dt) {
    this.state.minute += dt * 6.2;
    const dusk = Math.min(1, Math.max(0, (this.state.minute - 17 * 60) / 120));
    this.scene.fog.density = 0.026 + dusk * 0.026;
    this.sun.intensity = 1.25 - dusk * 0.85;
    this.moon.intensity = 0.22 + dusk * 0.5;
  }

  updateEnemy(dt) {
    const e = this.state.enemy;
    const p = this.state.player;
    const distance = this.distance(p, e);
    const hidden = p.crouch && COVER.some((cover) => this.distance(p, cover) < cover.r + 0.6);
    const blocked = this.lineBlocked(p, e);
    const visible = distance < (p.crouch ? 5.5 : 10.5) && !hidden && !blocked;
    if (visible) {
      e.alert = Math.min(100, e.alert + dt * (p.crouch ? 18 : 42));
      e.lastSeen = { x: p.x, z: p.z };
      if (e.alert > 48) e.mode = "chase";
    } else {
      e.alert = Math.max(0, e.alert - dt * 18);
      if (e.mode === "chase" && e.alert < 12) e.mode = "search";
    }

    let target;
    let speed;
    if (e.mode === "chase" && e.lastSeen) {
      target = e.lastSeen;
      speed = 5.3;
    } else if (e.mode === "search" && e.lastSeen) {
      target = e.lastSeen;
      speed = 3.0;
      if (this.distance(e, target) < 1.1) e.mode = "patrol";
    } else {
      target = PATROL[e.waypoint];
      speed = 2.4;
      if (this.distance(e, target) < 1.2) e.waypoint = (e.waypoint + 1) % PATROL.length;
    }
    this.moveEnemyToward(target, speed, dt);
    if (distance < 1.3 && e.mode === "chase") {
      this.state.caught = true;
      this.state.done = true;
      this.state.dialogue = "You were caught in the open. Use buildings, crouch in cover, and break line of sight.";
      this.playTone(90, 0.45, "sawtooth");
    }
  }

  moveEnemyToward(target, speed, dt) {
    const e = this.state.enemy;
    const dx = target.x - e.x;
    const dz = target.z - e.z;
    const length = Math.hypot(dx, dz) || 1;
    e.x += (dx / length) * speed * dt;
    e.z += (dz / length) * speed * dt;
  }

  updateItems() {
    for (const item of ITEMS) {
      const mesh = this.itemMeshes.get(item.id);
      if (!mesh) continue;
      mesh.visible = !this.state.itemFound.has(item.id) && !this.itemLocked(item);
      mesh.rotation.y += 0.018;
    }
  }

  updateMeshes(dt) {
    const p = this.state.player;
    this.playerMesh.position.set(p.x, 0, p.z);
    this.playerMesh.rotation.y = p.angle;
    this.playerMesh.scale.y = p.crouch ? 0.72 : 1;
    const e = this.state.enemy;
    this.enemyMesh.position.set(e.x, 0, e.z);
    const look = e.lastSeen || PATROL[e.waypoint];
    this.enemyMesh.rotation.y = Math.atan2(look.x - e.x, look.z - e.z);
    this.enemyLight.position.set(e.x, 3.3, e.z);
    this.enemyTarget.position.set(e.x + Math.sin(this.enemyMesh.rotation.y) * 6, 0.8, e.z + Math.cos(this.enemyMesh.rotation.y) * 6);
    this.camera.position.x += ((p.x + 9) - this.camera.position.x) * Math.min(1, dt * 4.5);
    this.camera.position.z += ((p.z + 13) - this.camera.position.z) * Math.min(1, dt * 4.5);
    this.camera.position.y += (12 - this.camera.position.y) * Math.min(1, dt * 4.5);
    this.camera.lookAt(p.x, 0.7, p.z);
  }

  drawHud(force = false) {
    if (!this.hud && !force) return;
    const s = this.state;
    const clock = `${Math.floor(s.minute / 60)}:${String(Math.floor(s.minute % 60)).padStart(2, "0")}`;
    const inventory = [...s.inventory].map((id) => `<span class="pill green">${this.escapeHtml(this.itemName(id))}</span>`).join("") || "<span class='pill'>empty</span>";
    const quests = QUESTS.map(([label, done]) => `
      <div class="split"><span>${this.escapeHtml(label)}</span><span class="pill ${done(s) ? "green" : ""}">${done(s) ? "done" : "open"}</span></div>
    `).join("");
    const nearby = this.nearestInteractable();
    s.nearby = nearby ? nearby.label : "No interactable nearby.";
    this.hud.innerHTML = `
      <section class="band">
        <div class="band-head"><h3>Nightfall Island</h3><span class="pill ${s.minute > 18 * 60 ? "red" : "gold"}">${clock}</span></div>
        <div class="card-body">
          <div class="split"><span>Stamina</span><strong>${Math.round(s.player.stamina)}</strong></div>
          <div class="meter"><span style="width:${Math.round(s.player.stamina)}%"></span></div>
          <div class="split"><span>Alert</span><strong>${Math.round(s.enemy.alert)}</strong></div>
          <div class="meter red"><span style="width:${Math.round(s.enemy.alert)}%"></span></div>
          <div class="dialogue">${this.escapeHtml(s.dialogue)}</div>
          <div class="dialogue">${this.escapeHtml(s.nearby)}</div>
          <div class="inventory">${inventory}</div>
        </div>
      </section>
      <section class="band">
        <div class="band-head"><h3>Quest Chains</h3><span class="pill">${QUESTS.filter(([, done]) => done(s)).length}/${QUESTS.length}</span></div>
        <div class="card-body">${quests}</div>
      </section>
      <section class="band">
        <div class="band-head"><h3>Island Map</h3><span class="pill">${s.enemy.mode}</span></div>
        <div class="card-body"><div class="nightfall-map">${this.renderMapDots()}</div>${s.done ? `<button class="btn primary" id="restartIsland">Restart</button>` : ""}</div>
      </section>
    `;
    this.hud.querySelector("#restartIsland")?.addEventListener("click", () => this.restart());
  }

  renderMapDots() {
    const dot = (x, z, cls, label) => {
      const left = Math.max(3, Math.min(97, ((x + 36) / 72) * 100));
      const top = Math.max(3, Math.min(97, ((z + 36) / 72) * 100));
      return `<span class="map-dot ${cls}" style="left:${left}%;top:${top}%" title="${this.escapeHtml(label)}"></span>`;
    };
    return [
      dot(this.state.player.x, this.state.player.z, "player", "you"),
      dot(this.state.enemy.x, this.state.enemy.z, "enemy", "patrol"),
      ...NPCS.map((npc) => dot(npc.x, npc.z, "npc", npc.name)),
      ...ITEMS.filter((item) => !this.state.itemFound.has(item.id) && !this.itemLocked(item)).map((item) => dot(item.x, item.z, "item", item.name))
    ].join("");
  }

  interact() {
    if (this.state.done) return;
    const target = this.nearestInteractable();
    if (!target) {
      this.state.dialogue = "Nothing close enough to use.";
      this.playTone(180, 0.08, "square");
      this.drawHud(true);
      return;
    }
    target.use();
    this.drawHud(true);
  }

  nearestInteractable() {
    const p = this.state.player;
    const candidates = [];
    for (const item of ITEMS) {
      if (this.state.itemFound.has(item.id) || this.itemLocked(item)) continue;
      const d = this.distance(p, item);
      if (d < 2.2) candidates.push({ d, label: `Pick up ${item.name}`, use: () => this.pickup(item) });
    }
    for (const npc of NPCS) {
      const d = this.distance(p, npc);
      if (d < 2.6) candidates.push({ d, label: `Talk to ${npc.name}: ${npc.quest}`, use: () => this.talk(npc) });
    }
    if (this.distance(p, { x: 18, z: 29 }) < 3.3) {
      candidates.push({ d: this.distance(p, { x: 18, z: 29 }), label: "Launch the escape boat", use: () => this.escape() });
    }
    if (!candidates.length) return null;
    return candidates.sort((a, b) => a.d - b.d)[0];
  }

  pickup(item) {
    this.state.itemFound.add(item.id);
    this.state.inventory.add(item.id);
    this.state.dialogue = item.hint;
    this.playTone(560, 0.11, "triangle");
  }

  talk(npc) {
    const s = this.state;
    if (npc.id === "hawking" && s.inventory.has("battery") && s.inventory.has("starMap")) {
      s.flags.routeReady = true;
      s.dialogue = "Professor Hawking calculates the reef route and marks a silent channel to the open water.";
      this.playTone(720, 0.16, "sine");
    } else if (npc.id === "dana" && s.inventory.has("ledger") && s.inventory.has("cameraTape")) {
      s.flags.evidenceReady = true;
      s.dialogue = "Dana decodes the radio phrase from the ledger and tape. The tower cache is now useful.";
      this.playTone(690, 0.16, "sine");
    } else if (npc.id === "chef" && s.inventory.has("fuse") && s.inventory.has("powerCell")) {
      s.flags.generator = true;
      s.dialogue = "Chef Luis locks in the fuse and power cell. Dock lights blink through the fog.";
      this.playTone(640, 0.16, "triangle");
    } else if (npc.id === "porter" && s.inventory.has("boltCutters")) {
      s.flags.gateOpen = true;
      s.dialogue = "Porter cuts the service gate. You now have a safer route behind the mansion.";
      this.playTone(580, 0.14, "square");
    } else if (npc.id === "marina" && s.flags.routeReady && s.flags.generator && s.flags.evidenceReady) {
      s.flags.launchKeyReady = true;
      s.dialogue = "Marina releases the launch key at the dock crate. Bring it, the flare, and the radio phrase to the boat.";
      this.playTone(760, 0.18, "sine");
    } else {
      s.dialogue = `${npc.name}: ${npc.line}`;
    }
  }

  escape() {
    const s = this.state;
    const ready = s.flags.routeReady && s.flags.generator && s.inventory.has("launchKey") && s.inventory.has("flare") && s.inventory.has("radioCode");
    if (!ready) {
      s.dialogue = "The boat still needs route math, dock power, a launch key, a flare, and the radio phrase.";
      this.playTone(160, 0.11, "square");
      return;
    }
    s.flags.escaped = true;
    s.done = true;
    s.won = true;
    s.dialogue = "The flare burns green. The radio phrase clears the channel. You escape before nightfall.";
    this.playTone(880, 0.28, "sine");
  }

  checkEndStates() {
    if (this.state.minute >= 19 * 60) {
      this.state.done = true;
      this.state.dialogue = "Night swallowed the island before the boat launched.";
      this.playTone(110, 0.3, "sawtooth");
    }
  }

  restart() {
    this.dispose();
    const next = new NightfallIslandGame({
      mount: this.mount,
      keys: this.keys,
      playTone: this.playTone,
      escapeHtml: this.escapeHtml
    });
    next.start();
  }

  itemLocked(item) {
    return typeof item.locked === "function" && item.locked(this.state);
  }

  isWalkable(x, z) {
    if (Math.hypot(x * 0.92, z * 1.05) > 35) return false;
    if (!this.state.flags.gateOpen && x > 13 && x < 17 && z > -30 && z < -20) return false;
    return true;
  }

  lineBlocked(a, b) {
    return BUILDINGS.some((building) => {
      const radius = Math.max(building.w, building.d) * 0.45;
      return distanceToSegment({ x: building.x, z: building.z }, a, b) < radius;
    });
  }

  itemName(id) {
    return ITEMS.find((item) => item.id === id)?.name || id;
  }

  distance(a, b) {
    return Math.hypot(Number(a.x || 0) - Number(b.x || 0), Number(a.z || 0) - Number(b.z || 0));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    if (this.renderer?.domElement?.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    this.renderer?.dispose();
  }
}

function distanceToSegment(point, a, b) {
  const ax = a.x;
  const az = a.z;
  const bx = b.x;
  const bz = b.z;
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((point.x - ax) * dx + (point.z - az) * dz) / lengthSq));
  const x = ax + t * dx;
  const z = az + t * dz;
  return Math.hypot(point.x - x, point.z - z);
}
