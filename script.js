const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const oxygenText = document.getElementById("oxygenText");
const fireText = document.getElementById("fireText");
const staminaText = document.getElementById("staminaText");
const woodText = document.getElementById("woodText");
const weaponText = document.getElementById("weaponText");
const rateText = document.getElementById("rateText");
const foodText = document.getElementById("foodText");
const recycleText = document.getElementById("recycleText");
const carryText = document.getElementById("carryText");
const scoreText = document.getElementById("scoreText");
const messageText = document.getElementById("messageText");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const restartButton = document.getElementById("restartButton");

const MAP = [
  "########################",
  "#..T..dO...T...p...L...#",
  "#.T....T..d...T....T...#",
  "#....O.....o......T..b.#",
  "#..T....##.##....T...T.#",
  "#.....L.#H.H#..O.......#",
  "#..T.d...PBGX.....T....#",
  "#.......#...#..T....x..#",
  "#.T...O.##.##..b..T....#",
  "#.....T.....T...T......#",
  "#..o......O..d...p..x..#",
  "#....T........T....d...#",
  "#.L.....T...O.....T....#",
  "#....p...b..T.....o....#",
  "#..T....T......L....T..#",
  "#.....d.T...T..........#",
  "########################",
];

const TREE_TYPES = {
  small: {
    label: "young tree",
    oxygenValue: 1,
    fireShield: 1,
    collision: 16,
    size: 0.84,
    materials: 1,
    staminaCost: 15,
    cut: { oxygen: -3, fire: 4, score: -2 },
  },
  old: {
    label: "old-growth tree",
    oxygenValue: 2.8,
    fireShield: 1.9,
    collision: 20,
    size: 1.18,
    materials: 3,
    staminaCost: 24,
    cut: { oxygen: -13, fire: 11, score: -10 },
  },
  glowing: {
    label: "oxygen tree",
    oxygenValue: 2.2,
    fireShield: 2.5,
    collision: 18,
    size: 1.02,
    materials: 2,
    staminaCost: 20,
    cut: { oxygen: -16, fire: 15, score: -14 },
    blessing: { oxygen: 10, fire: -9, score: 12 },
  },
};

const TRASH_TYPES = {
  plastic: {
    label: "plastic trash",
    bin: "plastic",
    correct: { oxygen: 4, fire: -5, score: 9, parts: 1 },
    wrong: { oxygen: -10, fire: 12, score: -11, junk: 4.5 },
  },
  organic: {
    label: "organic waste",
    bin: "organic",
    correct: { oxygen: 7, fire: -8, score: 8, parts: 1 },
    wrong: { oxygen: -5, fire: 6, score: -6, junk: 2.5 },
  },
  toxic: {
    label: "toxic waste",
    bin: "hazard",
    pickupPenalty: { oxygen: -10, fire: 14, score: -10 },
    correct: { oxygen: 6, fire: -12, score: 16, parts: 2 },
    wrong: { oxygen: -18, fire: 20, score: -18, junk: 7 },
  },
};

const ANIMAL_TYPES = {
  deer: {
    label: "deer",
    food: 1,
    ecoCost: -2,
    speed: 24,
    size: 0.92,
    bob: 1.8,
  },
  boar: {
    label: "boar",
    food: 2,
    ecoCost: -3,
    speed: 19,
    size: 1.04,
    bob: 1.2,
  },
};

const WEAPON_TIERS = [
  {
    name: "Stone Sling",
    upgradeCost: 0,
    cooldown: 1.4,
    range: 4.4,
    aimWindow: 0.14,
    sway: 0.1,
  },
  {
    name: "Twig Bow",
    upgradeCost: 2,
    cooldown: 1.05,
    range: 5.1,
    aimWindow: 0.16,
    sway: 0.08,
  },
  {
    name: "Hunter Bow",
    upgradeCost: 3,
    cooldown: 0.74,
    range: 5.8,
    aimWindow: 0.18,
    sway: 0.06,
  },
  {
    name: "Camp Repeater",
    upgradeCost: 4,
    cooldown: 0.5,
    range: 6.8,
    aimWindow: 0.2,
    sway: 0.04,
  },
];

const TREE_CELL_TYPES = { T: "small", O: "old", L: "glowing" };
const TRASH_CELL_TYPES = { p: "plastic", o: "organic", x: "toxic" };
const BIN_CELL_TYPES = { B: "plastic", G: "organic", X: "hazard" };
const ANIMAL_CELL_TYPES = { d: "deer", b: "boar" };

const TILE = 64;
const FOV = Math.PI / 3;
const HALF_FOV = FOV / 2;
const MAX_DEPTH = 16;
const RAY_STEP = 4;
const MOVE_SPEED = 120;
const STRAFE_SPEED = 95;
const TURN_SPEED = 0.0024;
const LOOK_PITCH_SPEED = 0.6;
const MAX_LOOK_PITCH = 120;
const CROSSHAIR_DRIFT = 0.22;
const MAX_CROSSHAIR_DRIFT = 70;
const CROSSHAIR_RETURN_SPEED = 7;
const INTERACT_RANGE = 1.2;
const CUT_RANGE = 1.35;
const BASE_ACTION_RANGE = 1.9;
const PURIFIER_COST = 2;
const MAX_STAMINA = 100;
const SPRINT_BOOST = 1.5;
const FOOD_GOAL = 4;
const JUNK_RUSH_MAX = 12;

const keys = { w: false, a: false, s: false, d: false, shift: false };

let game;
let lastFrame = 0;

