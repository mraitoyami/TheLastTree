const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const oxygenText = document.getElementById("oxygenText");
const fireText = document.getElementById("fireText");
const scoreText = document.getElementById("scoreText");
const carryText = document.getElementById("carryText");
const messageText = document.getElementById("messageText");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const restartButton = document.getElementById("restartButton");

const MAP = [
  "####################",
  "#....T.....p....T..#",
  "#..T......T........#",
  "#..............o...#",
  "#....#######.......#",
  "#.T..#.....#...T...#",
  "#....#.PBG.#.......#",
  "#....#.....#..T....#",
  "#....#######.......#",
  "#..T......p.....T..#",
  "#..............o...#",
  "#....T......T......#",
  "#.........T........#",
  "#..T...........T...#",
  "####################",
];

const TILE = 64;
const FOV = Math.PI / 3;
const HALF_FOV = FOV / 2;
const MAX_DEPTH = 16;
const RAY_STEP = 4;
const MOVE_SPEED = 120;
const STRAFE_SPEED = 95;
const TURN_SPEED = 0.0024;
const INTERACT_RANGE = 1.2;
const CUT_RANGE = 1.35;

const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  shift: false,
};

let game;
let lastFrame = 0;

function createGame() {
  const trees = [];
  const trash = [];
  const bins = [];
  let startX = TILE * 2;
  let startY = TILE * 2;

  for (let row = 0; row < MAP.length; row += 1) {
    for (let col = 0; col < MAP[row].length; col += 1) {
      const cell = MAP[row][col];
      const x = col + 0.5;
      const y = row + 0.5;

      if (cell === "P") {
        startX = x * TILE;
        startY = y * TILE;
      }

      if (cell === "T") {
        trees.push({
          x,
          y,
          alive: true,
          pulse: Math.random() * Math.PI * 2,
        });
      }

      if (cell === "p" || cell === "o") {
        trash.push({
          x,
          y,
          kind: cell === "p" ? "plastic" : "organic",
          state: "ground",
          pulse: Math.random() * Math.PI * 2,
        });
      }

      if (cell === "B" || cell === "G") {
        bins.push({
          x,
          y,
          kind: cell === "B" ? "plastic" : "organic",
        });
      }
    }
  }

  return {
    over: false,
    ending: "",
    message: "Click the game to lock your mouse. Cutting trees lowers oxygen and raises fire risk.",
    prompt: "Click inside the game to start mouse look.",
    attackTimer: 0,
    bob: 0,
    oxygen: 100,
    fireRisk: 10,
    ecoScore: 0,
    carrying: null,
    visibleTrees: 0,
    pointerLocked: false,
    totalTrash: trash.length,
    initialTreeCount: trees.length,
    player: {
      x: startX,
      y: startY,
      angle: -Math.PI / 2,
      radius: 13,
    },
    trees,
    trash,
    bins,
    depthBuffer: new Array(canvas.width).fill(Infinity),
  };
}

function mapCell(col, row) {
  if (row < 0 || row >= MAP.length || col < 0 || col >= MAP[0].length) {
    return "#";
  }

  return MAP[row][col];
}

function isWallAtPixel(x, y) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  return mapCell(col, row) === "#";
}

function normalizeAngle(angle) {
  let next = angle % (Math.PI * 2);
  if (next < 0) {
    next += Math.PI * 2;
  }
  return next;
}

function angleDiff(a, b) {
  let diff = normalizeAngle(a - b);
  if (diff > Math.PI) {
    diff -= Math.PI * 2;
  }
  return diff;
}

function hasLineOfSight(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);
  const steps = Math.ceil(distance / 8);

  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    if (isWallAtPixel(x, y)) {
      return false;
    }
  }

  return true;
}

function collidesWithWorld(x, y, radius) {
  const corners = [
    [x - radius, y - radius],
    [x + radius, y - radius],
    [x - radius, y + radius],
    [x + radius, y + radius],
  ];

  if (corners.some(([px, py]) => isWallAtPixel(px, py))) {
    return true;
  }

  for (const tree of game.trees) {
    if (!tree.alive) {
      continue;
    }

    const tx = tree.x * TILE;
    const ty = tree.y * TILE;
    const distance = Math.hypot(x - tx, y - ty);
    if (distance < radius + 16) {
      return true;
    }
  }

  return false;
}

