import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";

const canvas = document.getElementById("gameCanvas");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 30, 130);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  300
);
camera.position.set(0, 3, 12);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334455, 0.8);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight(0xffffff, 1.05);
sun.position.set(12, 22, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(240, 240),
  new THREE.MeshStandardMaterial({ color: 0x2f855a })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const gameState = {
  player: {
    health: 100,
    stamina: 100,
    food: 0,
    weaponLevel: 1,
    fireRate: 1,
  },
  world: {
    oxygen: 50,
    pollution: 50,
    forestDensity: 50,
    ecoPoints: 0,
    day: 1,
  },
  gameOver: false,
  won: false,
};

const ui = {
  health: document.getElementById("health"),
  stamina: document.getElementById("stamina"),
  food: document.getElementById("food"),
  weaponLevel: document.getElementById("weaponLevel"),
  fireRate: document.getElementById("fireRate"),
  oxygen: document.getElementById("oxygen"),
  pollution: document.getElementById("pollution"),
  forestDensity: document.getElementById("forestDensity"),
  ecoPoints: document.getElementById("ecoPoints"),
  day: document.getElementById("day"),
  hint: document.getElementById("hint"),
  message: document.getElementById("message"),
};

const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.5, 1.0, 6, 12),
  new THREE.MeshStandardMaterial({ color: 0x93c5fd })
);
player.position.set(0, 1.1, 0);
player.castShadow = true;
scene.add(player);

const keys = {};
let isMouseDragging = false;
let yaw = 0;
let pitch = -0.18;

window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === "e") {
    doInteract();
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener("mousedown", () => {
  isMouseDragging = true;
});

window.addEventListener("mouseup", () => {
  isMouseDragging = false;
});

window.addEventListener("mousemove", (e) => {
  if (!isMouseDragging) return;
  yaw -= e.movementX * 0.0035;
  pitch -= e.movementY * 0.0028;
  pitch = Math.max(-0.7, Math.min(0.5, pitch));
});

function randomPos(radius = 65) {
  return (Math.random() - 0.5) * radius * 2;
}

function makeTree() {
  const g = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.35, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x7c3f00 })
  );
  trunk.position.y = 1.2;
  trunk.castShadow = true;
  g.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.3, 2.9, 10),
    new THREE.MeshStandardMaterial({ color: 0x1b7f34 })
  );
  leaves.position.y = 3.25;
  leaves.castShadow = true;
  g.add(leaves);

  g.position.set(randomPos(), 0, randomPos());
  g.userData.type = "tree";
  return g;
}

function makeBin() {
  const color = Math.random() > 0.5 ? 0x2563eb : 0xf97316;
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 1.6, 1.2),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 0.8;
  g.add(body);

  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.18, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x111827 })
  );
  lid.position.y = 1.65;
  g.add(lid);

  g.position.set(randomPos(55), 0, randomPos(55));
  g.userData.type = "bin";
  return g;
}

function makeAnimal() {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.7, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x7a5f4d })
  );
  body.position.y = 0.6;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x7a5f4d })
  );
  head.position.set(0.8, 0.8, 0);
  g.add(head);

  g.position.set(randomPos(58), 0, randomPos(58));
  g.userData.type = "animal";
  return g;
}

const worldObjects = [];

for (let i = 0; i < 28; i++) {
  const t = makeTree();
  worldObjects.push(t);
  scene.add(t);
}
for (let i = 0; i < 12; i++) {
  const b = makeBin();
  worldObjects.push(b);
  scene.add(b);
}
for (let i = 0; i < 10; i++) {
  const a = makeAnimal();
  worldObjects.push(a);
  scene.add(a);
}

function setMessage(text, color = "#86efac") {
  ui.message.textContent = text;
  ui.message.style.color = color;
}

