// game.js — phase logic, UI binding, game flow for Chess Muster

// ─── Audio ─────────────────────────────────────────────────────────────────

var AudioCtx = window.AudioContext || window.webkitAudioContext;
var audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playSound(type) {
  try {
    var ctx = getAudioCtx();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    var now = ctx.currentTime;

    if (type === "place") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);

    } else if (type === "move") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now); osc.stop(now + 0.12);

    } else if (type === "capture") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);

    } else if (type === "check") {
      osc.type = "square";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(660, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now); osc.stop(now + 0.25);

    } else if (type === "checkmate") {
      // Three descending tones
      [0, 0.18, 0.36].forEach(function(offset, i) {
        var o2 = ctx.createOscillator();
        var g2 = ctx.createGain();
        o2.connect(g2); g2.connect(ctx.destination);
        o2.type = "sine";
        o2.frequency.setValueAtTime([660, 520, 380][i], now + offset);
        g2.gain.setValueAtTime(0.2, now + offset);
        g2.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.25);
        o2.start(now + offset); o2.stop(now + offset + 0.25);
      });
      return;

    } else if (type === "tick") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now); osc.stop(now + 0.05);
    }
  } catch(e) {}
}

// ─── State ─────────────────────────────────────────────────────────────────

var G = {
  phase: "buy",
  playerColor: null,
  aiColor: null,

  // Buy phase
  playerCoins: 50,
  playerPurchases: [],
  buySecondsLeft: 60,
  buyTimerInterval: null,

  // Place phase
  playerPieces: [],
  aiPieces: [],
  placingColor: null,
  placingIndex: 0,
  selectedPieceIndex: null, // index into playerPieces the player has selected
  selectedPlaceType: null,

  // Play phase
  board: null,
  turn: "white",
  enPassantTarget: null,
  selectedSquare: null,
  legalMovesCache: [],
  promotionPending: null,
  gameOver: false,
  aiThinking: false,
};

// ─── Init ──────────────────────────────────────────────────────────────────

function init() {
  showScreen("startScreen");
}

function startVsAI() {
  G.playerColor = Math.random() < 0.5 ? "white" : "black";
  G.aiColor = G.playerColor === "white" ? "black" : "white";
  G.buySecondsLeft = 60;

  showScreen("buyScreen");
  renderBuyUI();
  startBuyTimer();
}

// ─── Screen management ─────────────────────────────────────────────────────

function showScreen(id) {
  ["startScreen", "buyScreen", "placeScreen", "playScreen"].forEach(function(s) {
    document.getElementById(s).style.display = "none";
  });
  document.getElementById(id).style.display = "flex";
}

// ─── Board orientation ─────────────────────────────────────────────────────

function boardRows() {
  var rows = [];
  if (G.playerColor === "white") {
    for (var r = 0; r < 8; r++) rows.push(r);
  } else {
    for (var r = 7; r >= 0; r--) rows.push(r);
  }
  return rows;
}

function boardCols() {
  var cols = [];
  if (G.playerColor === "white") {
    for (var c = 0; c < 8; c++) cols.push(c);
  } else {
    for (var c = 7; c >= 0; c--) cols.push(c);
  }
  return cols;
}

function updateCoords() {
  var sideEls = document.querySelectorAll(".coord-side");
  var rows = boardRows();
  var ranks = rows.map(function(r) { return 8 - r; });
  sideEls.forEach(function(el, i) { if (ranks[i] !== undefined) el.textContent = ranks[i]; });

  var fileEls = document.querySelectorAll(".coord");
  var cols = boardCols();
  var files = ["a","b","c","d","e","f","g","h"];
  fileEls.forEach(function(el, i) { if (cols[i] !== undefined) el.textContent = files[cols[i]]; });
}

// ─── BUY PHASE ─────────────────────────────────────────────────────────────

function startBuyTimer() {
  clearInterval(G.buyTimerInterval);
  updateBuyTimerDisplay();

  G.buyTimerInterval = setInterval(function() {
    G.buySecondsLeft--;
    updateBuyTimerDisplay();
    if (G.buySecondsLeft <= 10) playSound("tick");
    if (G.buySecondsLeft <= 0) {
      clearInterval(G.buyTimerInterval);
      autoBuyRemaining();
    }
  }, 1000);
}

