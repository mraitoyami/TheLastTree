import * as THREE from "https://unpkg.com/three@0.163.0/build/three.module.js";

const canvas = document.querySelector("#game");
const healthFill = document.querySelector("#health-fill");
const healthText = document.querySelector("#health-text");
const xpFill = document.querySelector("#xp-fill");
const xpText = document.querySelector("#xp-text");
const levelText = document.querySelector("#level-text");
const enemyText = document.querySelector("#enemy-text");
const crystalText = document.querySelector("#crystal-text");
const messageText = document.querySelector("#message-text");
const gameOverPanel = document.querySelector("#game-over");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const restartButton = document.querySelector("#restart-button");

const mapRows = [
  "###############",
  "#..C.....#....#",
  "#.###.##.#.##.#",
  "#.#.....E....##",
  "#.#.#####.##..#",
  "#.#.#...#..#C.#",
  "#...#.P.#..#..#",
  "###.#.#.##.#.##",
  "#...#.#....#..#",
  "#.###.####.#E.#",
  "#...#....#.#..#",
  "#.#.####.#.##.#",
  "#.#....C.#....#",
  "#...E....#....#",
  "###############",
];

const tileSize = 4;
const playerRadius = 0.55;
const baseFovDistance = 18;
const fovHalfAngle = THREE.MathUtils.degToRad(34);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x04070d, 0.055);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);

const ambient = new THREE.HemisphereLight(0x7bb9ff, 0x06090f, 0.6);
scene.add(ambient);

const moonLight = new THREE.DirectionalLight(0xb9d7ff, 1.2);
moonLight.position.set(14, 24, 6);
scene.add(moonLight);

const floorMaterial = new THREE.MeshStandardMaterial({
  color: 0x152235,
  roughness: 0.92,
  metalness: 0.06,
});

const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0x30425f,
  roughness: 0.95,
  metalness: 0.05,
});

const enemyMaterial = new THREE.MeshStandardMaterial({
  color: 0xbf4863,
  emissive: 0x3e0d18,
  roughness: 0.55,
});

const playerMaterial = new THREE.MeshStandardMaterial({
  color: 0xcbefff,
  emissive: 0x1f5c7b,
  roughness: 0.45,
});

const crystalMaterial = new THREE.MeshStandardMaterial({
  color: 0x88f0ff,
  emissive: 0x22556e,
  transparent: true,
  opacity: 0.95,
  roughness: 0.1,
  metalness: 0.2,
});

const swordArcMaterial = new THREE.MeshBasicMaterial({
  color: 0xf8e0a1,
  transparent: true,
  opacity: 0.0,
  side: THREE.DoubleSide,
});

const world = new THREE.Group();
scene.add(world);

const tiles = [];
const walls = [];
const enemies = [];
const crystals = [];

const input = {
  forward: false,
  back: false,
  left: false,
  right: false,
  sprint: false,
};

const state = {
  gameOver: false,
  victory: false,
  level: 1,
  xp: 0,
  xpToLevel: 60,
  crystalsCollected: 0,
  attackCooldown: 0,
  attackTimer: 0,
  damageFlash: 0,
  messageTimer: 0,
  visibleEnemies: 0,
};

const player = {
  maxHealth: 100,
  health: 100,
  speed: 5.8,
  sprintSpeed: 8.4,
  facing: new THREE.Vector2(1, 0),
  position: new THREE.Vector3(),
  mesh: null,
  lantern: null,
  swordArc: null,
};

const tmpVec2 = new THREE.Vector2();
const tmpVec3 = new THREE.Vector3();

buildWorld();
setMessage("Wake the lanterns, gather three crystals, and cut through the dark while staying inside your vision cone.");
updateHud();

const clock = new THREE.Clock();
animate();

window.addEventListener("resize", onResize);
window.addEventListener("keydown", onKeyChange);
window.addEventListener("keyup", onKeyChange);
restartButton.addEventListener("click", resetGame);