function castRay(angle) {
  const rayAngle = normalizeAngle(angle);
  const cos = Math.cos(rayAngle);
  const sin = Math.sin(rayAngle);

  for (let depth = 1; depth < MAX_DEPTH * TILE; depth += RAY_STEP) {
    const x = game.player.x + cos * depth;
    const y = game.player.y + sin * depth;

    if (isWallAtPixel(x, y)) {
      return { distance: depth, hitX: x, hitY: y };
    }
  }

  return {
    distance: MAX_DEPTH * TILE,
    hitX: game.player.x + cos * MAX_DEPTH * TILE,
    hitY: game.player.y + sin * MAX_DEPTH * TILE,
  };
}

function setMessage(text) {
  game.message = text;
  messageText.textContent = text;
}

function syncHud() {
  oxygenText.textContent = `${Math.max(0, Math.round(game.oxygen))}%`;
  fireText.textContent = `${Math.min(100, Math.round(game.fireRisk))}%`;
  scoreText.textContent = `${Math.round(game.ecoScore)}`;
  carryText.textContent = game.carrying ? game.carrying.kind : "Nothing";
  messageText.textContent = game.prompt ? `${game.message} ${game.prompt}` : game.message;
}

function resetGame() {
  game = createGame();
  overlay.classList.add("hidden");
  syncHud();
}

function getTreeCount() {
  return game.trees.filter((tree) => tree.alive).length;
}

function getHandledTrashCount() {
  return game.trash.filter((item) => item.state === "sorted").length;
}

function clampMeters() {
  game.oxygen = Math.max(0, Math.min(100, game.oxygen));
  game.fireRisk = Math.max(0, Math.min(100, game.fireRisk));
}

function isVisible(x, y) {
  const dx = x - game.player.x;
  const dy = y - game.player.y;
  const distance = Math.hypot(dx, dy);

  if (distance > MAX_DEPTH * TILE) {
    return false;
  }

  const angle = Math.atan2(dy, dx);
  return Math.abs(angleDiff(angle, game.player.angle)) < HALF_FOV + 0.1;
}