function clampWorldStats() {
  gameState.player.health = THREE.MathUtils.clamp(gameState.player.health, 0, 100);
  gameState.player.stamina = THREE.MathUtils.clamp(
    gameState.player.stamina,
    0,
    100
  );
  gameState.player.food = THREE.MathUtils.clamp(gameState.player.food, 0, 999);
  gameState.player.weaponLevel = THREE.MathUtils.clamp(
    gameState.player.weaponLevel,
    1,
    5
  );
  gameState.player.fireRate = THREE.MathUtils.clamp(gameState.player.fireRate, 0.35, 3);

  gameState.world.oxygen = THREE.MathUtils.clamp(gameState.world.oxygen, 0, 100);
  gameState.world.pollution = THREE.MathUtils.clamp(gameState.world.pollution, 0, 100);
  gameState.world.forestDensity = THREE.MathUtils.clamp(
    gameState.world.forestDensity,
    0,
    100
  );
  gameState.world.ecoPoints = THREE.MathUtils.clamp(gameState.world.ecoPoints, 0, 999);
}

function applyCutTree(obj) {
  scene.remove(obj);
  worldObjects.splice(worldObjects.indexOf(obj), 1);

  // Tree cutting gives short-term combat gains with long-term eco costs.
  gameState.player.weaponLevel += 0.34;
  gameState.player.fireRate += 0.11;
  gameState.player.stamina -= 7;
  gameState.world.oxygen -= 3;
  gameState.world.pollution += 2;
  gameState.world.forestDensity -= 2;

  setMessage("Cut tree: weapons improved, oxygen dropped.");
}

function applySortGarbageCorrect() {
  gameState.world.pollution -= 4;
  gameState.world.oxygen += 1.6;
  gameState.world.ecoPoints += 3;
  gameState.player.stamina -= 5;
  setMessage("Garbage sorted correctly: pollution down, eco points up.");
}

function applySortGarbageWrong() {
  gameState.world.pollution += 5;
  gameState.world.oxygen -= 2;
  gameState.world.ecoPoints = Math.max(0, gameState.world.ecoPoints - 2);
  gameState.player.stamina -= 2;
  setMessage("Wrong sorting: faster now, but environment got worse.", "#fca5a5");
}

function applyHunt(obj) {
  scene.remove(obj);
  worldObjects.splice(worldObjects.indexOf(obj), 1);

  const successChance =
    0.25 +
    gameState.player.weaponLevel * 0.12 +
    gameState.player.fireRate * 0.08 -
    gameState.world.pollution * 0.002;
  const success = Math.random() < successChance;

  gameState.player.stamina -= 10;

  if (success) {
    gameState.player.food += 2;
    gameState.player.health += 4;
    setMessage("Hunt success: gained food and health.");
  } else {
    gameState.player.health -= 10;
    setMessage("Hunt failed: took damage.", "#fca5a5");
  }
}

function doInteract() {
  if (gameState.gameOver || gameState.won) return;

  let nearest = null;
  let nearestDist = 2.8;
  for (const obj of worldObjects) {
    const d = player.position.distanceTo(obj.position);
    if (d < nearestDist) {
      nearest = obj;
      nearestDist = d;
    }
  }

  if (!nearest) {
    setMessage("Nothing close enough to interact.");
    return;
  }

  if (nearest.userData.type === "tree") {
    applyCutTree(nearest);
  } else if (nearest.userData.type === "bin") {
    // 70% chance the player sorts correctly. Could become a mini-game next.
    if (Math.random() < 0.7) {
      applySortGarbageCorrect();
    } else {
      applySortGarbageWrong();
    }
  } else if (nearest.userData.type === "animal") {
    applyHunt(nearest);
  }

  clampWorldStats();
  updateHUD();
}

function updateHUD() {
  ui.health.textContent = gameState.player.health.toFixed(0);
  ui.stamina.textContent = gameState.player.stamina.toFixed(0);
  ui.food.textContent = gameState.player.food.toFixed(0);
  ui.weaponLevel.textContent = gameState.player.weaponLevel.toFixed(1);
  ui.fireRate.textContent = gameState.player.fireRate.toFixed(2);
  ui.oxygen.textContent = gameState.world.oxygen.toFixed(0);
  ui.pollution.textContent = gameState.world.pollution.toFixed(0);
  ui.forestDensity.textContent = gameState.world.forestDensity.toFixed(0);
  ui.ecoPoints.textContent = gameState.world.ecoPoints.toFixed(0);
  ui.day.textContent = gameState.world.day.toFixed(0);
}

