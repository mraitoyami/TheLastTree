const items = window.GARBAGE_ITEMS || [];

const itemCount = document.getElementById("item-count");
const scoreText = document.getElementById("score-text");
const timerText = document.getElementById("timer-text");
const statusText = document.getElementById("status-text");
const trashCardInner = document.getElementById("trash-card-inner");
const trashEmoji = document.getElementById("trash-emoji");
const trashName = document.getElementById("trash-name");
const trashHint = document.getElementById("trash-hint");
const messagePanel = document.getElementById("message-panel");
const messageTitle = document.getElementById("message-title");
const messageBody = document.getElementById("message-body");
const restartButton = document.getElementById("restart-button");
const startButton = document.getElementById("start-button");
const startScreen = document.getElementById("start-screen");
const winScreen = document.getElementById("win-screen");
const winSummary = document.getElementById("win-summary");
const winPlayAgainButton = document.getElementById("win-play-again");
const playerNameInput = document.getElementById("player-name");
const leaderboardList = document.getElementById("leaderboard-list");
const leaderboardCopy = document.getElementById("leaderboard-copy");
const dragGhost = document.getElementById("drag-ghost");
const difficultySelect = document.getElementById("difficulty-select");
const binButtons = [...document.querySelectorAll(".bin")];
const difficultyButtons = [...document.querySelectorAll(".difficulty-button")];

let currentIndex = 0;
let isGameOver = false;
let isPlaying = false;
let deck = [];
let score = 0;
let timeLeft = 60;
let timerId = null;
let selectedDifficulty = "easy";
let dragState = null;
let playerName = "";
let itemStartedAt = 0;
let leaderboardDb = null;
let leaderboardMode = "local";

const difficultySettings = {
  easy: {
    label: "Easy",
    time: 75,
    bonus: 4,
    itemCount: 8,
    speedScore: [180, 140, 110, 90],
  },
  normal: {
    label: "Normal",
    time: 55,
    bonus: 3,
    itemCount: 10,
    speedScore: [240, 190, 150, 110],
  },
  hard: {
    label: "Hard",
    time: 40,
    bonus: 2,
    itemCount: 12,
    speedScore: [320, 250, 190, 130],
  },
};

function playTone(frequency, duration, type = "sine", volume = 0.03) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  if (!playTone.context) {
    playTone.context = new AudioContextClass();
  }

  const context = playTone.context;

  if (context.state === "suspended") {
    context.resume();
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  oscillator.stop(context.currentTime + duration);
}

function playCorrectSound() {
  playTone(720, 0.12, "triangle");
  setTimeout(() => playTone(920, 0.12, "triangle"), 90);
}

function playWrongSound() {
  playTone(240, 0.22, "sawtooth");
}

function playWinSound() {
  [520, 660, 880].forEach((tone, index) => {
    setTimeout(() => playTone(tone, 0.16, "triangle"), index * 110);
  });
}

function clearTimer() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function updateScore() {
  scoreText.textContent = String(score);
}

function updateTimer() {
  timerText.textContent = `${timeLeft}s`;
}

function startTimer() {
  if (!isPlaying) {
    return;
  }

  clearTimer();
  updateTimer();

  timerId = window.setInterval(() => {
    timeLeft -= 1;
    updateTimer();

    if (timeLeft <= 0) {
      handleLoss("time ran out");
    }
  }, 1000);
}

function pulseCard(className) {
  trashCardInner.classList.remove("celebrate", "shake");
  void trashCardInner.offsetWidth;
  trashCardInner.classList.add(className);
}

function formatBinName(binName) {
  if (binName === "time ran out") {
    return binName;
  }

  return binName.charAt(0).toUpperCase() + binName.slice(1);
}

function getSettings() {
  return difficultySettings[selectedDifficulty];
}

function shuffle(source) {
  const clone = [...source];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[randomIndex]] = [clone[randomIndex], clone[index]];
  }

  return clone;
}

function setBinsDisabled(disabled) {
  binButtons.forEach((button) => {
    button.disabled = disabled;
  });

  trashCardInner.draggable = !disabled;
}