function updateBuyTimerDisplay() {
  var el = document.getElementById("buyTimer");
  if (!el) return;
  el.textContent = G.buySecondsLeft;
  if (G.buySecondsLeft <= 10) {
    el.classList.add("urgent");
  } else {
    el.classList.remove("urgent");
  }
}

function autoBuyRemaining() {
  var maxCanBuy = 15 - G.playerPurchases.length;
  var canAfford = Math.floor(G.playerCoins / PRICES["P"]);
  var toBuy = Math.min(maxCanBuy, canAfford);
  for (var i = 0; i < toBuy; i++) {
    G.playerPurchases.push("P");
    G.playerCoins -= PRICES["P"];
  }
  renderBuyUI();
  setTimeout(function() { finishBuy(); }, 800);
}

function renderBuyUI() {
  document.getElementById("coinCount").textContent = G.playerCoins;
  document.getElementById("pieceCount").textContent = (G.playerPurchases.length + 1) + " / 16";

  var shopEl = document.getElementById("shopItems");
  shopEl.innerHTML = "";

  var types = ["Q", "R", "B", "N", "P"];
  var names = { Q: "Queen", R: "Rook", B: "Bishop", N: "Knight", P: "Pawn" };

  types.forEach(function(t) {
    var cost = PRICES[t];
    var canAfford = G.playerCoins >= cost;
    var atMax = G.playerPurchases.length >= 15;
    var disabled = !canAfford || atMax;

    var item = document.createElement("div");
    item.className = "shop-item" + (disabled ? " disabled" : "");
    item.innerHTML =
      '<div class="shop-piece">' + pieceSVG(mkP(t, G.playerColor)) + '</div>' +
      '<div class="shop-name">' + names[t] + '</div>' +
      '<div class="shop-cost">' + cost + ' coins</div>' +
      '<button class="shop-btn"' + (disabled ? " disabled" : "") + '>Buy</button>';

    if (!disabled) {
      item.querySelector(".shop-btn").addEventListener("click", function() {
        buyPiece(t);
      });
    }
    shopEl.appendChild(item);
  });

  renderPurchaseList();
  document.getElementById("kingDisplay").innerHTML = pieceSVG(mkP("K", G.playerColor));
}

function buyPiece(type) {
  var cost = PRICES[type];
  if (G.playerCoins < cost || G.playerPurchases.length >= 15) return;
  G.playerCoins -= cost;
  G.playerPurchases.push(type);
  renderBuyUI();
}

function renderPurchaseList() {
  var el = document.getElementById("purchaseList");
  el.innerHTML = "";

  var kingWrap = document.createElement("div");
  kingWrap.className = "purchased-piece";
  kingWrap.innerHTML = pieceSVG(mkP("K", G.playerColor));
  el.appendChild(kingWrap);

  G.playerPurchases.forEach(function(t, i) {
    var wrap = document.createElement("div");
    wrap.className = "purchased-piece";
    wrap.innerHTML = pieceSVG(mkP(t, G.playerColor));
    wrap.title = "Click to remove";
    wrap.addEventListener("click", function() { removePurchase(i); });
    el.appendChild(wrap);
  });
}

function removePurchase(i) {
  var type = G.playerPurchases[i];
  G.playerCoins += PRICES[type];
  G.playerPurchases.splice(i, 1);
  renderBuyUI();
}

function finishBuy() {
  clearInterval(G.buyTimerInterval);

  var aiPurchased = aiBuy();
  G.playerPieces = ["K"].concat(G.playerPurchases);
  G.aiPieces = ["K"].concat(aiPurchased);
  G.board = initEmptyBoard();
  G.placedPieceIndices = [];
  G.selectedPieceIndex = null;

  // White always places first
  G.placingColor = "white";
  G.placingIndex = 0;

  showScreen("placeScreen");
  renderPlaceUI();
}

// ─── PLACE PHASE ───────────────────────────────────────────────────────────
// Alternating: white places 1, black places 1, white places 1, ...

