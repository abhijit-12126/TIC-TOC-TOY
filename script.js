/**
 * ============================================================================
 * TIC-TAC-TOE • FUTURISTIC NEON GAMING JAVASCRIPT LOGIC
 * ============================================================================
 * Features:
 * - 2-Player alternating turns (X starts)
 * - 8 Winning combinations checked after each move
 * - Win and Draw detection with neon green highlight & animations
 * - Scoreboard tracking with animated count bumps
 * - Restart Game (clears board, retains scores)
 * - New Match (confirms via modal, resets board & scores)
 * - Full Keyboard accessibility (Enter/Space on cells) & ARIA updates
 * - Subtle Sci-Fi Web Audio sound feedback (Native, zero dependencies)
 */

'use strict';

/* ==========================================
   STATE & CONSTANTS
   ========================================== */

// Board representation as requested: 9 empty strings
let board = ["", "", "", "", "", "", "", "", ""];

// Starting player: can be 'X' (Cross) or 'O' (Zero / Circle)
let startingPlayer = "X";

// Active player: starts with the selected starting player
let currentPlayer = "X";

// Game activity flag to prevent clicks once game concludes
let isGameActive = true;

// Scoreboard tracking
const scores = {
  X: 0,
  O: 0,
  draws: 0
};

// All 8 possible winning combinations
const WINNING_COMBINATIONS = [
  [0, 1, 2], // Top row
  [3, 4, 5], // Middle row
  [6, 7, 8], // Bottom row
  [0, 3, 6], // Left column
  [1, 4, 7], // Middle column
  [2, 5, 8], // Right column
  [0, 4, 8], // Diagonal top-left to bottom-right
  [2, 4, 6]  // Diagonal top-right to bottom-left
];

/* ==========================================
   DOM ELEMENTS
   ========================================== */
const cells = document.querySelectorAll('.cell');
const statusPill = document.getElementById('statusPill');
const statusText = document.getElementById('statusText');

const scoreXElement = document.getElementById('scoreX');
const scoreOElement = document.getElementById('scoreO');
const scoreDrawsElement = document.getElementById('scoreDraws');

const btnRestart = document.getElementById('btnRestart');
const btnNewMatch = document.getElementById('btnNewMatch');

// Starting Player Selector Elements
const btnStartX = document.getElementById('btnStartX');
const btnStartO = document.getElementById('btnStartO');

// Confirmation Modal Elements
const confirmModal = document.getElementById('confirmModal');
const modalBtnCancel = document.getElementById('modalBtnCancel');
const modalBtnConfirm = document.getElementById('modalBtnConfirm');

/* ==========================================
   OPTIONAL NATIVE SYNTH AUDIO FX (WEB AUDIO API)
   ========================================== */
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
}

function playSound(type) {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (type === 'clickX') {
    // Crisp high synth blip for X (Cyan)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'clickO') {
    // Warm lower synth pulse for O (Magenta)
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  } else if (type === 'win') {
    // Ascending victory chord
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, now + i * 0.08);
      g.gain.setValueAtTime(0.1, now + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
      o.start(now + i * 0.08);
      o.stop(now + i * 0.08 + 0.35);
    });
  } else if (type === 'draw') {
    // Neutral futuristic chime
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(370, now + 0.25);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  }
}

/* ==========================================
   GAME INITIALIZATION
   ========================================== */

/**
 * Initializes event listeners and sets up the clean board.
 */
function initializeGame() {
  // Attach click and keyboard listeners to cells
  cells.forEach(cell => {
    cell.addEventListener('click', handleCellClick);
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCellClick(e);
      }
    });
  });

  // Starting player toggle listeners
  btnStartX.addEventListener('click', () => {
    initAudio();
    setStartingPlayer('X');
  });

  btnStartO.addEventListener('click', () => {
    initAudio();
    setStartingPlayer('O');
  });

  // Action button listeners
  btnRestart.addEventListener('click', () => {
    initAudio();
    restartGame();
  });

  btnNewMatch.addEventListener('click', () => {
    initAudio();
    openConfirmModal();
  });

  // Modal interaction listeners
  modalBtnCancel.addEventListener('click', closeConfirmModal);
  modalBtnConfirm.addEventListener('click', () => {
    closeConfirmModal();
    resetMatch();
  });

  // Close modal when pressing Escape or clicking backdrop
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !confirmModal.classList.contains('hidden')) {
      closeConfirmModal();
    }
  });

  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      closeConfirmModal();
    }
  });

  // Set initial status
  updateStatus("X's Turn", 'turn-x');
}