function showMessage(title, body, mode = "") {
  messageTitle.textContent = title;
  messageBody.textContent = body;
  messagePanel.classList.remove("win", "lose");

  if (mode) {
    messagePanel.classList.add(mode);
  }
}

function renderCurrentItem() {
  const currentItem = deck[currentIndex];

  if (!currentItem) {
    itemCount.textContent = `0 / ${deck.length}`;
    return;
  }

  itemCount.textContent = `${currentIndex + 1} / ${deck.length}`;
  trashEmoji.textContent = currentItem.emoji;
  trashName.textContent = currentItem.name;
  trashHint.textContent = currentItem.hint;
  statusText.textContent = "Choose the right bin";
  itemStartedAt = Date.now();
}

function getPointsForSelection(secondsTaken) {
  const { speedScore } = getSettings();

  if (secondsTaken <= 1) {
    return speedScore[0];
  }

  if (secondsTaken <= 2) {
    return speedScore[1];
  }

  if (secondsTaken <= 3) {
    return speedScore[2];
  }

  return speedScore[3];
}

function handleWin() {
  isGameOver = true;
  isPlaying = false;
  clearTimer();
  setBinsDisabled(true);
  statusText.textContent = "You win";
  playWinSound();
  pulseCard("celebrate");
  saveScore().then(() => renderLeaderboard());
  showWinScreen();
  showMessage(
    "You cleaned up the whole park!",
    `Every item was sorted correctly on ${getSettings().label}. Final score: ${score}. Press Play Again to go another round.`,
    "win"
  );
}

function handleLoss(correctBin) {
  isGameOver = true;
  isPlaying = false;
  clearTimer();
  setBinsDisabled(true);
  statusText.textContent = "You lose";

  if (correctBin === "time ran out") {
    playWrongSound();
    pulseCard("shake");
    showMessage("Time's up!", `You scored ${score} before the timer ended. Press Play Again to try again.`, "lose");
    return;
  }

  playWrongSound();
  pulseCard("shake");
  showMessage("Wrong bin!", `That item belonged in ${formatBinName(correctBin)}. Press Play Again to try again.`, "lose");
}

function handleSelection(selectedBin) {
  if (isGameOver || !isPlaying) {
    return;
  }

  const currentItem = deck[currentIndex];
  const secondsTaken = Math.max(1, Math.ceil((Date.now() - itemStartedAt) / 1000));

  if (selectedBin !== currentItem.bin) {
    handleLoss(currentItem.bin);
    return;
  }

  const earnedPoints = getPointsForSelection(secondsTaken);

  score += earnedPoints;
  timeLeft += getSettings().bonus;
  updateScore();
  updateTimer();
  playCorrectSound();
  pulseCard("celebrate");
  currentIndex += 1;

  if (currentIndex >= deck.length) {
    handleWin();
    return;
  }

  statusText.textContent = "Correct";
  showMessage("Nice sorting!", `You earned ${earnedPoints} points in ${secondsTaken} second${secondsTaken === 1 ? "" : "s"}.`);
  renderCurrentItem();
}

function restartGame() {
  if (!items.length) {
    showMessage("No garbage items found", "Add items to garbage-data.js and reload the page.", "lose");
    setBinsDisabled(true);
    return;
  }

  const settings = getSettings();
  deck = shuffle(items).slice(0, Math.min(settings.itemCount, items.length));
  currentIndex = 0;
  isGameOver = false;
  isPlaying = true;
  score = 0;
  timeLeft = settings.time;
  setBinsDisabled(false);
  hideWinScreen();
  updateScore();
  startTimer();
  showMessage(
    "Go!",
    `You're playing ${settings.label}. Sort all ${deck.length} items correctly before time runs out.`,
  );
  renderCurrentItem();
}

function showStartScreen(prefillName = playerName) {
  startScreen.classList.remove("hidden");
  document.body.classList.add("locked");
  document.body.classList.remove("dragging-trash");
  playerNameInput.value = prefillName || "";
  window.setTimeout(() => {
    playerNameInput.focus();
    playerNameInput.select();
  }, 0);
}