function checkEndGame() {
  if (gameState.player.health <= 0 || gameState.world.oxygen <= 5 || gameState.world.pollution >= 95) {
    gameState.gameOver = true;
    setMessage("Game over: ecosystem collapsed or player died.", "#fca5a5");
    ui.hint.textContent = "Refresh page to restart.";
    return;
  }

  if (gameState.world.day >= 20 && gameState.world.oxygen >= 70 && gameState.world.pollution <= 40) {
    gameState.won = true;
    setMessage("You win: strong ecosystem and survived 20 days.");
    ui.hint.textContent = "Refresh page to play again.";
  }
}

let envTick = 0;
let dayTick = 0;
let prev = performance.now();

function animate(now) {
  const delta = (now - prev) / 1000;
  prev = now;

  if (!gameState.gameOver && !gameState.won) {
    const moveSpeed = 6;
    const turnForward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const turnRight = new THREE.Vector3(turnForward.z, 0, -turnForward.x);
    const move = new THREE.Vector3();

    if (keys.w) move.add(turnForward);
    if (keys.s) move.sub(turnForward);
    if (keys.a) move.sub(turnRight);
    if (keys.d) move.add(turnRight);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(moveSpeed * delta);
      player.position.add(move);
      player.position.x = THREE.MathUtils.clamp(player.position.x, -95, 95);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -95, 95);
      gameState.player.stamina -= 4.5 * delta;
    } else {
      gameState.player.stamina += 6 * delta;
    }

    // Camera follows behind player with manual yaw/pitch view.
    const camDist = 6;
    const camHeight = 3;
    const camOffset = new THREE.Vector3(
      -Math.sin(yaw) * camDist,
      camHeight + pitch * 3.8,
      -Math.cos(yaw) * camDist
    );
    camera.position.copy(player.position).add(camOffset);
    camera.lookAt(player.position.x, player.position.y + 1.5 + pitch, player.position.z);

    envTick += delta;
    dayTick += delta;

    if (envTick >= 1) {
      envTick = 0;
      // Passive environmental simulation and tradeoff balancing.
      const noCutBonus = gameState.world.forestDensity > 45 ? 0.22 : 0;
      gameState.world.oxygen += 0.15 + noCutBonus;
      gameState.world.oxygen -= gameState.world.pollution * 0.026;
      gameState.player.health += gameState.world.oxygen > 60 ? 0.25 : -0.35;

      // If player chooses low weapon growth, fire rate slowly decays.
      if (gameState.player.weaponLevel < 2) {
        gameState.player.fireRate -= 0.03;
      }

      // Forest regeneration if pollution is controlled.
      if (gameState.world.pollution < 55 && gameState.world.forestDensity < 88) {
        gameState.world.forestDensity += 0.22;
      }

      // Eco points give small quality-of-life reward.
      gameState.player.stamina += gameState.world.ecoPoints * 0.003;
    }

    if (dayTick >= 7) {
      dayTick = 0;
      gameState.world.day += 1;
      setMessage(`Day ${gameState.world.day}: keep environment balanced.`);
    }

    if (gameState.player.stamina <= 0) {
      gameState.player.health -= 8 * delta;
    }

    clampWorldStats();
    checkEndGame();
    updateHUD();

    const nearby = worldObjects.find(
      (obj) => player.position.distanceTo(obj.position) < 2.8
    );
    ui.hint.textContent = nearby
      ? `Press E to interact with ${nearby.userData.type}.`
      : "Walk close to trees, bins, or animals and press E.";
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

updateHUD();
setMessage("Balance power and nature to survive.");
requestAnimationFrame(animate);