function getTarget(type) {
  const candidates = [];

  if (type === "tree") {
    for (const tree of game.trees) {
      if (!tree.alive) {
        continue;
      }

      const tx = tree.x * TILE;
      const ty = tree.y * TILE;
      const dx = tx - game.player.x;
      const dy = ty - game.player.y;
      const distance = Math.hypot(dx, dy) / TILE;
      const angle = Math.atan2(dy, dx);
      const diff = Math.abs(angleDiff(angle, game.player.angle));

      if (distance <= CUT_RANGE && diff < 0.18 && hasLineOfSight(game.player.x, game.player.y, tx, ty)) {
        candidates.push({ object: tree, distance });
      }
    }
  }

  if (type === "trash" && !game.carrying) {
    for (const item of game.trash) {
      if (item.state !== "ground") {
        continue;
      }

      const tx = item.x * TILE;
      const ty = item.y * TILE;
      const dx = tx - game.player.x;
      const dy = ty - game.player.y;
      const distance = Math.hypot(dx, dy) / TILE;
      const angle = Math.atan2(dy, dx);
      const diff = Math.abs(angleDiff(angle, game.player.angle));

      if (distance <= INTERACT_RANGE && diff < 0.24 && hasLineOfSight(game.player.x, game.player.y, tx, ty)) {
        candidates.push({ object: item, distance });
      }
    }
  }

  if (type === "bin" && game.carrying) {
    for (const bin of game.bins) {
      const bx = bin.x * TILE;
      const by = bin.y * TILE;
      const dx = bx - game.player.x;
      const dy = by - game.player.y;
      const distance = Math.hypot(dx, dy) / TILE;
      const angle = Math.atan2(dy, dx);
      const diff = Math.abs(angleDiff(angle, game.player.angle));

      if (distance <= INTERACT_RANGE && diff < 0.28 && hasLineOfSight(game.player.x, game.player.y, bx, by)) {
        candidates.push({ object: bin, distance });
      }
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0]?.object || null;
}

function cutTree() {
  if (game.over) {
    return;
  }

  game.attackTimer = 0.16;
  const tree = getTarget("tree");

  if (!tree) {
    setMessage("No tree is lined up in your crosshair.");
    syncHud();
    return;
  }

  tree.alive = false;
  game.oxygen -= 6;
  game.fireRisk += 8;
  game.ecoScore -= 6;
  clampMeters();
  setMessage("You cut down a tree. Oxygen falls and fire risk rises.");
  syncHud();
}

function interact() {
  if (game.over) {
    return;
  }

  if (!game.carrying) {
    const item = getTarget("trash");
    if (!item) {
      setMessage("Nothing useful to pick up here. Look at trash or a bin.");
      syncHud();
      return;
    }

    item.state = "carried";
    game.carrying = item;
    setMessage(`Picked up ${item.kind} trash. Bring it back to the matching bin.`);
    syncHud();
    return;
  }

  const bin = getTarget("bin");
  if (!bin) {
    setMessage("Carry the trash to the base and aim at a bin.");
    syncHud();
    return;
  }

  const correct = game.carrying.kind === bin.kind;
  game.carrying.state = "sorted";

  if (correct) {
    game.oxygen += 8;
    game.fireRisk -= 7;
    game.ecoScore += 12;
    setMessage(`Correct choice. ${game.carrying.kind} trash was sorted into the right bin.`);
  } else {
    game.oxygen -= 9;
    game.fireRisk += 10;
    game.ecoScore -= 12;
    setMessage(`Wrong choice. ${game.carrying.kind} trash went into the wrong bin and the forest pays for it.`);
  }

  game.carrying = null;
  clampMeters();
  syncHud();
}

function updatePrompt() {
  if (!game.pointerLocked) {
    game.prompt = "Click inside the game to lock your mouse.";
    return;
  }

  const tree = getTarget("tree");
  const trash = getTarget("trash");
  const bin = getTarget("bin");

  if (tree) {
    game.prompt = "Press Space to cut this tree. That choice hurts oxygen and raises fire risk.";
    return;
  }

  if (trash) {
    game.prompt = `Press E to pick up ${trash.kind} trash.`;
    return;
  }

  if (bin && game.carrying) {
    game.prompt = `Press E to drop ${game.carrying.kind} into the ${bin.kind} bin.`;
    return;
  }

  if (game.carrying) {
    game.prompt = `Carrying ${game.carrying.kind}. Find the matching bin at the base.`;
    return;
  }

  game.prompt = "Use the mouse to look around, WASD to move, Space to cut trees, and E to interact.";
}

function updateWorld(dt) {
  const treeRatio = getTreeCount() / game.initialTreeCount;
  const passiveFireRise = (1 - treeRatio) * 1.35 * dt;
  const passiveOxygenDrift = ((treeRatio - 0.55) * 1.5 - Math.max(0, game.fireRisk - 45) * 0.03) * dt;

  game.fireRisk += passiveFireRise;
  game.oxygen += passiveOxygenDrift;
  clampMeters();

  if (game.fireRisk >= 100) {
    endGame(false, "Fire consumed the base after too many risky choices.");
    return;
  }

  if (game.oxygen <= 0) {
    endGame(false, "The forest air collapsed because your decisions drained the oxygen.");
    return;
  }

  if (getHandledTrashCount() === game.totalTrash && !game.carrying) {
    if (game.ecoScore >= 16 && game.oxygen >= 55 && game.fireRisk <= 55) {
      endGame(true, "Your choices stabilized the base and gave the forest room to breathe again.");
    } else {
      endGame(false, "You finished the tasks, but the consequences of your choices left the forest unstable.");
    }
  }
}

function update(dt) {
  if (game.over) {
    return;
  }

  let moveX = 0;
  let moveY = 0;

  if (keys.w) {
    moveX += Math.cos(game.player.angle) * MOVE_SPEED * dt;
    moveY += Math.sin(game.player.angle) * MOVE_SPEED * dt;
  }

  if (keys.s) {
    moveX -= Math.cos(game.player.angle) * MOVE_SPEED * dt;
    moveY -= Math.sin(game.player.angle) * MOVE_SPEED * dt;
  }

  if (keys.a) {
    moveX += Math.cos(game.player.angle - Math.PI / 2) * STRAFE_SPEED * dt;
    moveY += Math.sin(game.player.angle - Math.PI / 2) * STRAFE_SPEED * dt;
  }

  if (keys.d) {
    moveX += Math.cos(game.player.angle + Math.PI / 2) * STRAFE_SPEED * dt;
    moveY += Math.sin(game.player.angle + Math.PI / 2) * STRAFE_SPEED * dt;
  }

  if (keys.shift) {
    moveX *= 1.45;
    moveY *= 1.45;
  }

  const nextX = game.player.x + moveX;
  const nextY = game.player.y + moveY;

  if (!collidesWithWorld(nextX, game.player.y, game.player.radius)) {
    game.player.x = nextX;
  }

  if (!collidesWithWorld(game.player.x, nextY, game.player.radius)) {
    game.player.y = nextY;
  }

  for (const tree of game.trees) {
    tree.pulse += dt * 2;
  }

  for (const item of game.trash) {
    item.pulse += dt * 3;
  }

  game.attackTimer = Math.max(0, game.attackTimer - dt);
  game.bob += Math.hypot(moveX, moveY) > 0 ? dt * 8 : dt * 2;

  updateWorld(dt);
  updatePrompt();
  syncHud();
}

function endGame(won, text) {
  game.over = true;
  game.ending = text;
  overlay.classList.remove("hidden");
  overlayTitle.textContent = won ? "Forest stabilized." : "Consequences hit back.";
  overlayText.textContent = text;
}

function renderScene() {
  const width = canvas.width;
  const height = canvas.height;
  const bobY = Math.sin(game.bob) * 4;

  ctx.clearRect(0, 0, width, height);

  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.55);
  sky.addColorStop(0, "#85c7a6");
  sky.addColorStop(0.55, "#305949");
  sky.addColorStop(1, "#192f26");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height * 0.55);

  const ground = ctx.createLinearGradient(0, height * 0.45, 0, height);
  ground.addColorStop(0, "#3f4f2f");
  ground.addColorStop(1, "#1c2415");
  ctx.fillStyle = ground;
  ctx.fillRect(0, height * 0.45, width, height);

  for (let x = 0; x < width; x += 1) {
    const rayAngle = game.player.angle - HALF_FOV + (x / width) * FOV;
    const ray = castRay(rayAngle);
    const correctedDistance = ray.distance * Math.cos(rayAngle - game.player.angle);
    game.depthBuffer[x] = correctedDistance;

    const wallHeight = Math.min(height, (TILE * 360) / Math.max(correctedDistance, 1));
    const wallTop = height / 2 - wallHeight / 2 + bobY;
    const shade = Math.max(0.22, 1 - correctedDistance / (MAX_DEPTH * TILE));
    const edgeFactor = Math.abs((ray.hitX / TILE) % 1) < 0.08 || Math.abs((ray.hitX / TILE) % 1) > 0.92;

    if (correctedDistance < TILE * 2.3) {
      ctx.fillStyle = edgeFactor
        ? `rgba(${Math.floor(102 * shade)}, ${Math.floor(85 * shade)}, ${Math.floor(63 * shade)}, 1)`
        : `rgba(${Math.floor(122 * shade)}, ${Math.floor(103 * shade)}, ${Math.floor(79 * shade)}, 1)`;
    } else {
      ctx.fillStyle = edgeFactor
        ? `rgba(${Math.floor(43 * shade)}, ${Math.floor(62 * shade)}, ${Math.floor(41 * shade)}, 1)`
        : `rgba(${Math.floor(54 * shade)}, ${Math.floor(78 * shade)}, ${Math.floor(50 * shade)}, 1)`;
    }

    ctx.fillRect(x, wallTop, 1, wallHeight);
  }

  renderSprites(bobY);
  renderWeapon(bobY);
  renderCrosshair();
  renderMiniMap();
  renderStatusOverlay();
}