/* ==========================================
   TURN & CLICK HANDLER
   ========================================== */

/**
 * Handles cell selection by the active player.
 * @param {Event} event
 */
function handleCellClick(event) {
  initAudio();

  const cell = event.currentTarget;
  const index = parseInt(cell.getAttribute('data-index'), 10);

  // Validate: Ignore if cell is already occupied or if game has ended
  if (board[index] !== "" || !isGameActive) {
    return;
  }

  // Update game state
  board[index] = currentPlayer;

  // Render symbol with pop-in animation
  const symbolSpan = document.createElement('span');
  symbolSpan.className = 'symbol-anim';
  symbolSpan.textContent = currentPlayer;
  cell.appendChild(symbolSpan);

  // Apply player specific class & accessible attributes
  cell.classList.add('cell-filled', currentPlayer === 'X' ? 'cell-x' : 'cell-o');
  cell.setAttribute('aria-label', `Cell ${index + 1}, ${currentPlayer}`);
  cell.setAttribute('aria-disabled', 'true');

  // Play auditory feedback
  playSound(currentPlayer === 'X' ? 'clickX' : 'clickO');

  // Check for win condition
  const winningCombo = checkWinner();
  if (winningCombo) {
    endGame(currentPlayer, winningCombo);
    return;
  }

  // Check for draw condition
  if (checkDraw()) {
    endGame(null, null);
    return;
  }

  // Next player's turn
  switchPlayer();
}

/* ==========================================
   WIN / DRAW CHECKING LOGIC
   ========================================== */

/**
 * Checks all 8 winning combinations.
 * @returns {Array<number>|null} The winning combo indexes or null if no win.
 */
function checkWinner() {
  for (let i = 0; i < WINNING_COMBINATIONS.length; i++) {
    const [a, b, c] = WINNING_COMBINATIONS[i];
    if (board[a] !== "" && board[a] === board[b] && board[a] === board[c]) {
      return WINNING_COMBINATIONS[i];
    }
  }
  return null;
}

/**
 * Checks if all cells are filled without a winner.
 * @returns {boolean}
 */
function checkDraw() {
  return board.every(cell => cell !== "");
}

/* ==========================================
   PLAYER SWITCHING
   ========================================== */

/**
 * Switches the active player between X and O and updates status pill.
 */
function switchPlayer() {
  currentPlayer = currentPlayer === "X" ? "O" : "X";
  const pillClass = currentPlayer === "X" ? "turn-x" : "turn-o";
  updateStatus(`${currentPlayer}'s Turn`, pillClass);
}

/* ==========================================
   GAME CONCLUSION
   ========================================== */

/**
 * Finalizes the game when a player wins or a draw occurs.
 * @param {string|null} winner 'X', 'O', or null for draw
 * @param {Array<number>|null} winningCombo The 3 winning cell indexes
 */
function endGame(winner, winningCombo) {
  isGameActive = false;

  // Mark all cells as disabled for remaining interactions
  cells.forEach(cell => {
    cell.classList.add('disabled');
    cell.setAttribute('aria-disabled', 'true');
  });

  if (winner) {
    // Highlight winning cells with neon green glow
    winningCombo.forEach(index => {
      cells[index].classList.add('cell-winner');
    });

    // Update status and play victory sound
    updateStatus(`🏆 ${winner} Wins!`, 'status-win');
    updateScore(winner);
    playSound('win');
  } else {
    // Draw scenario
    updateStatus("🤝 It's a Draw!", 'status-draw');
    updateScore('draw');
    playSound('draw');
  }
}

/* ==========================================
   SCORE MANAGEMENT
   ========================================== */

/**
 * Increments the score and animates the corresponding scoreboard counter.
 * @param {string} result 'X', 'O', or 'draw'
 */