function setDifficulty(nextDifficulty) {
  selectedDifficulty = nextDifficulty;

  difficultyButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.difficulty === nextDifficulty);
  });

  if (difficultySelect) {
    difficultySelect.value = nextDifficulty;
  }

  const settings = getSettings();
  timeLeft = settings.time;
  updateTimer();
  showMessage("Difficulty selected", `${settings.label} gives you ${settings.time} seconds and +${settings.bonus}s for each correct sort.`);
}

function updateLeaderboardCopy() {
  if (leaderboardMode === "remote") {
    leaderboardCopy.textContent = "Shared leaderboard across devices is live.";
    return;
  }

  leaderboardCopy.textContent = "Top scores are saved in your browser on this device.";
}

function initializeLeaderboardStore() {
  const config = window.FIREBASE_LEADERBOARD_CONFIG;

  if (!config || !window.firebase || !config.apiKey || !config.projectId) {
    leaderboardMode = "local";
    updateLeaderboardCopy();
    return;
  }

  try {
    const app = window.firebase.apps && window.firebase.apps.length
      ? window.firebase.app()
      : window.firebase.initializeApp(config);

    leaderboardDb = app.firestore();
    leaderboardMode = "remote";
  } catch {
    leaderboardDb = null;
    leaderboardMode = "local";
  }

  updateLeaderboardCopy();
}

async function loadScores() {
  if (leaderboardMode === "remote" && leaderboardDb) {
    try {
      const snapshot = await leaderboardDb
        .collection("leaderboard")
        .orderBy("score", "desc")
        .limit(10)
        .get();

      return snapshot.docs.map((doc) => doc.data());
    } catch {
      leaderboardMode = "local";
      updateLeaderboardCopy();
    }
  }

  try {
    const raw = window.localStorage.getItem("garbage-sorting-leaderboard");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveScore() {
  if (score <= 0) {
    return;
  }

  const entry = {
    name: playerName || "Player",
    score,
    difficultyKey: selectedDifficulty,
    difficulty: getSettings().label,
    date: new Date().toLocaleDateString(),
  };

  if (leaderboardMode === "remote" && leaderboardDb) {
    try {
      await leaderboardDb.collection("leaderboard").add(entry);
      return;
    } catch {
      leaderboardMode = "local";
      updateLeaderboardCopy();
    }
  }

  const scores = await loadScores();
  scores.push(entry);

  scores.sort((left, right) => right.score - left.score);
  const trimmed = scores.slice(0, 10);

  try {
    window.localStorage.setItem("garbage-sorting-leaderboard", JSON.stringify(trimmed));
  } catch {
    return;
  }
}

async function renderLeaderboard() {
  const scores = await loadScores();

  if (!scores.length) {
    leaderboardList.innerHTML = "<li>No scores yet.</li>";
    return;
  }

  leaderboardList.innerHTML = scores
    .map((entry, index) => `<li>${index + 1}. ${entry.name} - ${entry.score} points - ${entry.difficulty}</li>`)
    .join("");
}

function hideStartScreen() {
  startScreen.classList.add("hidden");
  document.body.classList.remove("locked");
}

function showWinScreen() {
  winSummary.textContent = `Score: ${score} points on ${getSettings().label} difficulty with ${timeLeft} seconds left.`;
  winScreen.classList.remove("hidden");
}

function hideWinScreen() {
  winScreen.classList.add("hidden");
}

function sanitizePlayerName(value) {
  return value.trim().replace(/\s+/g, " ").slice(0, 18);
}

function clearDragHighlights() {
  binButtons.forEach((button) => button.classList.remove("drag-over"));
}

function updateGhostPosition(clientX, clientY) {
  dragGhost.style.left = `${clientX}px`;
  dragGhost.style.top = `${clientY}px`;
}

function findBinAtPoint(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  return target ? target.closest(".bin") : null;
}

function startPointerDrag(clientX, clientY) {
  if (!isPlaying || isGameOver) {
    return;
  }

  const currentItem = deck[currentIndex];

  if (!currentItem) {
    return;
  }

  dragState = {
    clientX,
    clientY,
  };

  dragGhost.innerHTML = `<div class="trash-emoji">${currentItem.emoji}</div><div>${currentItem.name}</div>`;
  dragGhost.classList.add("visible");
  trashCardInner.classList.add("dragging");
  document.body.classList.add("dragging-trash");
  updateGhostPosition(clientX, clientY);
}

function movePointerDrag(clientX, clientY) {
  if (!dragState) {
    return;
  }

  dragState.clientX = clientX;
  dragState.clientY = clientY;
  updateGhostPosition(clientX, clientY);
  clearDragHighlights();

  const hoveredBin = findBinAtPoint(clientX, clientY);

  if (hoveredBin && !hoveredBin.disabled) {
    hoveredBin.classList.add("drag-over");
  }
}

function endPointerDrag(clientX, clientY) {
  if (!dragState) {
    return;
  }

  movePointerDrag(clientX, clientY);

  const hoveredBin = findBinAtPoint(clientX, clientY);
  dragState = null;
  dragGhost.classList.remove("visible");
  trashCardInner.classList.remove("dragging");
  document.body.classList.remove("dragging-trash");
  clearDragHighlights();

  if (hoveredBin && !hoveredBin.disabled) {
    handleSelection(hoveredBin.dataset.bin);
  }
}

function handlePointerMove(event) {
  movePointerDrag(event.clientX, event.clientY);
}

function handlePointerUp(event) {
  endPointerDrag(event.clientX, event.clientY);
}

binButtons.forEach((button) => {
  button.addEventListener("click", () => {
    handleSelection(button.dataset.bin);
  });

  button.addEventListener("dragover", (event) => {
    if (isGameOver) {
      return;
    }

    event.preventDefault();
    button.classList.add("drag-over");
  });

  button.addEventListener("dragleave", () => {
    button.classList.remove("drag-over");
  });

  button.addEventListener("drop", (event) => {
    event.preventDefault();
    button.classList.remove("drag-over");
    handleSelection(button.dataset.bin);
  });
});

trashCardInner.addEventListener("dragstart", (event) => {
  if (isGameOver || !isPlaying) {
    event.preventDefault();
    return;
  }

  trashCardInner.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", deck[currentIndex].name);
});

trashCardInner.addEventListener("dragend", () => {
  trashCardInner.classList.remove("dragging");
  clearDragHighlights();
});

trashCardInner.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  startPointerDrag(event.clientX, event.clientY);
});

