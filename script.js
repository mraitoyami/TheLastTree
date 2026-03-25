const items = [
  {
    name: "Banana Peel",
    emoji: "🍌",
    hint: "Fruit scraps belong with compostable waste.",
    bin: "organic",
  },
  {
    name: "Newspaper",
    emoji: "📰",
    hint: "Clean paper can usually be recycled.",
    bin: "recycle",
  },
  {
    name: "Broken Mug",
    emoji: "☕",
    hint: "Ceramics do not go in regular home recycling.",
    bin: "landfill",
  },
  {
    name: "Plastic Bottle",
    emoji: "🧴",
    hint: "A clean bottle belongs in recycling.",
    bin: "recycle",
  },
  {
    name: "Apple Core",
    emoji: "🍎",
    hint: "Food leftovers belong in the organic bin.",
    bin: "organic",
  },
  {
    name: "Chip Bag",
    emoji: "🥔",
    hint: "Mixed plastic packaging is usually regular trash.",
    bin: "landfill",
  },
  {
    name: "Cardboard Box",
    emoji: "📦",
    hint: "Flattened cardboard is recyclable.",
    bin: "recycle",
  },
  {
    name: "Tea Bag",
    emoji: "🫖",
    hint: "Used tea bags are compostable in this game.",
    bin: "organic",
  },
];

const itemCount = document.getElementById("item-count");
const statusText = document.getElementById("status-text");
const trashEmoji = document.getElementById("trash-emoji");
const trashName = document.getElementById("trash-name");
const trashHint = document.getElementById("trash-hint");
const messagePanel = document.getElementById("message-panel");
const messageTitle = document.getElementById("message-title");
const messageBody = document.getElementById("message-body");
const restartButton = document.getElementById("restart-button");
const binButtons = [...document.querySelectorAll(".bin")];

let currentIndex = 0;
let isGameOver = false;
let deck = [];

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
  setBinsDisabled(true);
  statusText.textContent = "You win";
  showMessage("You cleaned up the whole park!", "Every item was sorted correctly. Press Restart to play again.", "win");
}

function handleLoss(correctBin) {
  isGameOver = true;
  setBinsDisabled(true);
  statusText.textContent = "You lose";
  showMessage("Wrong bin!", `That item belonged in ${correctBin}. Press Restart to try again.`, "lose");
}

function handleSelection(selectedBin) {
  if (isGameOver) {
    return;
  }

  const currentItem = deck[currentIndex];

  if (selectedBin !== currentItem.bin) {
    handleLoss(currentItem.bin);
    return;
  }

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
  deck = shuffle(items);
  currentIndex = 0;
  isGameOver = false;
  setBinsDisabled(false);
  showMessage("Ready?", "Sort all 8 items correctly to win.");
  renderCurrentItem();
}

binButtons.forEach((button) => {
  button.addEventListener("click", () => {
    handleSelection(button.dataset.bin);
  });
});

restartButton.addEventListener("click", restartGame);

restartGame();
