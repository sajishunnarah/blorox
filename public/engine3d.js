export class SceneRenderer {
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
    this.renderer.domElement.dataset.engine = "three";
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
      if (object.name) labels.push({ text: object.name, x, y });
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