function placedCountForColor(color) {
  var count = 0;
  for (var r = 0; r < 8; r++)
    for (var c = 0; c < 8; c++)
      if (G.board[r][c] && G.board[r][c].color === color) count++;
  return count;
}

function renderPlaceUI() {
  var isPlayer = G.placingColor === G.playerColor;
  var placed = placedCountForColor(G.placingColor);
  var pieces = isPlayer ? G.playerPieces : G.aiPieces;
  var remaining = pieces.length - placed;
  var colorLabel = G.placingColor.charAt(0).toUpperCase() + G.placingColor.slice(1);

  document.getElementById("placeStatus").textContent =
    isPlayer
      ? "Your turn — select a piece, then click a square"
      : colorLabel + " (AI) is placing...";

  // Show player's unplaced pieces as selectable icons
  var nextEl = document.getElementById("nextPieceDisplay");
  nextEl.innerHTML = "";
  document.getElementById("nextPieceLabel").textContent = "";

  if (isPlayer) {
    // Build list of unplaced pieces with their original indices
    var unplaced = [];
    var placedSoFar = {};
    G.playerPieces.forEach(function(type, i) {
      var key = type + "_" + i;
      if (!G.placedPieceIndices || G.placedPieceIndices.indexOf(i) === -1) {
        unplaced.push({ type: type, index: i });
      }
    });

    unplaced.forEach(function(item) {
      var wrap = document.createElement("div");
      wrap.className = "place-piece-option" + (G.selectedPieceIndex === item.index ? " selected-piece" : "");
      wrap.innerHTML = pieceSVG(mkP(item.type, G.playerColor));
      wrap.addEventListener("click", function() {
        G.selectedPieceIndex = item.index;
        renderPlaceUI();
      });
      nextEl.appendChild(wrap);
    });

    if (G.selectedPieceIndex !== null) {
      var selType = G.playerPieces[G.selectedPieceIndex];
      document.getElementById("nextPieceLabel").textContent = "Click a green square to place";
    } else {
      document.getElementById("nextPieceLabel").textContent = "Select a piece above";
    }
  }

  renderPlaceBoard(isPlayer);

  if (!isPlayer) {
    setTimeout(function() { doAIPlacementOne(); }, 600);
  }
}

function renderPlaceBoard(interactive) {
  var el = document.getElementById("placeBoard");
  el.innerHTML = "";

  var validRows = G.placingColor === "white" ? [6, 7] : [0, 1];
  var hasSelection = interactive && G.selectedPieceIndex !== null;

  var rows = boardRows();
  var cols = boardCols();

  rows.forEach(function(r) {
    cols.forEach(function(c) {
      var sq = document.createElement("div");
      sq.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark");

      var p = G.board[r][c];
      if (p) sq.innerHTML = pieceSVG(p);

      var isValid = hasSelection && validRows.indexOf(r) !== -1 && !G.board[r][c];
      if (isValid) {
        sq.classList.add("valid-place");
        (function(row, col) {
          sq.addEventListener("click", function() { placePlayerPiece(row, col); });
        })(r, c);
      }

      el.appendChild(sq);
    });
  });

  updateCoords();
}

function placePlayerPiece(row, col) {
  if (G.selectedPieceIndex === null) return;

  var type = G.playerPieces[G.selectedPieceIndex];
  G.board[row][col] = mkP(type, G.playerColor);
  playSound("place");

  // Track placed indices
  if (!G.placedPieceIndices) G.placedPieceIndices = [];
  G.placedPieceIndices.push(G.selectedPieceIndex);
  G.selectedPieceIndex = null;

  advancePlacingTurn();
}

function doAIPlacementOne() {
  var pieces = G.aiPieces;
  var placed = placedCountForColor(G.aiColor);
  var rows = G.aiColor === "black" ? [0, 1] : [6, 7];

  var empty = [];
  rows.forEach(function(r) {
    for (var c = 0; c < 8; c++) {
      if (!G.board[r][c]) empty.push({ row: r, col: c });
    }
  });

  if (empty.length === 0 || placed >= pieces.length) {
    advancePlacingTurn();
    return;
  }

  var type = pieces[placed];
  var sq = empty[Math.floor(Math.random() * empty.length)];
  G.board[sq.row][sq.col] = mkP(type, G.aiColor);
  playSound("place");

  advancePlacingTurn();
}