function buildWorld() {
  const offsetX = -(mapRows[0].length * tileSize) / 2 + tileSize / 2;
  const offsetZ = -(mapRows.length * tileSize) / 2 + tileSize / 2;

  const floorGeometry = new THREE.BoxGeometry(tileSize, 0.5, tileSize);
  const wallGeometry = new THREE.BoxGeometry(tileSize, 3.8, tileSize);

  const playerGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.52, 1.2, 6, 12), playerMaterial);
  body.castShadow = true;
  body.position.y = 1.1;
  playerGroup.add(body);

  const lantern = new THREE.SpotLight(0xa8f0ff, 13, baseFovDistance * 1.25, fovHalfAngle * 2.35, 0.34, 1.6);
  lantern.position.set(0, 2.2, 0);
  lantern.target.position.set(player.facing.x * 5, 0.5, player.facing.y * 5);
  playerGroup.add(lantern);
  playerGroup.add(lantern.target);

  const swordArc = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 2.5, 32, 1, -Math.PI * 0.32, Math.PI * 0.64),
    swordArcMaterial
  );
  swordArc.rotation.x = -Math.PI / 2;
  swordArc.position.y = 0.12;
  playerGroup.add(swordArc);

  player.mesh = playerGroup;
  player.lantern = lantern;
  player.swordArc = swordArc;
  scene.add(playerGroup);

  mapRows.forEach((row, rowIndex) => {
    tiles[rowIndex] = [];

    [...row].forEach((cell, columnIndex) => {
      const x = offsetX + columnIndex * tileSize;
      const z = offsetZ + rowIndex * tileSize;

      const tileMesh = new THREE.Mesh(floorGeometry, floorMaterial.clone());
      tileMesh.position.set(x, -0.25, z);
      world.add(tileMesh);

      const tile = {
        row: rowIndex,
        col: columnIndex,
        x,
        z,
        mesh: tileMesh,
      };

      tiles[rowIndex][columnIndex] = tile;

      if (cell === "#") {
        const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial.clone());
        wallMesh.position.set(x, 1.9, z);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        world.add(wallMesh);
        walls.push({
          row: rowIndex,
          col: columnIndex,
          mesh: wallMesh,
        });
      }

      if (cell === "P") {
        player.position.set(x, 0, z);
        player.mesh.position.copy(player.position);
      }

      if (cell === "E") {
        const enemy = createEnemy(x, z);
        enemies.push(enemy);
        world.add(enemy.group);
      }

      if (cell === "C") {
        const crystal = createCrystal(x, z);
        crystals.push(crystal);
        world.add(crystal.mesh);
      }
    });
  });
}

function createEnemy(x, z) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.95, 1.9, 7), enemyMaterial.clone());
  mesh.position.y = 0.95;
  group.add(mesh);

  const core = new THREE.PointLight(0xff5d77, 1.4, 6, 2);
  core.position.set(0, 1.6, 0);
  group.add(core);

  group.position.set(x, 0, z);

  return {
    group,
    mesh,
    core,
    home: new THREE.Vector2(x, z),
    position: new THREE.Vector2(x, z),
    facing: new THREE.Vector2(1, 0),
    health: 34,
    speed: 2.3,
    damageCooldown: 0,
    aggro: false,
    visible: false,
    patrolAngle: Math.random() * Math.PI * 2,
  };
}

function createCrystal(x, z) {
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), crystalMaterial.clone());
  mesh.position.set(x, 1.1, z);

  const aura = new THREE.PointLight(0x74efff, 1.6, 8, 2);
  aura.position.set(0, 0.2, 0);
  mesh.add(aura);

  return {
    mesh,
    collected: false,
    bobOffset: Math.random() * Math.PI * 2,
  };
}

function onKeyChange(event) {
  const isDown = event.type === "keydown";

  if (event.code === "KeyW") input.forward = isDown;
  if (event.code === "KeyS") input.back = isDown;
  if (event.code === "KeyA") input.left = isDown;
  if (event.code === "KeyD") input.right = isDown;
  if (event.code === "ShiftLeft" || event.code === "ShiftRight") input.sprint = isDown;

  if (isDown && event.code === "Space") {
    event.preventDefault();
    triggerAttack();
  }

  if (isDown && event.code === "KeyR") {
    resetGame();
  }
}

