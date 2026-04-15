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
  "########################",
  "#..T...O...T...p...L...#",
  "#.T....T......T....T...#",
  "#....O.....o......T....#",
  "#..T....##.##....T...T.#",
  "#.....L.#H.H#..O.......#",
  "#..T.....PBGX.....T....#",
  "#.......#...#..T....x..#",
  "#.T...O.##.##.....T....#",
  "#.....T.....T...T......#",
  "#..o......O......p..x..#",
  "#....T........T........#",
  "#.L.....T...O.....T....#",
  "#....p......T.....o....#",
  "#..T....T......L....T..#",
  "#.......T...T..........#",
  "########################",
];

const TREE_TYPES = {
  small: {
    label: "small tree",
    oxygenValue: 1,
    fireShield: 1,
    collision: 16,
    size: 0.84,
    cut: { oxygen: -3, fire: 4, score: -2 },
  },
  old: {
    label: "old tree",
    oxygenValue: 2.8,
    fireShield: 1.9,
    collision: 20,
    size: 1.18,
    cut: { oxygen: -13, fire: 11, score: -10 },
  },
  glowing: {
    label: "glowing tree",
    oxygenValue: 2.2,
    fireShield: 2.5,
    collision: 18,
    size: 1.02,
    cut: { oxygen: -16, fire: 15, score: -14 },
    blessing: { oxygen: 10, fire: -9, score: 12 },
  },
};

const TRASH_TYPES = {
  plastic: {
    label: "plastic trash",
    bin: "plastic",
    correct: { oxygen: 4, fire: -5, score: 9 },
    wrong: { oxygen: -10, fire: 12, score: -11 },
  },
  organic: {
    label: "organic waste",
    bin: "organic",
    correct: { oxygen: 7, fire: -8, score: 8 },
    wrong: { oxygen: -5, fire: 6, score: -6 },
  },
  toxic: {
    label: "toxic waste",
    bin: "hazard",
    pickupPenalty: { oxygen: -10, fire: 14, score: -10 },
    correct: { oxygen: 6, fire: -12, score: 16 },
    wrong: { oxygen: -18, fire: 20, score: -18 },
  },
};

const TREE_CELL_TYPES = { T: "small", O: "old", L: "glowing" };
const TRASH_CELL_TYPES = { p: "plastic", o: "organic", x: "toxic" };
const BIN_CELL_TYPES = { B: "plastic", G: "organic", X: "hazard" };

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

const keys = { w: false, a: false, s: false, d: false, shift: false };

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

      if (TREE_CELL_TYPES[cell]) {
        const type = TREE_CELL_TYPES[cell];
        trees.push({
          x,
          y,
          type,
          alive: true,
          blessingUsed: false,
          pulse: Math.random() * Math.PI * 2,
        });
      }

      if (TRASH_CELL_TYPES[cell]) {
        const kind = TRASH_CELL_TYPES[cell];
        trash.push({
          x,
          y,
          kind,
          state: "ground",
          exposed: false,
          pulse: Math.random() * Math.PI * 2,
        });
      }

      if (BIN_CELL_TYPES[cell]) {
        bins.push({ x, y, kind: BIN_CELL_TYPES[cell] });
      }
    }
  }

  const initialForestValue = trees.reduce((total, tree) => total + TREE_TYPES[tree.type].oxygenValue, 0);
  const initialFireShield = trees.reduce((total, tree) => total + TREE_TYPES[tree.type].fireShield, 0);

  return {
    over: false,
    ending: "",
    message: "Click the game to lock your mouse. Old trees hurt the forest badly, glowing trees can bless you, and toxic waste is dangerous on contact.",
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
    initialForestValue,
    initialFireShield,
    plasticResidue: 0,
    blessingsClaimed: 0,
    player: { x: startX, y: startY, angle: -Math.PI / 2, radius: 13 },
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

function isSolidCell(cell) {
  return cell === "#" || cell === "H";
}

function isWallAtPixel(x, y) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  return isSolidCell(mapCell(col, row));
}