function advancePlacingTurn() {
  var totalPlayerPlaced = placedCountForColor(G.playerColor);
  var totalAIPlaced = placedCountForColor(G.aiColor);
  var playerDone = totalPlayerPlaced >= G.playerPieces.length;
  var aiDone = totalAIPlaced >= G.aiPieces.length;

  if (playerDone && aiDone) {
    setTimeout(function() { startPlay(); }, 400);
    return;
  }

  // Switch to other color, skip if that color is done
  var next = G.placingColor === "white" ? "black" : "white";
  var nextIsPlayer = next === G.playerColor;
  var nextPlaced = placedCountForColor(next);
  var nextTotal = nextIsPlayer ? G.playerPieces.length : G.aiPieces.length;

  if (nextPlaced >= nextTotal) {
    // Other color done, stay with current
  } else {
    G.placingColor = next;
  }

  renderPlaceUI();
}

// ─── PLAY PHASE ─────────────────────────────────────────────────────────────

function startPlay() {
  G.phase = "play";
  G.turn = "white";
  G.enPassantTarget = null;
  G.selectedSquare = null;
  G.gameOver = false;

  showScreen("playScreen");
  updatePlayUI();

  if (G.aiColor === "white") {
    setTimeout(doAIMove, 600);
  }
}

function updatePlayUI() {
  var state = gameState(G.board, G.turn, G.enPassantTarget);
  var turnLabel = G.turn.charAt(0).toUpperCase() + G.turn.slice(1);
  var statusEl = document.getElementById("playStatus");

  if (!G.gameOver) {
    if (state === "checkmate") {
      var winner = G.turn === "white" ? "Black" : "White";
      statusEl.textContent = "Checkmate! " + winner + " wins!";
      G.gameOver = true;
      playSound("checkmate");
    } else if (state === "stalemate") {
      statusEl.textContent = "Stalemate — draw!";
      G.gameOver = true;
    } else if (state === "check") {
      statusEl.textContent = turnLabel + " is in check!";
      playSound("check");
    } else {
      var whose = G.turn === G.playerColor ? "Your" : "AI's";
      statusEl.textContent = whose + " turn (" + turnLabel + ")";
    }
  }

  renderPlayBoard();
}

function renderPlayBoard() {
  var el = document.getElementById("playBoard");
  el.innerHTML = "";

  var highlights = [];
  if (G.selectedSquare) {
    highlights = G.legalMovesCache.map(function(m) {
      return m.to.row * 8 + m.to.col;
    });
  }

  var checkedKing = null;
  if (inCheck(G.board, G.turn, G.enPassantTarget)) {
    checkedKing = findKing(G.board, G.turn);
  }

  var rows = boardRows();
  var cols = boardCols();

  rows.forEach(function(r) {
    cols.forEach(function(c) {
      var sq = document.createElement("div");
      sq.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark");

      var p = G.board[r][c];
      if (p) sq.innerHTML = pieceSVG(p);

      if (G.selectedSquare && G.selectedSquare.row === r && G.selectedSquare.col === c) {
        sq.classList.add("selected");
      }

      if (highlights.indexOf(r * 8 + c) !== -1) {
        sq.classList.add(p ? "capture-hint" : "move-hint");
      }

      if (checkedKing && checkedKing.row === r && checkedKing.col === c) {
        sq.classList.add("in-check");
      }

      if (!G.gameOver && !G.aiThinking) {
        (function(row, col) {
          sq.addEventListener("click", function() { handleSquareClick(row, col); });
        })(r, c);
      }

      el.appendChild(sq);
    });
  });

  updateCoords();
  renderCaptured();
}