function renderSprites(bobY) {
  const sprites = [];

  for (const tree of game.trees) {
    if (!tree.alive) {
      continue;
    }

    sprites.push({
      type: "tree",
      x: tree.x * TILE,
      y: tree.y * TILE,
      pulse: tree.pulse,
    });
  }

  for (const item of game.trash) {
    if (item.state !== "ground") {
      continue;
    }

    sprites.push({
      type: item.kind === "plastic" ? "plastic" : "organic",
      x: item.x * TILE,
      y: item.y * TILE,
      pulse: item.pulse,
    });
  }

  for (const bin of game.bins) {
    sprites.push({
      type: bin.kind === "plastic" ? "blue-bin" : "green-bin",
      x: bin.x * TILE,
      y: bin.y * TILE,
      pulse: 0,
    });
  }

  sprites.sort((a, b) => {
    const da = Math.hypot(a.x - game.player.x, a.y - game.player.y);
    const db = Math.hypot(b.x - game.player.x, b.y - game.player.y);
    return db - da;
  });

  for (const sprite of sprites) {
    const dx = sprite.x - game.player.x;
    const dy = sprite.y - game.player.y;
    const distance = Math.hypot(dx, dy);
    const angleToSprite = Math.atan2(dy, dx);
    const relative = angleDiff(angleToSprite, game.player.angle);

    if (Math.abs(relative) > HALF_FOV + 0.28) {
      continue;
    }

    if (!hasLineOfSight(game.player.x, game.player.y, sprite.x, sprite.y)) {
      continue;
    }

    const screenX = (0.5 + relative / FOV) * canvas.width;
    const sizeBase = sprite.type === "tree" ? 420 : 200;
    const size = Math.min(sprite.type === "tree" ? 280 : 170, (TILE * sizeBase) / Math.max(distance, 1));
    const screenY = canvas.height / 2 + bobY + Math.sin(sprite.pulse) * 5;
    const left = Math.round(screenX - size / 2);
    const top = Math.round(screenY - size * (sprite.type === "tree" ? 0.88 : 0.5));
    const sampleX = Math.max(0, Math.min(canvas.width - 1, Math.round(screenX)));

    if (distance > game.depthBuffer[sampleX] + 12) {
      continue;
    }

    if (sprite.type === "tree") {
      drawTreeSprite(left, top, size, distance);
    } else if (sprite.type === "blue-bin" || sprite.type === "green-bin") {
      drawBinSprite(left, top, size, sprite.type === "blue-bin");
    } else {
      drawTrashSprite(left, top, size, sprite.type === "plastic");
    }
  }
}