function normalizeAngle(angle) {
  let next = angle % (Math.PI * 2);
  if (next < 0) next += Math.PI * 2;
  return next;
}

function angleDiff(a, b) {
  let diff = normalizeAngle(a - b);
  if (diff > Math.PI) diff -= Math.PI * 2;
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
    if (isWallAtPixel(x, y)) return false;
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

  if (corners.some(([px, py]) => isWallAtPixel(px, py))) return true;

  for (const tree of game.trees) {
    if (!tree.alive) continue;
    const tx = tree.x * TILE;
    const ty = tree.y * TILE;
    const distance = Math.hypot(x - tx, y - ty);
    if (distance < radius + TREE_TYPES[tree.type].collision) return true;
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
      return {
        distance: depth,
        hitX: x,
        hitY: y,
        cell: mapCell(Math.floor(x / TILE), Math.floor(y / TILE)),
      };
    }
  }

  return {
    distance: MAX_DEPTH * TILE,
    hitX: game.player.x + cos * MAX_DEPTH * TILE,
    hitY: game.player.y + sin * MAX_DEPTH * TILE,
    cell: "#",
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
  carryText.textContent = game.carrying ? getTrashDetails(game.carrying).label : "Nothing";
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

function getAliveTreesByType(type) {
  return game.trees.filter((tree) => tree.alive && tree.type === type).length;
}

function getHandledTrashCount() {
  return game.trash.filter((item) => item.state === "sorted").length;
}

function getPendingTrashCount(kind) {
  return game.trash.filter((item) => item.kind === kind && item.state !== "sorted").length;
}

function getForestValue() {
  return game.trees.reduce((total, tree) => {
    if (!tree.alive) return total;
    return total + TREE_TYPES[tree.type].oxygenValue;
  }, 0);
}

function getFireShieldValue() {
  return game.trees.reduce((total, tree) => {
    if (!tree.alive) return total;
    return total + TREE_TYPES[tree.type].fireShield;
  }, 0);
}

function clampMeters() {
  game.oxygen = Math.max(0, Math.min(100, game.oxygen));
  game.fireRisk = Math.max(0, Math.min(100, game.fireRisk));
}

function getTreeDetails(tree) {
  return TREE_TYPES[tree.type];
}

function getTrashDetails(item) {
  return TRASH_TYPES[item.kind];
}

function getBinLabel(kind) {
  if (kind === "hazard") return "hazard bin";
  return `${kind} bin`;
}

function applyStatDelta(delta) {
  game.oxygen += delta.oxygen ?? 0;
  game.fireRisk += delta.fire ?? 0;
  game.ecoScore += delta.score ?? 0;
  clampMeters();
}

function isVisible(x, y) {
  const dx = x - game.player.x;
  const dy = y - game.player.y;
  const distance = Math.hypot(dx, dy);

  if (distance > MAX_DEPTH * TILE) return false;

  const angle = Math.atan2(dy, dx);
  return Math.abs(angleDiff(angle, game.player.angle)) < HALF_FOV + 0.1;
}

function getTarget(type) {
  const candidates = [];

  if (type === "tree") {
    for (const tree of game.trees) {
      if (!tree.alive) continue;

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

  if (type === "glowing") {
    for (const tree of game.trees) {
      if (!tree.alive || tree.type !== "glowing" || tree.blessingUsed) continue;

      const tx = tree.x * TILE;
      const ty = tree.y * TILE;
      const dx = tx - game.player.x;
      const dy = ty - game.player.y;
      const distance = Math.hypot(dx, dy) / TILE;
      const angle = Math.atan2(dy, dx);
      const diff = Math.abs(angleDiff(angle, game.player.angle));

      if (distance <= INTERACT_RANGE && diff < 0.22 && hasLineOfSight(game.player.x, game.player.y, tx, ty)) {
        candidates.push({ object: tree, distance });
      }
    }
  }

  if (type === "trash" && !game.carrying) {
    for (const item of game.trash) {
      if (item.state !== "ground") continue;

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
  if (game.over) return;

  game.attackTimer = 0.16;
  const tree = getTarget("tree");

  if (!tree) {
    setMessage("No tree is lined up in your crosshair.");
    syncHud();
    return;
  }

  const details = getTreeDetails(tree);
  tree.alive = false;
  applyStatDelta(details.cut);

  if (tree.type === "old") {
    setMessage("You felled an old tree. The forest loses a huge oxygen anchor and fire danger jumps.");
  } else if (tree.type === "glowing") {
    const lostBlessing = tree.blessingUsed ? " Its blessing was already spent." : " Its unused blessing is gone too.";
    setMessage(`You cut a glowing tree.${lostBlessing} The lantern canopy collapses and the forest pays for it.`);
  } else {
    setMessage("You cut a small tree. The hit is smaller, but every cut still weakens the forest.");
  }

  syncHud();
}

function interact() {
  if (game.over) return;

  if (!game.carrying) {
    const glowingTree = getTarget("glowing");
    if (glowingTree) {
      glowingTree.blessingUsed = true;
      game.blessingsClaimed += 1;
      applyStatDelta(getTreeDetails(glowingTree).blessing);
      setMessage("The glowing tree shares a lantern blessing. Oxygen rises, fire risk eases, and the forest trusts you more.");
      syncHud();
      return;
    }

    const item = getTarget("trash");
    if (!item) {
      setMessage("Nothing useful to interact with here. Look at trash, a glowing tree, or the right bin.");
      syncHud();
      return;
    }

    item.state = "carried";
    game.carrying = item;

    if (item.kind === "toxic" && !item.exposed) {
      item.exposed = true;
      applyStatDelta(getTrashDetails(item).pickupPenalty);
      setMessage("You grabbed toxic waste. The fumes hit instantly, so rush it to the hazard bin.");
    } else if (item.kind === "plastic") {
      setMessage("Picked up plastic trash. Leaving plastic around builds long-term damage even after you clean it late.");
    } else {
      setMessage("Picked up organic waste. Its damage is temporary, but it keeps rotting until you sort it.");
    }

    syncHud();
    return;
  }

  const bin = getTarget("bin");
  if (!bin) {
    setMessage("Carry the trash to the base and aim at a bin.");
    syncHud();
    return;
  }

  const carried = game.carrying;
  const trashDetails = getTrashDetails(carried);
  const correct = trashDetails.bin === bin.kind;
  game.carrying.state = "sorted";

  if (correct) {
    applyStatDelta(trashDetails.correct);
    if (carried.kind === "plastic") {
      game.plasticResidue = Math.max(0, game.plasticResidue - 1.8);
      setMessage("Correct choice. The plastic is contained, but some of its long-term damage still lingers.");
    } else if (carried.kind === "organic") {
      setMessage("Correct choice. The organic waste stops rotting and the temporary damage fades out.");
    } else {
      setMessage("Correct choice. The toxic waste is sealed in the hazard bin before it can spread further.");
    }
  } else {
    applyStatDelta(trashDetails.wrong);
    if (carried.kind === "plastic") {
      game.plasticResidue += 1.2;
      setMessage("Wrong choice. Mis-sorted plastic keeps poisoning the forest for the long haul.");
    } else if (carried.kind === "organic") {
      setMessage("Wrong choice. The organic waste spikes the current damage, but it can still recover faster than plastic.");
    } else {
      setMessage("Wrong choice. Toxic waste in the wrong bin causes an immediate environmental shock.");
    }
  }

  game.carrying = null;
  syncHud();
}

function updatePrompt() {
  if (!game.pointerLocked) {
    game.prompt = "Click inside the game to lock your mouse.";
    return;
  }

  const tree = getTarget("tree");
  const glowingTree = getTarget("glowing");
  const trash = getTarget("trash");
  const bin = getTarget("bin");

  if (glowingTree && !game.carrying) {
    game.prompt = "Press E to claim this glowing tree's blessing. Press Space only if you want a major penalty instead.";
    return;
  }

  if (tree) {
    if (tree.type === "old") {
      game.prompt = "Press Space to cut this old tree. It causes a huge oxygen loss and pushes fire risk up hard.";
    } else if (tree.type === "glowing") {
      game.prompt = "Press Space to cut this glowing tree. Even without its blessing, losing it hits the forest badly.";
    } else {
      game.prompt = "Press Space to cut this small tree. The penalty is minor, but repeated cuts still add up.";
    }
    return;
  }

  if (trash) {
    if (trash.kind === "plastic") {
      game.prompt = "Press E to pick up plastic trash. Plastic causes long-term damage while it stays unsorted.";
    } else if (trash.kind === "organic") {
      game.prompt = "Press E to pick up organic waste. Its damage is temporary, but it keeps spiking while it sits here.";
    } else {
      game.prompt = "Press E to pick up toxic waste. Expect an instant penalty and bring it straight to the hazard bin.";
    }
    return;
  }

  if (bin && game.carrying) {
    game.prompt = `Press E to drop ${getTrashDetails(game.carrying).label} into the ${getBinLabel(bin.kind)}.`;
    return;
  }

  if (game.carrying) {
    if (game.carrying.kind === "toxic") {
      game.prompt = "Carrying toxic waste. Hurry to the hazard bin at the base.";
    } else {
      game.prompt = `Carrying ${getTrashDetails(game.carrying).label}. Find the matching bin at the base.`;
    }
    return;
  }

  game.prompt = "Use the mouse to look around, WASD to move, Space to cut trees, and E to sort trash or claim glowing-tree blessings.";
}

function updateWorld(dt) {
  const forestRatio = getForestValue() / game.initialForestValue;
  const fireShieldRatio = getFireShieldValue() / game.initialFireShield;
  const glowingTrees = getAliveTreesByType("glowing");
  const plasticPending = getPendingTrashCount("plastic");
  const organicPending = getPendingTrashCount("organic");
  const toxicPending = getPendingTrashCount("toxic");

  game.plasticResidue = Math.max(
    0,
    Math.min(24, game.plasticResidue + plasticPending * 0.16 * dt - (plasticPending === 0 ? 0.04 * dt : 0))
  );

  const blessingSupport = game.blessingsClaimed * 0.04;
  const passiveFireRise = (
    (1 - fireShieldRatio) * 1.45 +
    organicPending * 0.14 +
    toxicPending * 0.5 +
    game.plasticResidue * 0.018 -
    glowingTrees * 0.03 -
    blessingSupport * 0.8
  ) * dt;
  const passiveOxygenDrift = (
    (forestRatio - 0.58) * 1.4 +
    glowingTrees * 0.05 +
    blessingSupport -
    Math.max(0, game.fireRisk - 45) * 0.03 -
    organicPending * 0.16 -
    toxicPending * 0.42 -
    game.plasticResidue * 0.022
  ) * dt;

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
    if (game.ecoScore >= 18 && game.oxygen >= 52 && game.fireRisk <= 60) {
      if (getAliveTreesByType("glowing") > 0 || game.blessingsClaimed > 0) {
        endGame(true, "Your choices stabilized the base. The lantern trees stayed bright enough to help the forest breathe again.");
      } else {
        endGame(true, "You restored the base, but losing every glowing tree left the forest alive in a dimmer, harsher balance.");
      }
    } else {
      endGame(false, "You finished the tasks, but the consequences of your choices left the forest unstable.");
    }
  }
}

function update(dt) {
  if (game.over) return;

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

  if (!collidesWithWorld(nextX, game.player.y, game.player.radius)) game.player.x = nextX;
  if (!collidesWithWorld(game.player.x, nextY, game.player.radius)) game.player.y = nextY;

  for (const tree of game.trees) tree.pulse += dt * 2;
  for (const item of game.trash) item.pulse += dt * 3;

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

  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.6);
  sky.addColorStop(0, "#9bd5b3");
  sky.addColorStop(0.35, "#5c9d79");
  sky.addColorStop(0.72, "#274d3f");
  sky.addColorStop(1, "#173027");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height * 0.55);

  drawSkyBackdrop(width, height);

  const ground = ctx.createLinearGradient(0, height * 0.45, 0, height);
  ground.addColorStop(0, "#53643a");
  ground.addColorStop(0.52, "#2f3e22");
  ground.addColorStop(1, "#182112");
  ctx.fillStyle = ground;
  ctx.fillRect(0, height * 0.45, width, height);
  drawGroundBackdrop(width, height);

  for (let x = 0; x < width; x += 1) {
    const rayAngle = game.player.angle - HALF_FOV + (x / width) * FOV;
    const ray = castRay(rayAngle);
    const correctedDistance = ray.distance * Math.cos(rayAngle - game.player.angle);
    game.depthBuffer[x] = correctedDistance;

    const wallHeight = Math.min(height, (TILE * 360) / Math.max(correctedDistance, 1));
    const wallTop = height / 2 - wallHeight / 2 + bobY;
    const shade = Math.max(0.22, 1 - correctedDistance / (MAX_DEPTH * TILE));
    const edgeFactor = Math.abs((ray.hitX / TILE) % 1) < 0.08 || Math.abs((ray.hitX / TILE) % 1) > 0.92;

    if (ray.cell === "H") {
      const r = edgeFactor ? 112 : 136;
      const g = edgeFactor ? 83 : 101;
      const b = edgeFactor ? 56 : 66;
      ctx.fillStyle = `rgba(${Math.floor(r * shade)}, ${Math.floor(g * shade)}, ${Math.floor(b * shade)}, 1)`;
    } else if (correctedDistance < TILE * 2.3) {
      ctx.fillStyle = edgeFactor
        ? `rgba(${Math.floor(58 * shade)}, ${Math.floor(76 * shade)}, ${Math.floor(48 * shade)}, 1)`
        : `rgba(${Math.floor(72 * shade)}, ${Math.floor(96 * shade)}, ${Math.floor(58 * shade)}, 1)`;
    } else {
      ctx.fillStyle = edgeFactor
        ? `rgba(${Math.floor(39 * shade)}, ${Math.floor(56 * shade)}, ${Math.floor(37 * shade)}, 1)`
        : `rgba(${Math.floor(48 * shade)}, ${Math.floor(69 * shade)}, ${Math.floor(43 * shade)}, 1)`;
    }

    ctx.fillRect(x, wallTop, 1, wallHeight);

    if (ray.cell === "H") {
      ctx.fillStyle = `rgba(255, 228, 186, ${0.06 * shade})`;
      ctx.fillRect(x, wallTop + wallHeight * 0.16, 1, 2);
      ctx.fillRect(x, wallTop + wallHeight * 0.44, 1, 2);
      ctx.fillRect(x, wallTop + wallHeight * 0.72, 1, 2);
    }

    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.52, correctedDistance / (MAX_DEPTH * TILE) * 0.5)})`;
    ctx.fillRect(x, wallTop + wallHeight, 1, height - wallTop - wallHeight);
  }

  renderSprites(bobY);
  renderWeapon(bobY);
  renderCrosshair();
  renderMiniMap();
  renderStatusOverlay();
}

function drawGroundBackdrop(width, height) {
  ctx.save();

  for (let i = 0; i < 18; i += 1) {
    const y = height * 0.55 + i * 16;
    const alpha = 0.035 + i * 0.004;
    ctx.fillStyle = `rgba(255, 241, 188, ${alpha})`;
    ctx.fillRect(0, y, width, 1);
  }

  const path = ctx.createLinearGradient(width * 0.5, height, width * 0.5, height * 0.55);
  path.addColorStop(0, "rgba(126, 102, 70, 0.42)");
  path.addColorStop(1, "rgba(126, 102, 70, 0)");
  ctx.fillStyle = path;
  ctx.beginPath();
  ctx.moveTo(width * 0.36, height);
  ctx.lineTo(width * 0.46, height * 0.62);
  ctx.lineTo(width * 0.54, height * 0.62);
  ctx.lineTo(width * 0.64, height);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawSkyBackdrop(width, height) {
  ctx.save();

  const sunX = width * 0.78;
  const sunY = height * 0.16;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 130);
  sunGlow.addColorStop(0, "rgba(255, 243, 191, 0.95)");
  sunGlow.addColorStop(0.45, "rgba(255, 214, 135, 0.3)");
  sunGlow.addColorStop(1, "rgba(255, 214, 135, 0)");
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 130, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(234, 245, 226, 0.82)";
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(34, 63, 52, 0.52)";
  ctx.beginPath();
  ctx.moveTo(0, height * 0.42);
  ctx.lineTo(width * 0.18, height * 0.28);
  ctx.lineTo(width * 0.34, height * 0.4);
  ctx.lineTo(width * 0.5, height * 0.26);
  ctx.lineTo(width * 0.7, height * 0.4);
  ctx.lineTo(width * 0.88, height * 0.22);
  ctx.lineTo(width, height * 0.38);
  ctx.lineTo(width, height * 0.55);
  ctx.lineTo(0, height * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(22, 44, 34, 0.74)";
  for (let i = 0; i < width; i += 26) {
    const h = 45 + ((i * 13) % 42);
    ctx.beginPath();
    ctx.moveTo(i, height * 0.55);
    ctx.lineTo(i + 12, height * 0.55 - h);
    ctx.lineTo(i + 26, height * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function renderSprites(bobY) {
  const sprites = [];

  for (const tree of game.trees) {
    if (!tree.alive) continue;
    sprites.push({
      type: "tree",
      treeType: tree.type,
      blessingUsed: tree.blessingUsed,
      x: tree.x * TILE,
      y: tree.y * TILE,
      pulse: tree.pulse,
    });
  }

  for (const item of game.trash) {
    if (item.state !== "ground") continue;
    sprites.push({
      type: "trash",
      trashType: item.kind,
      x: item.x * TILE,
      y: item.y * TILE,
      pulse: item.pulse,
    });
  }

  for (const bin of game.bins) {
    sprites.push({
      type: "bin",
      binKind: bin.kind,
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

    if (Math.abs(relative) > HALF_FOV + 0.28) continue;
    if (!hasLineOfSight(game.player.x, game.player.y, sprite.x, sprite.y)) continue;

    const screenX = (0.5 + relative / FOV) * canvas.width;
    const treeScale = sprite.type === "tree" ? TREE_TYPES[sprite.treeType].size : 1;
    const trashScale = sprite.type === "trash"
      ? (sprite.trashType === "toxic" ? 0.92 : sprite.trashType === "organic" ? 0.82 : 0.86)
      : 1;
    const sizeScale = sprite.type === "tree" ? treeScale : trashScale;
    const sizeBase = sprite.type === "tree" ? 420 : sprite.type === "bin" ? 210 : 190;
    const sizeLimit = sprite.type === "tree" ? 300 : 170;
    const size = Math.min(sizeLimit, ((TILE * sizeBase) / Math.max(distance, 1)) * sizeScale);
    const screenY = canvas.height / 2 + bobY + Math.sin(sprite.pulse) * 5;
    const left = Math.round(screenX - size / 2);
    const top = Math.round(screenY - size * (sprite.type === "tree" ? 0.9 : 0.5));
    const sampleX = Math.max(0, Math.min(canvas.width - 1, Math.round(screenX)));

    if (distance > game.depthBuffer[sampleX] + 12) continue;

    if (sprite.type === "tree") {
      drawTreeSprite(left, top, size, distance, sprite.treeType, sprite.blessingUsed);
    } else if (sprite.type === "bin") {
      drawBinSprite(left, top, size, sprite.binKind);
    } else {
      drawTrashSprite(left, top, size, sprite.trashType);
    }
  }
}

function drawTreeSprite(left, top, size, distance, treeType, blessingUsed) {
  const alpha = Math.max(0.34, 1 - distance / (MAX_DEPTH * TILE));
  const centerX = left + size * 0.5;
  const centerY = top + size * 0.42;
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(centerX, top + size * 0.98, size * 0.24, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  if (treeType === "glowing") {
    const glowRadius = size * (blessingUsed ? 0.22 : 0.34);
    const glow = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, size * 0.5);
    glow.addColorStop(0, `rgba(204, 255, 189, ${blessingUsed ? 0.26 : 0.44})`);
    glow.addColorStop(0.45, `rgba(253, 228, 130, ${blessingUsed ? 0.14 : 0.28})`);
    glow.addColorStop(1, "rgba(253, 228, 130, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(centerX, centerY, glowRadius * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = treeType === "old" ? "#4d2f18" : treeType === "glowing" ? "#6f4a29" : "#59371d";
  ctx.fillRect(left + size * (treeType === "old" ? 0.4 : 0.43), top + size * 0.56, size * (treeType === "old" ? 0.18 : 0.14), size * 0.44);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(left + size * 0.47, top + size * 0.6, size * 0.03, size * 0.3);

  if (treeType === "old") {
    ctx.fillStyle = "#1f4f24";
    ctx.beginPath();
    ctx.arc(centerX, top + size * 0.28, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(left + size * 0.32, top + size * 0.43, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(left + size * 0.68, top + size * 0.43, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3c7f39";
    ctx.beginPath();
    ctx.arc(centerX, top + size * 0.18, size * 0.16, 0, Math.PI * 2);
    ctx.fill();
  } else if (treeType === "glowing") {
    ctx.fillStyle = blessingUsed ? "#4f7b3d" : "#5fa847";
    ctx.beginPath();
    ctx.arc(centerX, top + size * 0.34, size * 0.23, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(left + size * 0.35, top + size * 0.46, size * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(left + size * 0.65, top + size * 0.46, size * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blessingUsed ? "rgba(255, 233, 166, 0.45)" : "rgba(255, 243, 191, 0.9)";
    ctx.beginPath();
    ctx.arc(centerX, top + size * 0.3, size * 0.11, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#285f2e";
    ctx.beginPath();
    ctx.arc(centerX, top + size * 0.36, size * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(left + size * 0.34, top + size * 0.48, size * 0.19, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(left + size * 0.66, top + size * 0.48, size * 0.19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3f8b40";
    ctx.beginPath();
    ctx.arc(centerX, top + size * 0.28, size * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(left + size * 0.4, top + size * 0.38, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(left + size * 0.6, top + size * 0.38, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBinSprite(left, top, size, kind) {
  const baseColor = kind === "plastic" ? "#4f94ff" : kind === "organic" ? "#48bb73" : "#ff6f7e";
  const topColor = kind === "plastic" ? "#a9d0ff" : kind === "organic" ? "#bff0cd" : "#ffd0b5";
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(left + size * 0.5, top + size * 0.94, size * 0.22, size * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = baseColor;
  ctx.fillRect(left + size * 0.2, top + size * 0.25, size * 0.6, size * 0.75);
  ctx.fillStyle = topColor;
  ctx.fillRect(left + size * 0.16, top + size * 0.18, size * 0.68, size * 0.12);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(left + size * 0.3, top + size * 0.32, size * 0.12, size * 0.5);
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillRect(left + size * 0.26, top + size * 0.74, size * 0.48, size * 0.08);
  if (kind === "hazard") {
    ctx.fillStyle = "#1b1b21";
    ctx.fillRect(left + size * 0.26, top + size * 0.48, size * 0.48, size * 0.08);
    ctx.fillRect(left + size * 0.26, top + size * 0.62, size * 0.48, size * 0.08);
  }
  ctx.restore();
}

function drawTrashSprite(left, top, size, kind) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
  ctx.beginPath();
  ctx.ellipse(left + size * 0.5, top + size * 0.84, size * 0.18, size * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  if (kind === "toxic") {
    ctx.fillStyle = "#3e4a25";
    ctx.fillRect(left + size * 0.32, top + size * 0.38, size * 0.36, size * 0.38);
    ctx.fillStyle = "#b6ff55";
    ctx.fillRect(left + size * 0.36, top + size * 0.44, size * 0.28, size * 0.08);
    ctx.fillRect(left + size * 0.36, top + size * 0.58, size * 0.28, size * 0.08);
    ctx.fillStyle = "rgba(192, 255, 103, 0.25)";
    ctx.beginPath();
    ctx.arc(left + size * 0.5, top + size * 0.56, size * 0.24, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const plastic = kind === "plastic";
    ctx.fillStyle = plastic ? "#e2d18d" : "#8b5f3c";
    ctx.beginPath();
    ctx.arc(left + size * 0.5, top + size * 0.64, size * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = plastic ? "#fff2bc" : "#c48d61";
    ctx.fillRect(left + size * 0.42, top + size * 0.34, size * 0.16, size * 0.14);
    if (plastic) {
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(left + size * 0.46, top + size * 0.48, size * 0.08, size * 0.18);
    }
  }

  ctx.restore();
}

function renderWeapon(bobY) {
  const swing = game.attackTimer > 0 ? Math.sin((game.attackTimer / 0.16) * Math.PI) : 0;
  const handleX = canvas.width * 0.77 + swing * 26;
  const handleY = canvas.height * 0.8 + bobY;

  ctx.fillStyle = "#6d4a2d";
  ctx.fillRect(handleX, handleY, 16, 96);
  ctx.fillStyle = "#a59a7f";
  ctx.fillRect(handleX - 34 - swing * 38, handleY - 76, 68, 18);
  ctx.fillStyle = "#7e7661";
  ctx.fillRect(handleX - 10 - swing * 22, handleY - 72, 22, 44);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(handleX - 28 - swing * 30, handleY - 72, 14, 8);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(handleX + 8, handleY + 24, 12, 70);
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
      if (cell === "X") color = "#ff6f7e";
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + col * scale, offsetY + row * scale, scale - 1, scale - 1);
    }
  }

  for (const tree of game.trees) {
    if (!tree.alive) continue;
    ctx.fillStyle = tree.type === "old" ? "#437d39" : tree.type === "glowing" ? "#efe07f" : "#73c460";
    ctx.fillRect(offsetX + tree.x * scale - 2, offsetY + tree.y * scale - 2, 4, 4);
  }

  for (const item of game.trash) {
    if (item.state !== "ground") continue;
    if (item.kind === "plastic") ctx.fillStyle = "#f2dd97";
    if (item.kind === "organic") ctx.fillStyle = "#b68557";
    if (item.kind === "toxic") ctx.fillStyle = "#c9ff63";
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
    ctx.fillRect(canvas.width - 252, 16, 236, 42);
    ctx.fillStyle = "#eff3ff";
    ctx.font = "14px monospace";
    ctx.fillText(`CARRY ${getTrashDetails(game.carrying).label.toUpperCase()}`, canvas.width - 236, 42);
    ctx.font = "16px monospace";
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
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas || game.over) return;
  game.player.angle = normalizeAngle(game.player.angle + event.movementX * TURN_SPEED);
});

window.addEventListener("keydown", (event) => {
  setKey(event, true);

  if (event.code === "Space") {
    event.preventDefault();
    cutTree();
  }

  if (event.code === "KeyE") interact();
  if (event.code === "KeyR") resetGame();
});

window.addEventListener("keyup", (event) => {
  setKey(event, false);
});

restartButton.addEventListener("click", resetGame);

resetGame();
requestAnimationFrame(frame);