window.addEventListener("pointermove", (event) => {
  if (dragState) {
    event.preventDefault();
  }

  handlePointerMove(event);
}, { passive: false });
window.addEventListener("pointerup", handlePointerUp);
window.addEventListener("pointercancel", () => {
  if (!dragState) {
    return;
  }

  dragState = null;
  dragGhost.classList.remove("visible");
  trashCardInner.classList.remove("dragging");
  document.body.classList.remove("dragging-trash");
  clearDragHighlights();
});

trashCardInner.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    showMessage("Sorting help", "Tap or click a bin now, or drag the item into one of the bins.");
  }
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setDifficulty(button.dataset.difficulty);
  });
});

if (difficultySelect) {
  difficultySelect.addEventListener("change", () => {
    setDifficulty(difficultySelect.value);
  });
}

restartButton.addEventListener("click", () => {
  playerName = "";
  hideWinScreen();
  showStartScreen("");
});
startButton.addEventListener("click", () => {
  const nextName = sanitizePlayerName(playerNameInput.value);

  if (!nextName) {
    showMessage("Enter your name", "Type your name before starting so it can show on the leaderboard.", "lose");
    playerNameInput.focus();
    return;
  }

  playerName = nextName;
  hideStartScreen();
  restartGame();
});
winPlayAgainButton.addEventListener("click", () => {
  hideWinScreen();
  playerName = "";
  showStartScreen("");
});

playerNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    startButton.click();
  }
});

document.body.classList.add("locked");
initializeLeaderboardStore();
setDifficulty(selectedDifficulty);
updateScore();
renderLeaderboard();
setBinsDisabled(true);
showStartScreen();