function triggerAttack() {
  if (state.gameOver || state.attackCooldown > 0) {
    return;
  }

  state.attackCooldown = 0.55;
  state.attackTimer = 0.22;

  enemies.forEach((enemy) => {
    if (enemy.health <= 0) {
      return;
    }

    const distance = enemy.position.distanceTo(new THREE.Vector2(player.position.x, player.position.z));
    if (distance > 3.2) {
      return;
    }

    tmpVec2.set(enemy.position.x - player.position.x, enemy.position.y - player.position.z).normalize();
    const angle = Math.acos(THREE.MathUtils.clamp(tmpVec2.dot(player.facing), -1, 1));
    if (angle > THREE.MathUtils.degToRad(46)) {
      return;
    }

    enemy.health -= 18 + state.level * 4;
    enemy.aggro = true;
    enemy.core.intensity = 2.8;

    if (enemy.health <= 0) {
      enemy.group.visible = false;
      grantXp(28);
      setMessage("A shadow falls. Keep pushing deeper into the keep.");
    }
  });
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.033);

  if (!state.gameOver) {
    updatePlayer(delta);
    updateEnemies(delta);
    updateCrystals(delta);
    updateVisibility(delta);
    updateCombatEffects(delta);
    updateQuestState();
  } else {
    state.attackTimer = Math.max(0, state.attackTimer - delta);
  }

  updateCamera(delta);
  renderer.render(scene, camera);
}

function updatePlayer(delta) {
  const move = new THREE.Vector2(
    Number(input.right) - Number(input.left),
    Number(input.back) - Number(input.forward)
  );

  if (move.lengthSq() > 0) {
    move.normalize();
    player.facing.lerp(new THREE.Vector2(move.x, move.y), 0.18);
    player.facing.normalize();
  }

  const speed = input.sprint ? player.sprintSpeed : player.speed;
  const velocity = move.multiplyScalar(speed * delta * tileSize * 0.36);
  const targetX = player.position.x + velocity.x;
  const targetZ = player.position.z + velocity.y;

  if (!collides(targetX, player.position.z, playerRadius)) {
    player.position.x = targetX;
  }

  if (!collides(player.position.x, targetZ, playerRadius)) {
    player.position.z = targetZ;
  }

  player.mesh.position.set(player.position.x, 0, player.position.z);
  player.mesh.rotation.y = Math.atan2(player.facing.x, player.facing.y);

  const lanternDistance = baseFovDistance + state.level * 1.2;
  player.lantern.distance = lanternDistance;
  player.lantern.intensity = 11 + state.level * 0.9;
  player.lantern.target.position.set(player.facing.x * 6, 0.4, player.facing.y * 6);

  if (state.attackCooldown > 0) {
    state.attackCooldown -= delta;
  }
}

function updateEnemies(delta) {
  state.visibleEnemies = 0;
  const playerPos2 = new THREE.Vector2(player.position.x, player.position.z);

  enemies.forEach((enemy) => {
    if (enemy.health <= 0) {
      return;
    }

    enemy.position.set(enemy.group.position.x, enemy.group.position.z);

    const canSeePlayer = canSeePoint(enemy.position.x, enemy.position.y, player.position.x, player.position.z, 15.5);
    const distanceToPlayer = enemy.position.distanceTo(playerPos2);
    enemy.aggro = enemy.aggro || (canSeePlayer && distanceToPlayer < 13);
    enemy.visible = isPointVisibleToPlayer(enemy.position.x, enemy.position.y);

    if (enemy.visible) {
      state.visibleEnemies += 1;
    }

    let moveTarget;
    if (enemy.aggro && distanceToPlayer > 1.8) {
      moveTarget = playerPos2;
    } else if (!enemy.aggro) {
      enemy.patrolAngle += delta * 0.85;
      moveTarget = new THREE.Vector2(
        enemy.home.x + Math.cos(enemy.patrolAngle) * 1.4,
        enemy.home.y + Math.sin(enemy.patrolAngle) * 1.4
      );
    }

    if (moveTarget) {
      const desired = new THREE.Vector2().subVectors(moveTarget, enemy.position);
      if (desired.lengthSq() > 0.001) {
        desired.normalize();
        enemy.facing.lerp(desired, 0.06);
        enemy.facing.normalize();

        const nextX = enemy.group.position.x + enemy.facing.x * enemy.speed * delta;
        const nextZ = enemy.group.position.z + enemy.facing.y * enemy.speed * delta;

        if (!collides(nextX, enemy.group.position.z, 0.6)) {
          enemy.group.position.x = nextX;
        }
        if (!collides(enemy.group.position.x, nextZ, 0.6)) {
          enemy.group.position.z = nextZ;
        }
      }
    }

    enemy.group.rotation.y = Math.atan2(enemy.facing.x, enemy.facing.y);

    enemy.damageCooldown = Math.max(0, enemy.damageCooldown - delta);
    enemy.core.intensity = THREE.MathUtils.lerp(enemy.core.intensity, enemy.visible ? 1.8 : 0.5, 0.1);

    if (distanceToPlayer < 1.8 && enemy.damageCooldown === 0) {
      enemy.damageCooldown = 1.1;
      damagePlayer(9 + state.level);
    }
  });
}