function drawTreeSprite(left, top, size, distance) {
  const alpha = Math.max(0.34, 1 - distance / (MAX_DEPTH * TILE));
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "#4c2f18";
  ctx.fillRect(left + size * 0.42, top + size * 0.58, size * 0.16, size * 0.42);
  ctx.fillStyle = "#1f5e2c";
  ctx.beginPath();
  ctx.arc(left + size * 0.5, top + size * 0.42, size * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(left + size * 0.36, top + size * 0.5, size * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(left + size * 0.64, top + size * 0.5, size * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBinSprite(left, top, size, blue) {
  ctx.save();
  ctx.fillStyle = blue ? "#4f94ff" : "#48bb73";
  ctx.fillRect(left + size * 0.2, top + size * 0.25, size * 0.6, size * 0.75);
  ctx.fillStyle = blue ? "#a9d0ff" : "#bff0cd";
  ctx.fillRect(left + size * 0.16, top + size * 0.18, size * 0.68, size * 0.12);
  ctx.restore();
}

function drawTrashSprite(left, top, size, plastic) {
  ctx.save();
  ctx.fillStyle = plastic ? "#e2d18d" : "#8b5f3c";
  ctx.beginPath();
  ctx.arc(left + size * 0.5, top + size * 0.64, size * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = plastic ? "#fff2bc" : "#c48d61";
  ctx.fillRect(left + size * 0.42, top + size * 0.34, size * 0.16, size * 0.14);
  ctx.restore();
}

function renderWeapon(bobY) {
  const swing = game.attackTimer > 0 ? Math.sin((game.attackTimer / 0.16) * Math.PI) : 0;
  const handleX = canvas.width * 0.77 + swing * 26;
  const handleY = canvas.height * 0.8 + bobY;

  ctx.fillStyle = "#6d4a2d";
  ctx.fillRect(handleX, handleY, 16, 96);
  ctx.fillStyle = "#bfb8a3";
  ctx.fillRect(handleX - 34 - swing * 38, handleY - 76, 68, 18);
  ctx.fillStyle = "#8a8370";
  ctx.fillRect(handleX - 10 - swing * 22, handleY - 72, 22, 44);
}

function renderCrosshair() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.strokeStyle = "rgba(240, 246, 220, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx, cy + 10);
  ctx.stroke();
}

function renderMiniMap() {
  const scale = 9;
  const offsetX = 16;
  const offsetY = canvas.height - MAP.length * scale - 16;

  ctx.fillStyle = "rgba(5, 10, 16, 0.72)";
  ctx.fillRect(offsetX - 8, offsetY - 8, MAP[0].length * scale + 16, MAP.length * scale + 16);

  for (let row = 0; row < MAP.length; row += 1) {
    for (let col = 0; col < MAP[row].length; col += 1) {
      const cell = MAP[row][col];
      let color = "#1a2519";
      if (cell === "#") color = "#3f5138";
      if (cell === "B") color = "#4f94ff";
      if (cell === "G") color = "#48bb73";
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + col * scale, offsetY + row * scale, scale - 1, scale - 1);
    }
  }

  for (const tree of game.trees) {
    if (!tree.alive) continue;
    ctx.fillStyle = "#73c460";
    ctx.fillRect(offsetX + tree.x * scale - 2, offsetY + tree.y * scale - 2, 4, 4);
  }

  for (const item of game.trash) {
    if (item.state !== "ground") continue;
    ctx.fillStyle = item.kind === "plastic" ? "#f2dd97" : "#b68557";
    ctx.fillRect(offsetX + item.x * scale - 2, offsetY + item.y * scale - 2, 4, 4);
  }

  const px = offsetX + (game.player.x / TILE) * scale;
  const py = offsetY + (game.player.y / TILE) * scale;
  ctx.fillStyle = "#fff4c6";
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff4c6";
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(game.player.angle) * 8, py + Math.sin(game.player.angle) * 8);
  ctx.stroke();
}

function renderStatusOverlay() {
  ctx.fillStyle = "rgba(5, 10, 16, 0.68)";
  ctx.fillRect(16, 16, 290, 86);

  ctx.fillStyle = "#eff3ff";
  ctx.font = "16px monospace";
  ctx.fillText(`OXYGEN ${Math.round(game.oxygen)}%`, 28, 40);
  ctx.fillText(`FIRE ${Math.round(game.fireRisk)}%`, 28, 62);
  ctx.fillText(`SCORE ${Math.round(game.ecoScore)}`, 28, 84);

  ctx.fillStyle = "#21314c";
  ctx.fillRect(328, 22, 200, 14);
  ctx.fillRect(328, 50, 200, 14);
  ctx.fillStyle = game.oxygen > 40 ? "#86f0a6" : "#ff9c7c";
  ctx.fillRect(328, 22, 2 * game.oxygen, 14);
  ctx.fillStyle = game.fireRisk < 55 ? "#7fd4ff" : "#ff7b88";
  ctx.fillRect(328, 50, 2 * game.fireRisk, 14);

  if (game.carrying) {
    ctx.fillStyle = "rgba(5, 10, 16, 0.68)";
    ctx.fillRect(canvas.width - 220, 16, 204, 42);
    ctx.fillStyle = "#eff3ff";
    ctx.fillText(`CARRYING ${game.carrying.kind}`, canvas.width - 204, 42);
  }
}

function render() {
  renderScene();
}

function frame(time) {
  const dt = Math.min(0.033, (time - lastFrame) / 1000 || 0);
  lastFrame = time;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function setKey(event, value) {
  if (event.code === "KeyW") keys.w = value;
  if (event.code === "KeyA") keys.a = value;
  if (event.code === "KeyS") keys.s = value;
  if (event.code === "KeyD") keys.d = value;
  if (event.code === "ShiftLeft" || event.code === "ShiftRight") keys.shift = value;
}

document.addEventListener("pointerlockchange", () => {
  game.pointerLocked = document.pointerLockElement === canvas;
  updatePrompt();
  syncHud();
});

canvas.addEventListener("click", () => {
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas || game.over) {
    return;
  }

  game.player.angle = normalizeAngle(game.player.angle + event.movementX * TURN_SPEED);
});

window.addEventListener("keydown", (event) => {
  setKey(event, true);

  if (event.code === "Space") {
    event.preventDefault();
    cutTree();
  }

  if (event.code === "KeyE") {
    interact();
  }

  if (event.code === "KeyR") {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  setKey(event, false);
});

restartButton.addEventListener("click", resetGame);

resetGame();
requestAnimationFrame(frame);