function handleSquareClick(row, col) {
  if (G.gameOver || G.aiThinking) return;
  if (G.turn !== G.playerColor) return;
  if (G.promotionPending) return;

  var p = G.board[row][col];

  if (G.selectedSquare) {
    var move = G.legalMovesCache.find(function(m) {
      return m.to.row === row && m.to.col === col;
    });

    if (move) {
      if (move.promotion) {
        var promos = G.legalMovesCache.filter(function(m) {
          return m.to.row === row && m.to.col === col && m.promotion;
        });
        showPromotionPicker(promos);
        return;
      }
      executeMove(move);
      return;
    }

    if (p && p.color === G.playerColor) {
      selectSquare(row, col);
      return;
    }

    G.selectedSquare = null;
    G.legalMovesCache = [];
    renderPlayBoard();
    return;
  }

  if (p && p.color === G.playerColor) {
    selectSquare(row, col);
  }
}

function selectSquare(row, col) {
  G.selectedSquare = { row: row, col: col };
  G.legalMovesCache = legalMovesForPiece(G.board, row, col, G.enPassantTarget);
  renderPlayBoard();
}

function showPromotionPicker(moves) {
  G.promotionPending = moves;
  var el = document.getElementById("promotionPicker");
  el.innerHTML = "";
  el.style.display = "flex";

  moves.forEach(function(m) {
    var btn = document.createElement("div");
    btn.className = "promo-piece";
    btn.innerHTML = pieceSVG(mkP(m.promoteTo, G.playerColor));
    btn.addEventListener("click", function() {
      el.style.display = "none";
      G.promotionPending = null;
      executeMove(m);
    });
    el.appendChild(btn);
  });
}

function executeMove(move) {
  var piece = G.board[move.from.row][move.from.col];
  var isCapture = !!G.board[move.to.row][move.to.col] || move.enPassant;

  G.board = applyMove(G.board, move);
  G.enPassantTarget = move.doublePush ? getEnPassantTarget(move, piece) : null;
  G.selectedSquare = null;
  G.legalMovesCache = [];
  G.turn = G.turn === "white" ? "black" : "white";

  playSound(isCapture ? "capture" : "move");
  updatePlayUI();

  if (!G.gameOver && G.turn === G.aiColor) {
    G.aiThinking = true;
    setTimeout(doAIMove, 500);
  }
}

function doAIMove() {
  var move = aiBestMove(G.board, G.enPassantTarget);
  if (!move) {
    G.aiThinking = false;
    updatePlayUI();
    return;
  }

  var piece = G.board[move.from.row][move.from.col];
  var isCapture = !!G.board[move.to.row][move.to.col] || move.enPassant;
  if (move.promotion) move.promoteTo = "Q";

  G.board = applyMove(G.board, move);
  G.enPassantTarget = move.doublePush ? getEnPassantTarget(move, piece) : null;
  G.turn = G.turn === "white" ? "black" : "white";
  G.aiThinking = false;

  playSound(isCapture ? "capture" : "move");
  updatePlayUI();
}

// ─── Captured pieces display ───────────────────────────────────────────────

function renderCaptured() {
  var allTypes = { white: [], black: [] };
  for (var r = 0; r < 8; r++)
    for (var c = 0; c < 8; c++)
      if (G.board[r][c]) allTypes[G.board[r][c].color].push(G.board[r][c].type);

  var wEl = document.getElementById("capturedWhite");
  var bEl = document.getElementById("capturedBlack");
  if (wEl) wEl.textContent = "White: " + allTypes.white.length + " pieces";
  if (bEl) bEl.textContent = "Black: " + allTypes.black.length + " pieces";
}

// ─── New game ──────────────────────────────────────────────────────────────

function newGame() {
  clearInterval(G.buyTimerInterval);
  G = {
    phase: "buy",
    playerColor: null,
    aiColor: null,
    playerCoins: 50,
    playerPurchases: [],
    buySecondsLeft: 60,
    buyTimerInterval: null,
    playerPieces: [],
    aiPieces: [],
    placingColor: null,
    placingIndex: 0,
    selectedPieceIndex: null,
    placedPieceIndices: [],
    selectedPlaceType: null,
    board: null,
    turn: "white",
    enPassantTarget: null,
    selectedSquare: null,
    legalMovesCache: [],
    promotionPending: null,
    gameOver: false,
    aiThinking: false,
  };
  showScreen("startScreen");
}
