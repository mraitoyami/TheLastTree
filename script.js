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
const musicButton = document.getElementById("music-button");
const leaderboardList = document.getElementById("leaderboard-list");
const dragGhost = document.getElementById("drag-ghost");
const bgMusic = document.getElementById("bg-music");
const correctSfx = document.getElementById("correct-sfx");
const wrongSfx = document.getElementById("wrong-sfx");
const winSfx = document.getElementById("win-sfx");
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
let musicEnabled = true;
let musicIntervalId = null;
const brokenAudioIds = new Set();

const difficultySettings = {
  easy: {
    label: "Easy",
    time: 75,
    bonus: 4,
    itemCount: 8,
  },
  normal: {
    label: "Normal",
    time: 55,
    bonus: 3,
    itemCount: 10,
  },
  hard: {
    label: "Hard",
    time: 40,
    bonus: 2,
    itemCount: 12,
  },
};

const musicPattern = [262, 330, 392, 330, 294, 349, 440, 349];

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
  if (playAudio(correctSfx)) {
    return;
  }

  playTone(720, 0.12, "triangle");
  setTimeout(() => playTone(920, 0.12, "triangle"), 90);
}

function playWrongSound() {
  if (playAudio(wrongSfx)) {
    return;
  }

  playTone(240, 0.22, "sawtooth");
}

function playWinSound() {
  if (playAudio(winSfx)) {
    return;
  }

  [520, 660, 880].forEach((tone, index) => {
    setTimeout(() => playTone(tone, 0.16, "triangle"), index * 110);
  });
}

function playAudio(audioElement) {
  if (!audioElement || !audioElement.currentSrc || brokenAudioIds.has(audioElement.id)) {
    return false;
  }

  audioElement.currentTime = 0;
  const playAttempt = audioElement.play();

  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(() => {});
  }

  return true;
}

function playMusicStep() {
  if (!musicEnabled || !isPlaying) {
    return;
  }

  musicPattern.forEach((tone, index) => {
    setTimeout(() => {
      if (musicEnabled && isPlaying) {
        playTone(tone, 0.22, "sine", 0.015);
      }
    }, index * 260);
  });
}

function stopMusic() {
  if (musicIntervalId) {
    window.clearInterval(musicIntervalId);
    musicIntervalId = null;
  }

  if (bgMusic) {
    bgMusic.pause();
    bgMusic.currentTime = 0;
  }
}

function startMusic() {
  stopMusic();

  if (!musicEnabled || !isPlaying) {
    return;
  }

  if (bgMusic && bgMusic.currentSrc && !brokenAudioIds.has(bgMusic.id)) {
    const playAttempt = bgMusic.play();

    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(() => {});
    }

    return;
  }

  playMusicStep();
  musicIntervalId = window.setInterval(playMusicStep, musicPattern.length * 260 + 400);
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
}

function handleWin() {
  isGameOver = true;
  isPlaying = false;
  clearTimer();
  stopMusic();
  setBinsDisabled(true);
  statusText.textContent = "You win";
  playWinSound();
  pulseCard("celebrate");
  saveScore();
  renderLeaderboard();
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
  stopMusic();
  setBinsDisabled(true);
  statusText.textContent = "You lose";

  if (correctBin === "time ran out") {
    playWrongSound();
    pulseCard("shake");
    saveScore();
    renderLeaderboard();
    showMessage("Time's up!", `You scored ${score} before the timer ended. Press Play Again to try again.`, "lose");
    return;
  }

  playWrongSound();
  pulseCard("shake");
  saveScore();
  renderLeaderboard();
  showMessage("Wrong bin!", `That item belonged in ${formatBinName(correctBin)}. Press Play Again to try again.`, "lose");
}

function handleSelection(selectedBin) {
  if (isGameOver || !isPlaying) {
    return;
  }

  const currentItem = deck[currentIndex];

  if (selectedBin !== currentItem.bin) {
    handleLoss(currentItem.bin);
    return;
  }

  score += 100;
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
  showMessage("Nice sorting!", "Keep going. One wrong move will end the round.");
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
  startMusic();
  showMessage(
    "Go!",
    `You're playing ${settings.label}. Sort all ${deck.length} items correctly before time runs out.`,
  );
  renderCurrentItem();
}

function setDifficulty(nextDifficulty) {
  selectedDifficulty = nextDifficulty;

  difficultyButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.difficulty === nextDifficulty);
  });

  const settings = getSettings();
  timeLeft = settings.time;
  updateTimer();
  showMessage("Difficulty selected", `${settings.label} gives you ${settings.time} seconds and +${settings.bonus}s for each correct sort.`);
}

function loadScores() {
  try {
    const raw = window.localStorage.getItem("garbage-sorting-leaderboard");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveScore() {
  if (score <= 0) {
    return;
  }

  const scores = loadScores();
  scores.push({
    score,
    difficulty: getSettings().label,
    date: new Date().toLocaleDateString(),
  });

  scores.sort((left, right) => right.score - left.score);
  const trimmed = scores.slice(0, 5);

  try {
    window.localStorage.setItem("garbage-sorting-leaderboard", JSON.stringify(trimmed));
  } catch {
    return;
  }
}

function renderLeaderboard() {
  const scores = loadScores();

  if (!scores.length) {
    leaderboardList.innerHTML = "<li>No scores yet.</li>";
    return;
  }

  leaderboardList.innerHTML = scores
    .map((entry) => `<li>${entry.score} points - ${entry.difficulty} - ${entry.date}</li>`)
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

function updateMusicButton() {
  musicButton.textContent = `Music: ${musicEnabled ? "On" : "Off"}`;
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
  startPointerDrag(event.clientX, event.clientY);
});

window.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerup", handlePointerUp);
window.addEventListener("pointercancel", () => {
  if (!dragState) {
    return;
  }

  dragState = null;
  dragGhost.classList.remove("visible");
  trashCardInner.classList.remove("dragging");
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

musicButton.addEventListener("click", () => {
  musicEnabled = !musicEnabled;
  updateMusicButton();

  if (musicEnabled) {
    startMusic();
  } else {
    stopMusic();
  }
});

restartButton.addEventListener("click", restartGame);
startButton.addEventListener("click", () => {
  hideStartScreen();
  restartGame();
});
winPlayAgainButton.addEventListener("click", restartGame);

[bgMusic, correctSfx, wrongSfx, winSfx].forEach((audioElement) => {
  if (!audioElement) {
    return;
  }

  audioElement.addEventListener("error", () => {
    brokenAudioIds.add(audioElement.id);
  });
});

document.body.classList.add("locked");
setDifficulty(selectedDifficulty);
updateScore();
updateMusicButton();
renderLeaderboard();