function updateCrystals(delta) {
  crystals.forEach((crystal, index) => {
    if (crystal.collected) {
      return;
    }

    crystal.mesh.rotation.y += delta * 0.9;
    crystal.mesh.position.y = 1.1 + Math.sin(clock.elapsedTime * 2 + crystal.bobOffset) * 0.2;

    const distance = Math.hypot(crystal.mesh.position.x - player.position.x, crystal.mesh.position.z - player.position.z);
    if (distance < 1.3) {
      crystal.collected = true;
      crystal.mesh.visible = false;
      state.crystalsCollected += 1;
      grantXp(22);
      setMessage(`Crystal ${state.crystalsCollected} recovered. Your lantern grows brighter.`);
    }

    const visible = isPointVisibleToPlayer(crystal.mesh.position.x, crystal.mesh.position.z, 20);
    crystal.mesh.material.emissiveIntensity = visible ? 1.0 : 0.18;
    crystal.mesh.material.opacity = visible ? 0.95 : 0.22;
  });
}

function updateVisibility() {
  tiles.flat().forEach((tile) => {
    const visible = isPointVisibleToPlayer(tile.x, tile.z, baseFovDistance + 2);
    tile.mesh.material.color.setHex(visible ? 0x284263 : 0x152235);
    tile.mesh.material.emissive.setHex(visible ? 0x12324f : 0x000000);
    tile.mesh.material.emissiveIntensity = visible ? 0.35 : 0.0;
  });

  walls.forEach((wall) => {
    const visible = isPointVisibleToPlayer(
      wall.mesh.position.x,
      wall.mesh.position.z,
      baseFovDistance + 2
    );
    wall.mesh.material.color.setHex(visible ? 0x5f7ea6 : 0x30425f);
    wall.mesh.material.emissive.setHex(visible ? 0x163150 : 0x000000);
    wall.mesh.material.emissiveIntensity = visible ? 0.22 : 0.0;
  });

  enemies.forEach((enemy) => {
    const visible = enemy.health > 0 && enemy.visible;
    enemy.group.visible = enemy.health > 0 && (visible || enemy.aggro);
    enemy.mesh.material.transparent = true;
    enemy.mesh.material.opacity = visible ? 1.0 : 0.18;
    enemy.core.visible = visible || enemy.aggro;
  });
}

function updateCombatEffects(delta) {
  if (state.attackTimer > 0) {
    state.attackTimer -= delta;
    const progress = 1 - state.attackTimer / 0.22;
    player.swordArc.material.opacity = Math.sin(progress * Math.PI) * 0.72;
    player.swordArc.rotation.z = THREE.MathUtils.lerp(-0.6, 0.8, progress);
  } else {
    player.swordArc.material.opacity = 0;
    player.swordArc.rotation.z = -0.5;
  }

  state.damageFlash = Math.max(0, state.damageFlash - delta * 2);
  scene.fog.density = 0.055 + state.damageFlash * 0.028;

  if (state.messageTimer > 0) {
    state.messageTimer -= delta;
  }
}

function updateQuestState() {
  enemyText.textContent = `${enemies.filter((enemy) => enemy.health > 0).length} (${state.visibleEnemies} in sight)`;
  crystalText.textContent = `${state.crystalsCollected} / 3`;

  if (!state.victory && state.crystalsCollected >= 3 && enemies.every((enemy) => enemy.health <= 0)) {
    state.victory = true;
    endGame(true);
  }
}