function createGame() {
  const trees = [];
  const trash = [];
  const bins = [];
  const animals = [];
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

      if (ANIMAL_CELL_TYPES[cell]) {
        const kind = ANIMAL_CELL_TYPES[cell];
        animals.push({
          x,
          y,
          spawnX: x,
          spawnY: y,
          kind,
          alive: true,
          angle: Math.random() * Math.PI * 2,
          turnTimer: 1 + Math.random() * 3,
          pulse: Math.random() * Math.PI * 2,
        });
      }
    }
  }

  const initialForestValue = trees.reduce((total, tree) => total + TREE_TYPES[tree.type].oxygenValue, 0);
  const initialFireShield = trees.reduce((total, tree) => total + TREE_TYPES[tree.type].fireShield, 0);

  return {
    over: false,
    ending: "",
    message: "Click the game to look around, cut trees only when you need stronger weapons, and choose whether garbage becomes clean recovery or dirty short-term power.",
    prompt: "Click inside the game to start mouse look.",
    attackTimer: 0,
    actionPose: "weapon",
    bob: 0,
    oxygen: 100,
    fireRisk: 10,
    stamina: 100,
    materials: 0,
    recycleParts: 0,
    ecoScore: 0,
    food: 0,
    carrying: null,
    visibleTrees: 0,
    pointerLocked: false,
    sprinting: false,
    totalTrash: trash.length,
    weaponLevel: 0,
    weaponCooldown: 0,
    junkRushTimer: 0,
    totalAnimals: animals.length,
    initialTreeCount: trees.length,
    initialForestValue,
    initialFireShield,
    plasticResidue: 0,
    blessingsClaimed: 0,
    base: { x: startX, y: startY },
    player: {
      x: startX,
      y: startY,
      angle: -Math.PI / 2,
      pitch: 0,
      crosshairX: 0,
      radius: 13,
    },
    trees,
    trash,
    bins,
    animals,
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
  staminaText.textContent = `${Math.round(game.stamina)}%`;
  woodText.textContent = `${game.materials} wood`;
  weaponText.textContent = getWeaponStats().name;
  rateText.textContent = `${(1 / getEffectiveWeaponCooldown()).toFixed(1)} / sec${game.junkRushTimer > 0 ? " rush" : ""}`;
  foodText.textContent = `${game.food} / ${FOOD_GOAL}`;
  recycleText.textContent = `${game.recycleParts}`;
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

function getLiveAnimalCount() {
  return game.animals.filter((animal) => animal.alive).length;
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

function clampSurvival() {
  game.stamina = Math.max(0, Math.min(MAX_STAMINA, game.stamina));
  game.materials = Math.max(0, Math.round(game.materials));
  game.recycleParts = Math.max(0, Math.round(game.recycleParts));
  game.food = Math.max(0, Math.round(game.food));
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

function getWeaponStats() {
  return WEAPON_TIERS[Math.max(0, Math.min(WEAPON_TIERS.length - 1, game.weaponLevel))];
}

function getEffectiveWeaponCooldown() {
  const base = getWeaponStats().cooldown;
  const junkMultiplier = game.junkRushTimer > 0 ? 0.74 : 1;
  const lowOxygenPenalty = game.oxygen < 18 ? 1.12 : 1;
  return base * junkMultiplier * lowOxygenPenalty;
}

function applyStatDelta(delta) {
  game.oxygen += delta.oxygen ?? 0;
  game.fireRisk += delta.fire ?? 0;
  game.ecoScore += delta.score ?? 0;
  clampMeters();
}

function spendStamina(amount) {
  game.stamina -= amount;
  clampSurvival();
}

function addMaterials(amount) {
  game.materials += amount;
  clampSurvival();
}

function addRecycleParts(amount) {
  game.recycleParts += amount;
  clampSurvival();
}

function isNearBase() {
  const distance = Math.hypot(game.player.x - game.base.x, game.player.y - game.base.y) / TILE;
  return distance <= BASE_ACTION_RANGE;
}

function getCrosshairPosition() {
  return {
    x: canvas.width / 2 + game.player.crosshairX,
    y: canvas.height / 2 + game.player.pitch * 0.55,
  };
}

function getAimAngle() {
  const horizontalOffset = (game.player.crosshairX / (canvas.width * 0.5)) * HALF_FOV;
  return normalizeAngle(game.player.angle + horizontalOffset);
}

function isVisible(x, y) {
  const dx = x - game.player.x;
  const dy = y - game.player.y;
  const distance = Math.hypot(dx, dy);

  if (distance > MAX_DEPTH * TILE) return false;

  const angle = Math.atan2(dy, dx);
  return Math.abs(angleDiff(angle, getAimAngle())) < HALF_FOV + 0.1;
}

function getTarget(type) {
  const candidates = [];
  const aimAngle = getAimAngle();
  const weapon = getWeaponStats();

  if (type === "tree") {
    for (const tree of game.trees) {
      if (!tree.alive) continue;

      const tx = tree.x * TILE;
      const ty = tree.y * TILE;
      const dx = tx - game.player.x;
      const dy = ty - game.player.y;
      const distance = Math.hypot(dx, dy) / TILE;
      const angle = Math.atan2(dy, dx);
      const diff = Math.abs(angleDiff(angle, aimAngle));

      if (distance <= CUT_RANGE && diff < 0.18 && hasLineOfSight(game.player.x, game.player.y, tx, ty)) {
        candidates.push({ object: tree, distance });
      }
    }
  }

  if (type === "animal") {
    for (const animal of game.animals) {
      if (!animal.alive) continue;

      const ax = animal.x * TILE;
      const ay = animal.y * TILE;
      const dx = ax - game.player.x;
      const dy = ay - game.player.y;
      const distance = Math.hypot(dx, dy) / TILE;
      const angle = Math.atan2(dy, dx);
      const diff = Math.abs(angleDiff(angle, aimAngle));

      if (distance <= weapon.range && diff < weapon.aimWindow && hasLineOfSight(game.player.x, game.player.y, ax, ay)) {
        candidates.push({ object: animal, distance });
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
      const diff = Math.abs(angleDiff(angle, aimAngle));

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
      const diff = Math.abs(angleDiff(angle, aimAngle));

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
      const diff = Math.abs(angleDiff(angle, aimAngle));

      if (distance <= INTERACT_RANGE && diff < 0.28 && hasLineOfSight(game.player.x, game.player.y, bx, by)) {
        candidates.push({ object: bin, distance });
      }
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0]?.object || null;
}

function fireWeapon() {
  if (game.over) return;

  if (game.carrying) {
    setMessage("Your hands are full. Sort the trash before trying to hunt.");
    syncHud();
    return;
  }

  if (game.weaponCooldown > 0) {
    setMessage(`${getWeaponStats().name} is not ready yet. Faster weapons come from spending more wood at camp.`);
    syncHud();
    return;
  }

  game.actionPose = "weapon";
  game.attackTimer = 0.18;
  game.weaponCooldown = getEffectiveWeaponCooldown();

  const animal = getTarget("animal");
  if (!animal) {
    setMessage("Your shot cut through the brush, but no animal was lined up cleanly.");
    syncHud();
    return;
  }

  animal.alive = false;
  const details = ANIMAL_TYPES[animal.kind];
  game.food += details.food;
  game.ecoScore += details.ecoCost;
  clampSurvival();
  setMessage(`You hunted a ${details.label} and brought back ${details.food} food. The camp is safer tonight, but the valley loses more wildlife.`);
  syncHud();
}

function craftWeaponUpgrade() {
  if (game.over) return;

  if (game.carrying) {
    setMessage("Sort what you're carrying before working at the camp bench.");
    syncHud();
    return;
  }

  if (!isNearBase()) {
    setMessage("Return to the camp bench to craft a better hunting weapon.");
    syncHud();
    return;
  }

  const nextLevel = game.weaponLevel + 1;
  if (nextLevel >= WEAPON_TIERS.length) {
    setMessage("Your camp weapon is already fully upgraded. Any more tree cutting only buys short-term comfort.");
    syncHud();
    return;
  }

  const nextWeapon = WEAPON_TIERS[nextLevel];
  if (game.materials < nextWeapon.upgradeCost) {
    setMessage(`You need ${nextWeapon.upgradeCost} wood to craft the ${nextWeapon.name}.`);
    syncHud();
    return;
  }

  addMaterials(-nextWeapon.upgradeCost);
  game.weaponLevel = nextLevel;
  game.actionPose = "weapon";
  game.attackTimer = 0.14;
  applyStatDelta({ oxygen: -1, fire: 2 });
  setMessage(`You crafted the ${nextWeapon.name}. Hunting is faster now, but every upgrade remembers which trees paid for it.`);
  syncHud();
}

function useBasePurifier() {
  if (game.over) return;

  if (game.carrying) {
    setMessage("Finish sorting what you're carrying before running the recycler purifier.");
    syncHud();
    return;
  }

  if (!isNearBase()) {
    setMessage("Get back to camp to feed recycle parts into the purifier.");
    syncHud();
    return;
  }

  if (game.recycleParts < PURIFIER_COST) {
    setMessage(`You need ${PURIFIER_COST} recycle parts from correct sorting to run the purifier.`);
    syncHud();
    return;
  }

  addRecycleParts(-PURIFIER_COST);
  applyStatDelta({ oxygen: 15, fire: -16, score: 7 });
  game.junkRushTimer = Math.max(0, game.junkRushTimer - 2);
  game.stamina += 8;
  clampSurvival();
  setMessage("The recycler purifier spins up on clean-sorted parts. Air clears and wildfire pressure drops, but your dirty combat rush fades.");
  syncHud();
}

function cutTree() {
  if (game.over) return;

  const tree = getTarget("tree");

  if (!tree) {
    game.actionPose = "axe";
    game.attackTimer = 0.16;
    setMessage("No tree is lined up in your crosshair.");
    syncHud();
    return;
  }

  const details = getTreeDetails(tree);
  if (game.stamina < details.staminaCost) {
    game.actionPose = "axe";
    game.attackTimer = 0.1;
    setMessage("Too exhausted to chop. Let stamina recover or stop sprinting for a moment.");
    syncHud();
    return;
  }

  game.actionPose = "axe";
  game.attackTimer = 0.16;
  spendStamina(details.staminaCost);
  addMaterials(details.materials);
  tree.alive = false;
  applyStatDelta(details.cut);

  if (tree.type === "old") {
    setMessage(`You felled an old-growth tree for ${details.materials} wood. That unlocks stronger weapons, but the forest just lost one of its biggest oxygen anchors.`);
  } else if (tree.type === "glowing") {
    const lostBlessing = tree.blessingUsed ? " Its blessing was already spent." : " Its unused blessing is gone too.";
    setMessage(`You cut an oxygen tree for ${details.materials} wood.${lostBlessing} Your camp gets resources, but the valley breathes a little worse.`);
  } else {
    setMessage(`You cut a young tree for ${details.materials} wood. It helps you craft better hunting gear, but every shortcut still weakens the forest.`);
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
      setMessage("The oxygen tree shares a living canopy blessing. Oxygen rises, fire risk eases, and the valley steadies around you.");
      syncHud();
      return;
    }

    const item = getTarget("trash");
    if (!item) {
      setMessage("Nothing useful to interact with here. Look at trash, an oxygen tree, or the right bin.");
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
    addRecycleParts(trashDetails.correct.parts ?? 0);
    game.junkRushTimer = Math.max(0, game.junkRushTimer - 1.5);
    if (carried.kind === "plastic") {
      game.plasticResidue = Math.max(0, game.plasticResidue - 1.8);
      setMessage("Correct choice. The plastic is contained, you salvaged recycler parts, and the air will recover over time, but there is no dirty combat boost from it.");
    } else if (carried.kind === "organic") {
      setMessage("Correct choice. The organic waste stops rotting and feeds the recycler, but you gave up the faster dirty overdrive route.");
    } else {
      setMessage("Correct choice. The toxic waste is sealed safely and yields the most purifier parts, but none of its volatile power reaches your weapon.");
    }
  } else {
    applyStatDelta(trashDetails.wrong);
    game.junkRushTimer = Math.min(JUNK_RUSH_MAX, game.junkRushTimer + (trashDetails.wrong.junk ?? 0));
    if (carried.kind === "plastic") {
      game.plasticResidue += 1.2;
      setMessage("Wrong choice. The plastic turns into dirty junk-rush power, so your weapon fires faster for a while, but the valley keeps poisoning itself.");
    } else if (carried.kind === "organic") {
      setMessage("Wrong choice. The waste gives you a short combat surge, but the rot and smoke spike immediately.");
    } else {
      setMessage("Wrong choice. The toxic spill supercharges your dirty fire rate, but the environmental shock is brutal.");
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

  const animal = getTarget("animal");
  const tree = getTarget("tree");
  const glowingTree = getTarget("glowing");
  const trash = getTarget("trash");
  const bin = getTarget("bin");
  const nearBase = isNearBase();
  const nextWeapon = WEAPON_TIERS[game.weaponLevel + 1];

  if (nearBase && !game.carrying && (nextWeapon || game.recycleParts >= PURIFIER_COST)) {
    if (nextWeapon && game.materials >= nextWeapon.upgradeCost && game.recycleParts >= PURIFIER_COST) {
      game.prompt = `At camp: press Q to craft ${nextWeapon.name}, or F to run the recycler purifier with ${PURIFIER_COST} clean parts.`;
    } else if (nextWeapon && game.materials >= nextWeapon.upgradeCost) {
      game.prompt = `At camp: press Q to craft ${nextWeapon.name}. More cutting means faster hunting, but worse forest health.`;
    } else if (game.recycleParts >= PURIFIER_COST) {
      game.prompt = "At camp: press F to run the recycler purifier and trade dirty combat rush for cleaner air.";
    }
    return;
  }

  if (glowingTree && !game.carrying) {
    game.prompt = "Press E to receive this oxygen tree's blessing, or Space if you want its wood badly enough to accept a major penalty.";
    return;
  }

  if (animal && !game.carrying) {
    game.prompt = `Click to hunt this ${ANIMAL_TYPES[animal.kind].label}. ${getWeaponStats().name} fires at ${(
      1 / getEffectiveWeaponCooldown()
    ).toFixed(1)} shots per second right now.`;
    return;
  }

  if (tree) {
    if (tree.type === "old") {
      game.prompt = "Press Space to cut this old-growth tree for 3 wood. That can unlock stronger weapons, but oxygen and fire stability take a hard hit.";
    } else if (tree.type === "glowing") {
      game.prompt = "Press Space to cut this oxygen tree for 2 wood. It helps your weapons, but even one loss hurts the valley badly.";
    } else {
      game.prompt = "Press Space to cut this young tree for 1 wood. Small gain now, slower environmental damage later if you keep doing it.";
    }
    return;
  }

  if (trash) {
    if (trash.kind === "plastic") {
      game.prompt = "Press E to pick up plastic trash. Correct sorting helps the purifier; wrong sorting fuels a dirty fire-rate boost.";
    } else if (trash.kind === "organic") {
      game.prompt = "Press E to pick up organic waste. Clean sorting settles the valley, wrong sorting gives a smaller dirty rush.";
    } else {
      game.prompt = "Press E to pick up toxic waste. It hurts immediately, but it also creates the strongest clean or dirty consequence.";
    }
    return;
  }

  if (bin && game.carrying) {
    game.prompt = `Press E to drop ${getTrashDetails(game.carrying).label} into the ${getBinLabel(bin.kind)}. Match it for recycler parts, or choose wrong for a dirty combat rush.`;
    return;
  }

  if (game.carrying) {
    if (game.carrying.kind === "toxic") {
      game.prompt = "Carrying toxic waste. The right bin protects the valley; the wrong bin supercharges your weapon at a brutal cost.";
    } else {
      game.prompt = `Carrying ${getTrashDetails(game.carrying).label}. Find the matching bin for clean recovery, or choose a wrong bin for dirty speed.`;
    }
    return;
  }

  if (game.junkRushTimer > 0) {
    game.prompt = "Dirty rush is active. Your weapon fires faster for a while, but the valley is paying for it.";
    return;
  }

  if (game.stamina < 20) {
    game.prompt = "Your stamina is low. Ease off sprinting and chopping, or get back to the base before panic takes over.";
    return;
  }

  game.prompt = "Feed the camp, sort every piece of trash, and decide how much of the forest you are willing to spend for faster hunting.";
}

function updateAnimals(dt, forestRatio) {
  for (const animal of game.animals) {
    if (!animal.alive) continue;

    const details = ANIMAL_TYPES[animal.kind];
    animal.pulse += dt * (2 + details.bob);
    animal.turnTimer -= dt;

    if (animal.turnTimer <= 0) {
      animal.turnTimer = 1 + Math.random() * 2.6;
      animal.angle += (Math.random() - 0.5) * 1.8;
    }

    const spook = (1 - forestRatio) * 0.8 + Math.max(0, game.fireRisk - 40) / 120;
    const speed = details.speed * (1 + spook);
    const nextX = animal.x * TILE + Math.cos(animal.angle) * speed * dt;
    const nextY = animal.y * TILE + Math.sin(animal.angle) * speed * dt;
    const wanderLimit = TILE * 2.8;
    const fromSpawn = Math.hypot(nextX - animal.spawnX * TILE, nextY - animal.spawnY * TILE);
    const playerDistance = Math.hypot(nextX - game.player.x, nextY - game.player.y);

    if (!collidesWithWorld(nextX, nextY, 8) && fromSpawn < wanderLimit && playerDistance > 26) {
      animal.x = nextX / TILE;
      animal.y = nextY / TILE;
    } else {
      animal.angle += Math.PI * (0.65 + Math.random() * 0.35);
      animal.turnTimer = 0.4 + Math.random() * 0.8;
    }
  }
}

function updateWorld(dt) {
  const forestRatio = getForestValue() / game.initialForestValue;
  const fireShieldRatio = getFireShieldValue() / game.initialFireShield;
  const glowingTrees = getAliveTreesByType("glowing");
  const plasticPending = getPendingTrashCount("plastic");
  const organicPending = getPendingTrashCount("organic");
  const toxicPending = getPendingTrashCount("toxic");
  const animalPressure = Math.max(0, FOOD_GOAL - game.food) * 0.03;

  updateAnimals(dt, forestRatio);
  game.junkRushTimer = Math.max(0, game.junkRushTimer - dt);

  game.plasticResidue = Math.max(
    0,
    Math.min(24, game.plasticResidue + plasticPending * 0.16 * dt - (plasticPending === 0 ? 0.04 * dt : 0))
  );

  const blessingSupport = game.blessingsClaimed * 0.04;
  const oxygenPressure = Math.max(0, 40 - game.oxygen) * 0.014;
  const heatSnowball = Math.max(0, game.fireRisk - 58) * 0.028;
  const passiveFireRise = (
    (1 - fireShieldRatio) * 1.45 +
    organicPending * 0.14 +
    toxicPending * 0.5 +
    game.plasticResidue * 0.018 -
    Math.min(0.25, game.recycleParts * 0.03) +
    oxygenPressure +
    heatSnowball -
    blessingSupport * 0.8 -
    glowingTrees * 0.03 -
    (isNearBase() ? 0.06 : 0)
  ) * dt;
  const passiveOxygenDrift = (
    (forestRatio - 0.58) * 1.4 +
    glowingTrees * 0.05 +
    blessingSupport -
    0.34 -
    Math.max(0, game.fireRisk - 45) * 0.03 -
    (game.sprinting ? 0.24 : 0) -
    animalPressure -
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

  if (getLiveAnimalCount() === 0 && game.food < FOOD_GOAL) {
    endGame(false, "You ran out of wildlife before the camp had enough food. Cutting faster weapons was not enough to save the valley.");
    return;
  }

  if (getHandledTrashCount() === game.totalTrash && game.food >= FOOD_GOAL && !game.carrying) {
    if (game.ecoScore >= 10 && game.oxygen >= 48 && game.fireRisk <= 65) {
      if (getAliveTreesByType("glowing") > 0 || game.blessingsClaimed > 0) {
        endGame(true, "The camp survives. You fed everyone, cleaned the valley, and left enough living canopy for the forest to keep breathing.");
      } else {
        endGame(true, "The camp survives, but every oxygen tree is gone. You won with a harsher, thinner future hanging over the valley.");
      }
    } else {
      endGame(false, "You met the short-term goals, but the combination of hunting pressure, bad sorting, and tree loss left the valley unstable.");
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

  const hasMovementInput = moveX !== 0 || moveY !== 0;
  const canSprint = keys.shift && hasMovementInput && game.stamina > 6;
  game.sprinting = canSprint;

  if (canSprint) {
    moveX *= SPRINT_BOOST;
    moveY *= SPRINT_BOOST;
  }

  const exhaustionSlow = game.stamina < 22 ? 0.68 + game.stamina / 70 : 1;
  const oxygenSlow = game.oxygen < 30 ? 0.82 + game.oxygen / 170 : 1;
  const heatSlow = game.fireRisk > 72 ? 1 - Math.min(0.22, (game.fireRisk - 72) / 125) : 1;
  const movementScale = exhaustionSlow * oxygenSlow * heatSlow;
  moveX *= movementScale;
  moveY *= movementScale;

  const nextX = game.player.x + moveX;
  const nextY = game.player.y + moveY;

  if (!collidesWithWorld(nextX, game.player.y, game.player.radius)) game.player.x = nextX;
  if (!collidesWithWorld(game.player.x, nextY, game.player.radius)) game.player.y = nextY;

  for (const tree of game.trees) tree.pulse += dt * 2;
  for (const item of game.trash) item.pulse += dt * 3;

  const movementAmount = Math.hypot(moveX, moveY);
  const lowOxygenStress = Math.max(0, 35 - game.oxygen) / 35;
  const heatStress = Math.max(0, game.fireRisk - 55) / 45;
  const toxicStress = game.carrying?.kind === "toxic" ? 0.35 : 0;

  let staminaDelta = 0;
  staminaDelta -= (lowOxygenStress * 5.5 + heatStress * 7 + toxicStress * 4) * dt;

  if (game.sprinting) {
    staminaDelta -= (24 + heatStress * 10 + toxicStress * 7) * dt;
  } else if (movementAmount > 0.05) {
    staminaDelta += (4 - lowOxygenStress * 3 - heatStress * 2.5) * dt;
  } else {
    staminaDelta += (18 - lowOxygenStress * 8 - heatStress * 6 - toxicStress * 3) * dt;
  }

  game.stamina += staminaDelta;
  clampSurvival();

  game.attackTimer = Math.max(0, game.attackTimer - dt);
  game.weaponCooldown = Math.max(0, game.weaponCooldown - dt);
  game.player.crosshairX += (0 - game.player.crosshairX) * Math.min(1, dt * CROSSHAIR_RETURN_SPEED);
  game.bob += Math.hypot(moveX, moveY) > 0 ? dt * 8 : dt * 2;

  updateWorld(dt);
  updatePrompt();
  syncHud();
}

function endGame(won, text) {
  game.over = true;
  game.ending = text;
  overlay.classList.remove("hidden");
  overlayTitle.textContent = won ? "Camp endures." : "The valley answered.";
  overlayText.textContent = text;
}

function renderScene() {
  const width = canvas.width;
  const height = canvas.height;
  const bobY = Math.sin(game.bob) * 4;
  const cameraLift = Math.max(-MAX_LOOK_PITCH, Math.min(MAX_LOOK_PITCH, bobY + game.player.pitch));
  const horizonY = Math.max(height * 0.28, Math.min(height * 0.78, height * 0.55 + cameraLift));

  ctx.clearRect(0, 0, width, height);

  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.6);
  sky.addColorStop(0, "#9bd5b3");
  sky.addColorStop(0.35, "#5c9d79");
  sky.addColorStop(0.72, "#274d3f");
  sky.addColorStop(1, "#173027");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizonY);

  drawSkyBackdrop(width, height, horizonY, cameraLift);

  const ground = ctx.createLinearGradient(0, horizonY - 30, 0, height);
  ground.addColorStop(0, "#53643a");
  ground.addColorStop(0.52, "#2f3e22");
  ground.addColorStop(1, "#182112");
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizonY, width, height - horizonY);
  drawGroundBackdrop(width, height, horizonY);

  for (let x = 0; x < width; x += 1) {
    const rayAngle = game.player.angle - HALF_FOV + (x / width) * FOV;
    const ray = castRay(rayAngle);
    const correctedDistance = ray.distance * Math.cos(rayAngle - game.player.angle);
    game.depthBuffer[x] = correctedDistance;

    const wallHeight = Math.min(height, (TILE * 360) / Math.max(correctedDistance, 1));
    const wallTop = height / 2 - wallHeight / 2 + cameraLift;
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

  renderSprites(cameraLift);
  renderWeapon(cameraLift);
  renderCrosshair();
  renderMiniMap();
  renderPressureEffects(width, height);
  renderStatusOverlay();
}

function drawGroundBackdrop(width, height, horizonY) {
  ctx.save();

  for (let i = 0; i < 18; i += 1) {
    const y = horizonY + i * 16;
    const alpha = 0.035 + i * 0.004;
    ctx.fillStyle = `rgba(255, 241, 188, ${alpha})`;
    ctx.fillRect(0, y, width, 1);
  }

  const path = ctx.createLinearGradient(width * 0.5, height, width * 0.5, horizonY);
  path.addColorStop(0, "rgba(126, 102, 70, 0.42)");
  path.addColorStop(1, "rgba(126, 102, 70, 0)");
  ctx.fillStyle = path;
  ctx.beginPath();
  ctx.moveTo(width * 0.36, height);
  ctx.lineTo(width * 0.46, horizonY + height * 0.07);
  ctx.lineTo(width * 0.54, horizonY + height * 0.07);
  ctx.lineTo(width * 0.64, height);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawSkyBackdrop(width, height, horizonY, cameraLift) {
  ctx.save();

  const sunX = width * 0.78;
  const sunY = height * 0.16 + cameraLift * 0.18;
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
  ctx.moveTo(0, horizonY - height * 0.13);
  ctx.lineTo(width * 0.18, horizonY - height * 0.27);
  ctx.lineTo(width * 0.34, horizonY - height * 0.15);
  ctx.lineTo(width * 0.5, horizonY - height * 0.29);
  ctx.lineTo(width * 0.7, horizonY - height * 0.15);
  ctx.lineTo(width * 0.88, horizonY - height * 0.33);
  ctx.lineTo(width, horizonY - height * 0.17);
  ctx.lineTo(width, horizonY);
  ctx.lineTo(0, horizonY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(22, 44, 34, 0.74)";
  for (let i = 0; i < width; i += 26) {
    const h = 45 + ((i * 13) % 42);
    ctx.beginPath();
    ctx.moveTo(i, horizonY);
    ctx.lineTo(i + 12, horizonY - h);
    ctx.lineTo(i + 26, horizonY);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function renderSprites(cameraLift) {
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

  for (const animal of game.animals) {
    if (!animal.alive) continue;
    sprites.push({
      type: "animal",
      animalKind: animal.kind,
      x: animal.x * TILE,
      y: animal.y * TILE,
      pulse: animal.pulse,
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
    const animalScale = sprite.type === "animal" ? ANIMAL_TYPES[sprite.animalKind].size : 1;
    const sizeScale = sprite.type === "tree" ? treeScale : sprite.type === "animal" ? animalScale : trashScale;
    const sizeBase = sprite.type === "tree" ? 420 : sprite.type === "bin" ? 210 : sprite.type === "animal" ? 220 : 190;
    const sizeLimit = sprite.type === "tree" ? 300 : sprite.type === "animal" ? 180 : 170;
    const size = Math.min(sizeLimit, ((TILE * sizeBase) / Math.max(distance, 1)) * sizeScale);
    const screenY = canvas.height / 2 + cameraLift + Math.sin(sprite.pulse) * 5;
    const left = Math.round(screenX - size / 2);
    const top = Math.round(screenY - size * (sprite.type === "tree" ? 0.9 : sprite.type === "animal" ? 0.62 : 0.5));
    const sampleX = Math.max(0, Math.min(canvas.width - 1, Math.round(screenX)));

    if (distance > game.depthBuffer[sampleX] + 12) continue;

    if (sprite.type === "tree") {
      drawTreeSprite(left, top, size, distance, sprite.treeType, sprite.blessingUsed);
    } else if (sprite.type === "animal") {
      drawAnimalSprite(left, top, size, distance, sprite.animalKind);
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

function drawAnimalSprite(left, top, size, distance, kind) {
  const alpha = Math.max(0.34, 1 - distance / (MAX_DEPTH * TILE));
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(left + size * 0.5, top + size * 0.94, size * 0.24, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  if (kind === "deer") {
    ctx.fillStyle = "#9e744e";
    ctx.beginPath();
    ctx.ellipse(left + size * 0.46, top + size * 0.56, size * 0.25, size * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(left + size * 0.6, top + size * 0.36, size * 0.08, size * 0.26);
    ctx.beginPath();
    ctx.ellipse(left + size * 0.7, top + size * 0.34, size * 0.1, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d9b08d";
    ctx.fillRect(left + size * 0.26, top + size * 0.62, size * 0.03, size * 0.24);
    ctx.fillRect(left + size * 0.4, top + size * 0.62, size * 0.03, size * 0.25);
    ctx.fillRect(left + size * 0.58, top + size * 0.62, size * 0.03, size * 0.25);
    ctx.fillRect(left + size * 0.71, top + size * 0.62, size * 0.03, size * 0.23);
    ctx.fillStyle = "#ead4b9";
    ctx.fillRect(left + size * 0.73, top + size * 0.23, size * 0.01, size * 0.1);
    ctx.fillRect(left + size * 0.79, top + size * 0.21, size * 0.01, size * 0.12);
  } else {
    ctx.fillStyle = "#6d4a38";
    ctx.beginPath();
    ctx.ellipse(left + size * 0.48, top + size * 0.6, size * 0.27, size * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(left + size * 0.72, top + size * 0.55, size * 0.11, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#896452";
    ctx.fillRect(left + size * 0.24, top + size * 0.67, size * 0.04, size * 0.2);
    ctx.fillRect(left + size * 0.39, top + size * 0.69, size * 0.04, size * 0.18);
    ctx.fillRect(left + size * 0.56, top + size * 0.69, size * 0.04, size * 0.18);
    ctx.fillRect(left + size * 0.72, top + size * 0.68, size * 0.04, size * 0.19);
    ctx.fillStyle = "#efe5d3";
    ctx.fillRect(left + size * 0.8, top + size * 0.54, size * 0.04, size * 0.015);
  }

  ctx.restore();
}

function renderWeapon(cameraLift) {
  const usingAxe = game.actionPose === "axe" && game.attackTimer > 0;
  const duration = usingAxe ? 0.16 : 0.18;
  const swing = game.attackTimer > 0 ? Math.sin((game.attackTimer / duration) * Math.PI) : 0;
  const handleX = canvas.width * 0.77 + swing * 22 + game.player.crosshairX * 0.2;
  const handleY = canvas.height * 0.8 + cameraLift * 0.22;
  const weapon = getWeaponStats();

  if (usingAxe) {
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
    return;
  }

  ctx.fillStyle = "#654329";
  ctx.fillRect(handleX + 8, handleY + 10, 14, 96);
  ctx.fillStyle = "#8a633d";
  ctx.fillRect(handleX - 26, handleY + 22, 48, 16);

  if (game.weaponLevel === 0) {
    ctx.fillStyle = "#815735";
    ctx.fillRect(handleX - 18 - swing * 18, handleY - 40, 10, 60);
    ctx.fillRect(handleX + 8 - swing * 12, handleY - 34, 10, 54);
    ctx.strokeStyle = "rgba(240, 233, 199, 0.92)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(handleX - 10 - swing * 14, handleY - 34);
    ctx.lineTo(handleX + 12 - swing * 8, handleY - 26);
    ctx.stroke();
  } else if (game.weaponLevel < 3) {
    ctx.strokeStyle = weapon.name === "Twig Bow" ? "#d8cba4" : "#efe2ba";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(handleX - 16 - swing * 20, handleY - 52);
    ctx.quadraticCurveTo(handleX - 42 - swing * 12, handleY - 8, handleX - 10 - swing * 18, handleY + 36);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(handleX - 16 - swing * 20, handleY - 52);
    ctx.lineTo(handleX - 10 - swing * 18, handleY + 36);
    ctx.stroke();
    ctx.fillStyle = game.weaponLevel === 1 ? "#8c643e" : "#7a5733";
    ctx.fillRect(handleX - 4, handleY - 20, 14, 74);
  } else {
    ctx.fillStyle = "#6f4d30";
    ctx.fillRect(handleX - 56 - swing * 18, handleY - 36, 86, 18);
    ctx.fillStyle = "#9f8a5c";
    ctx.fillRect(handleX - 56 - swing * 16, handleY - 50, 54, 16);
    ctx.fillStyle = "#cdc7b0";
    ctx.fillRect(handleX + 10, handleY - 46, 10, 74);
    ctx.fillStyle = "rgba(255, 232, 184, 0.28)";
    ctx.fillRect(handleX - 18 - swing * 14, handleY - 44, 12, 8);
  }

  if (game.attackTimer > 0) {
    ctx.fillStyle = `rgba(255, 229, 160, ${0.12 + swing * 0.16})`;
    ctx.beginPath();
    ctx.arc(handleX - 44 - swing * 12, handleY - 34, 16 + swing * 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderCrosshair() {
  const { x: cx, y: cy } = getCrosshairPosition();
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

  for (const animal of game.animals) {
    if (!animal.alive) continue;
    ctx.fillStyle = animal.kind === "deer" ? "#d8b28a" : "#a77763";
    ctx.fillRect(offsetX + animal.x * scale - 2, offsetY + animal.y * scale - 2, 4, 4);
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
  ctx.fillRect(16, 16, 528, 124);

  ctx.fillStyle = "#eff3ff";
  ctx.font = "16px monospace";
  ctx.fillText(`OXYGEN ${Math.round(game.oxygen)}%`, 28, 40);
  ctx.fillText(`FIRE ${Math.round(game.fireRisk)}%`, 28, 62);
  ctx.fillText(`STAMINA ${Math.round(game.stamina)}%`, 28, 84);
  ctx.fillText(`WOOD ${game.materials}   PARTS ${game.recycleParts}`, 28, 106);
  ctx.fillText(`FOOD ${game.food}/${FOOD_GOAL}   SCORE ${Math.round(game.ecoScore)}`, 232, 40);
  ctx.fillText(`WEAPON ${getWeaponStats().name.toUpperCase()}`, 232, 62);
  ctx.fillText(`RATE ${(1 / getEffectiveWeaponCooldown()).toFixed(1)}/SEC`, 232, 84);
  ctx.fillText(`WILDLIFE ${getLiveAnimalCount()}`, 232, 106);

  ctx.fillStyle = "#21314c";
  ctx.fillRect(328, 22, 200, 14);
  ctx.fillRect(328, 50, 200, 14);
  ctx.fillRect(328, 78, 200, 14);
  ctx.fillStyle = game.oxygen > 40 ? "#86f0a6" : "#ff9c7c";
  ctx.fillRect(328, 22, 2 * game.oxygen, 14);
  ctx.fillStyle = game.fireRisk < 55 ? "#7fd4ff" : "#ff7b88";
  ctx.fillRect(328, 50, 2 * game.fireRisk, 14);
  ctx.fillStyle = game.stamina > 35 ? "#f0d780" : "#ffb36f";
  ctx.fillRect(328, 78, 2 * game.stamina, 14);

  if (game.junkRushTimer > 0) {
    ctx.fillStyle = "rgba(5, 10, 16, 0.68)";
    ctx.fillRect(16, 146, 220, 34);
    ctx.fillStyle = "#ffb36f";
    ctx.font = "14px monospace";
    ctx.fillText(`DIRTY RUSH ${game.junkRushTimer.toFixed(1)}s`, 28, 168);
    ctx.font = "16px monospace";
  }

  if (game.carrying) {
    ctx.fillStyle = "rgba(5, 10, 16, 0.68)";
    ctx.fillRect(canvas.width - 252, 16, 236, 42);
    ctx.fillStyle = "#eff3ff";
    ctx.font = "14px monospace";
    ctx.fillText(`CARRY ${getTrashDetails(game.carrying).label.toUpperCase()}`, canvas.width - 236, 42);
    ctx.font = "16px monospace";
  }
}

function renderPressureEffects(width, height) {
  const oxygenPanic = Math.max(0, 34 - game.oxygen) / 34;
  const heatPanic = Math.max(0, game.fireRisk - 62) / 38;
  const staminaPanic = Math.max(0, 22 - game.stamina) / 22;

  if (oxygenPanic > 0) {
    const vignette = ctx.createRadialGradient(
      width * 0.5,
      height * 0.52,
      width * 0.12,
      width * 0.5,
      height * 0.52,
      width * 0.76
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, `rgba(5, 11, 20, ${0.45 * oxygenPanic})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  if (heatPanic > 0) {
    const heatGlow = ctx.createRadialGradient(
      width * 0.5,
      height * 0.6,
      width * 0.1,
      width * 0.5,
      height * 0.6,
      width * 0.9
    );
    heatGlow.addColorStop(0, `rgba(255, 132, 86, ${0.05 * heatPanic})`);
    heatGlow.addColorStop(1, `rgba(255, 68, 41, ${0.28 * heatPanic})`);
    ctx.fillStyle = heatGlow;
    ctx.fillRect(0, 0, width, height);
  }

  if (staminaPanic > 0) {
    ctx.fillStyle = `rgba(255, 226, 150, ${0.08 * staminaPanic})`;
    ctx.fillRect(0, height * 0.72, width, height * 0.28);
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
    return;
  }

  fireWeapon();
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas || game.over) return;
  game.player.angle = normalizeAngle(game.player.angle + event.movementX * TURN_SPEED);
  game.player.pitch = Math.max(
    -MAX_LOOK_PITCH,
    Math.min(MAX_LOOK_PITCH, game.player.pitch + event.movementY * LOOK_PITCH_SPEED)
  );
  game.player.crosshairX = Math.max(
    -MAX_CROSSHAIR_DRIFT,
    Math.min(MAX_CROSSHAIR_DRIFT, game.player.crosshairX + event.movementX * CROSSHAIR_DRIFT)
  );
});

window.addEventListener("keydown", (event) => {
  setKey(event, true);

  if (event.code === "Space") {
    event.preventDefault();
    cutTree();
  }

  if (event.code === "KeyE") interact();
  if (event.code === "KeyQ") craftWeaponUpgrade();
  if (event.code === "KeyF") useBasePurifier();
  if (event.code === "KeyR") resetGame();
});

window.addEventListener("keyup", (event) => {
  setKey(event, false);
});

restartButton.addEventListener("click", resetGame);

resetGame();
requestAnimationFrame(frame);