function updateScore(result) {
  if (result === 'X') {
    scores.X++;
    scoreXElement.textContent = scores.X;
    scoreXElement.setAttribute('aria-label', `Player X wins: ${scores.X}`);
    triggerScoreBump(scoreXElement);
  } else if (result === 'O') {
    scores.O++;
    scoreOElement.textContent = scores.O;
    scoreOElement.setAttribute('aria-label', `Player O wins: ${scores.O}`);
    triggerScoreBump(scoreOElement);
  } else if (result === 'draw') {
    scores.draws++;
    scoreDrawsElement.textContent = scores.draws;
    scoreDrawsElement.setAttribute('aria-label', `Total draws: ${scores.draws}`);
    triggerScoreBump(scoreDrawsElement);
  }
}

/**
 * Triggers a spring bump animation on score value element.
 * @param {HTMLElement} element
 */
function triggerScoreBump(element) {
  element.classList.remove('score-bump');
  // Trigger reflow to restart CSS animation
  void element.offsetWidth;
  element.classList.add('score-bump');
}

/* ==========================================
   STATUS PILL UPDATER
   ========================================== */

/**
 * Updates text and visual classes of the top glowing status pill.
 * @param {string} message Text to display
 * @param {string} typeClass Class for pill glow styling
 */
function updateStatus(message, typeClass) {
  statusText.textContent = message;
  statusPill.className = 'status-pill';
  if (typeClass) {
    statusPill.classList.add(typeClass);
  }
}

/* ==========================================
   RESTART & RESET ACTIONS
   ========================================== */

/**
 * Sets which player makes the first move (X or O).
 * @param {string} player 'X' or 'O'
 */
function setStartingPlayer(player) {
  startingPlayer = player;

  if (player === 'X') {
    btnStartX.classList.add('active-x');
    btnStartX.setAttribute('aria-checked', 'true');
    btnStartO.classList.remove('active-o');
    btnStartO.setAttribute('aria-checked', 'false');
  } else {
    btnStartO.classList.add('active-o');
    btnStartO.setAttribute('aria-checked', 'true');
    btnStartX.classList.remove('active-x');
    btnStartX.setAttribute('aria-checked', 'false');
  }

  // Restart board with newly chosen starting player
  restartGame();
}

/**
 * Clears the board, sets the selected starting player (X or O), removes highlights.
 * Preserves scoreboard statistics.
 */
function restartGame() {
  // Reset board array
  board = ["", "", "", "", "", "", "", "", ""];
  currentPlayer = startingPlayer;
  isGameActive = true;

  // Clear cells in DOM
  cells.forEach((cell, index) => {
    cell.innerHTML = "";
    cell.className = "cell";
    cell.setAttribute('aria-label', `Cell ${index + 1}, empty`);
    cell.removeAttribute('aria-disabled');
  });

  // Reset status pill according to chosen starting player
  const pillClass = startingPlayer === 'X' ? 'turn-x' : 'turn-o';
  updateStatus(`${startingPlayer}'s Turn`, pillClass);
}

/**
 * Resets the entire match including both board and scoreboard back to 0.
 */
function resetMatch() {
  restartGame();

  // Reset scores
  scores.X = 0;
  scores.O = 0;
  scores.draws = 0;

  // Update UI scoreboard
  scoreXElement.textContent = "0";
  scoreOElement.textContent = "0";
  scoreDrawsElement.textContent = "0";

  scoreXElement.setAttribute('aria-label', 'Player X wins: 0');
  scoreOElement.setAttribute('aria-label', 'Player O wins: 0');
  scoreDrawsElement.setAttribute('aria-label', 'Total draws: 0');

  triggerScoreBump(scoreXElement);
  triggerScoreBump(scoreOElement);
  triggerScoreBump(scoreDrawsElement);
}

/* ==========================================
   MODAL CONTROLS
   ========================================== */

function openConfirmModal() {
  confirmModal.classList.remove('hidden');
  modalBtnConfirm.focus();
}

function closeConfirmModal() {
  confirmModal.classList.add('hidden');
  btnNewMatch.focus();
}

/* ==========================================
   START APPLICATION
   ========================================== */
document.addEventListener('DOMContentLoaded', initializeGame);