function updateCamera(delta) {
  const cameraOffset = new THREE.Vector3(-player.facing.x * 7.8, 10.5, -player.facing.y * 7.8);
  const cameraTarget = new THREE.Vector3().copy(player.position).add(cameraOffset);
  camera.position.lerp(cameraTarget, 1 - Math.pow(0.001, delta));
  tmpVec3.copy(player.position).add(new THREE.Vector3(player.facing.x * 1.6, 1.8, player.facing.y * 1.6));
  camera.lookAt(tmpVec3);
}

function damagePlayer(amount) {
  if (state.gameOver) {
    return;
  }

  player.health = Math.max(0, player.health - amount);
  state.damageFlash = 1;
  updateHud();

  if (player.health <= 0) {
    endGame(false);
  } else {
    setMessage("The shadows strike from the edge of your light.");
  }
}

function grantXp(amount) {
  state.xp += amount;

  while (state.xp >= state.xpToLevel) {
    state.xp -= state.xpToLevel;
    state.level += 1;
    state.xpToLevel = Math.floor(state.xpToLevel * 1.24);
    player.maxHealth += 18;
    player.health = player.maxHealth;
    setMessage(`Level ${state.level}. Your lantern extends farther into the dark.`);
  }

  updateHud();
}

function updateHud() {
  const hpRatio = player.health / player.maxHealth;
  healthFill.style.transform = `scaleX(${hpRatio})`;
  healthText.textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`;

  const xpRatio = state.xp / state.xpToLevel;
  xpFill.style.transform = `scaleX(${xpRatio})`;
  xpText.textContent = `${state.xp} / ${state.xpToLevel}`;
  levelText.textContent = `${state.level}`;
}

function setMessage(text) {
  messageText.textContent = text;
  state.messageTimer = 4;
}

function endGame(won) {
  state.gameOver = true;
  state.victory = won;
  gameOverPanel.classList.remove("hidden");

  if (won) {
    overlayTitle.textContent = "Lantern restored.";
    overlayText.textContent = "You claimed every crystal and cleared the keep. Press R to play again.";
  } else {
    overlayTitle.textContent = "The dark got you.";
    overlayText.textContent = "Your field of view collapsed before the keep did. Press R to enter again.";
  }
}

function resetGame() {
  window.location.reload();
}

function collides(x, z, radius) {
  const half = tileSize / 2;

  for (const wall of walls) {
    const wx = wall.mesh.position.x;
    const wz = wall.mesh.position.z;
    const closestX = THREE.MathUtils.clamp(x, wx - half, wx + half);
    const closestZ = THREE.MathUtils.clamp(z, wz - half, wz + half);
    const dx = x - closestX;
    const dz = z - closestZ;

    if (dx * dx + dz * dz < radius * radius) {
      return true;
    }
  }

  return false;
}

function isPointVisibleToPlayer(x, z, overrideDistance = baseFovDistance + state.level * 1.2) {
  const toPoint = new THREE.Vector2(x - player.position.x, z - player.position.z);
  const distance = toPoint.length();

  if (distance === 0) {
    return true;
  }

  if (distance > overrideDistance) {
    return false;
  }

  toPoint.normalize();
  const angle = Math.acos(THREE.MathUtils.clamp(toPoint.dot(player.facing), -1, 1));

  if (angle > fovHalfAngle) {
    return false;
  }

  return !lineBlocked(player.position.x, player.position.z, x, z);
}

function canSeePoint(fromX, fromZ, toX, toZ, maxDistance) {
  const distance = Math.hypot(toX - fromX, toZ - fromZ);
  if (distance > maxDistance) {
    return false;
  }

  return !lineBlocked(fromX, fromZ, toX, toZ);
}

function lineBlocked(x0, z0, x1, z1) {
  const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.35);

  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const x = THREE.MathUtils.lerp(x0, x1, t);
    const z = THREE.MathUtils.lerp(z0, z1, t);
    const grid = worldToGrid(x, z);

    if (!grid) {
      return true;
    }

    if (mapRows[grid.row][grid.col] === "#") {
      return true;
    }
  }

  return false;
}

function worldToGrid(x, z) {
  const width = mapRows[0].length;
  const height = mapRows.length;
  const left = -(width * tileSize) / 2;
  const top = -(height * tileSize) / 2;

  const col = Math.floor((x - left) / tileSize);
  const row = Math.floor((z - top) / tileSize);

  if (row < 0 || row >= height || col < 0 || col >= width) {
    return null;
  }

  return { row, col };
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
