// game.js — phase logic, UI binding, game flow for Chess Draft

// ─── State ─────────────────────────────────────────────────────────────────

var G = {
  phase: "buy",          // "buy" | "place" | "play"
  playerColor: null,     // "white" | "black" — randomly assigned
  aiColor: null,

  // Buy phase
  playerCoins: 50,
  playerPurchases: [],   // array of type strings (not including K)
  buySecondsLeft: 60,
  buyTimerInterval: null,

  // Place phase
  playerPieces: [],      // all pieces to place including K, as type strings
  aiPieces: [],
  placingColor: null,    // whose turn it is to place
  placingIndex: 0,       // index into current placer's pieces array
  selectedPlaceType: null,

  // Play phase
  board: null,
  turn: "white",
  enPassantTarget: null,
  selectedSquare: null,  // {row, col} or null
  legalMovesCache: [],
  promotionPending: null, // {move} waiting for promotion choice
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

function startBuyTimer() {
  clearInterval(G.buyTimerInterval);
  updateBuyTimerDisplay();

  G.buyTimerInterval = setInterval(function() {
    G.buySecondsLeft--;
    updateBuyTimerDisplay();

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
  // Fill remaining slots with pawns up to max 16 pieces
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

// ─── Screen management ─────────────────────────────────────────────────────

function showScreen(id) {
  ["startScreen", "buyScreen", "placeScreen", "playScreen"].forEach(function(s) {
    document.getElementById(s).style.display = "none";
  });
  document.getElementById(id).style.display = "flex";
}

// ─── BUY PHASE ─────────────────────────────────────────────────────────────

function renderBuyUI() {
  document.getElementById("coinCount").textContent = G.playerCoins;
  document.getElementById("pieceCount").textContent = G.playerPurchases.length + 1; // +1 for king

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

  // Show king (always free)
  document.getElementById("kingDisplay").innerHTML = pieceSVG(mkP("K", G.playerColor));

  var doneBtn = document.getElementById("buyDoneBtn");
  doneBtn.disabled = false;
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

  // King always first
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
  // AI buys
  var aiPurchased = aiBuy();

  G.playerPieces = ["K"].concat(G.playerPurchases);
  G.aiPieces = ["K"].concat(aiPurchased);

  G.board = initEmptyBoard();

  // Determine who places first (white always places first)
  G.placingColor = "white";
  G.placingIndex = 0;

  showScreen("placeScreen");
  renderPlaceUI();
}

// ─── PLACE PHASE ───────────────────────────────────────────────────────────

function currentPlacer() {
  return G.placingColor === G.playerColor ? "player" : "ai";
}

function currentPiecesToPlace() {
  return G.placingColor === G.playerColor ? G.playerPieces : G.aiPieces;
}

function placedCountForColor(color) {
  var count = 0;
  for (var r = 0; r < 8; r++)
    for (var c = 0; c < 8; c++)
      if (G.board[r][c] && G.board[r][c].color === color) count++;
  return count;
}

function boardRows() {
  // White: row 7 at bottom (index 7 last), Black: row 0 at bottom (index 0 last)
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
  // Update rank labels (side)
  var sideEls = document.querySelectorAll(".coord-side");
  var rows = boardRows();
  var ranks = rows.map(function(r) { return 8 - r; });
  sideEls.forEach(function(el, i) { if (ranks[i] !== undefined) el.textContent = ranks[i]; });

  // Update file labels (bottom)
  var fileEls = document.querySelectorAll(".coord");
  var cols = boardCols();
  var files = ["a","b","c","d","e","f","g","h"];
  fileEls.forEach(function(el, i) { if (cols[i] !== undefined) el.textContent = files[cols[i]]; });
}
  var pieces = currentPiecesToPlace();
  var placed = placedCountForColor(G.placingColor);
  var remaining = pieces.slice(placed);

  var isPlayer = currentPlacer() === "player";
  var colorLabel = G.placingColor.charAt(0).toUpperCase() + G.placingColor.slice(1);

  document.getElementById("placeStatus").textContent =
    isPlayer
      ? "Place your pieces — " + remaining.length + " remaining"
      : colorLabel + " (AI) is placing...";

  // Next piece to place
  var nextEl = document.getElementById("nextPieceDisplay");
  nextEl.innerHTML = "";
  if (isPlayer && remaining.length > 0) {
    nextEl.innerHTML = pieceSVG(mkP(remaining[0], G.placingColor));
    document.getElementById("nextPieceLabel").textContent = "Placing: " + remaining[0];
  } else {
    document.getElementById("nextPieceLabel").textContent = "";
  }

  renderPlaceBoard(isPlayer);

  // If it's AI's turn, trigger AI placement after short delay
  if (!isPlayer) {
    setTimeout(function() { doAIPlacement(); }, 600);
  }
}

function renderPlaceBoard(interactive) {
  var el = document.getElementById("placeBoard");
  el.innerHTML = "";

  var pieces = currentPiecesToPlace();
  var placed = placedCountForColor(G.placingColor);
  var validRows = G.placingColor === "white" ? [6, 7] : [0, 1];

  var rows = boardRows();
  var cols = boardCols();

  rows.forEach(function(r) {
    cols.forEach(function(c) {
      var sq = document.createElement("div");
      sq.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark");

      var p = G.board[r][c];
      if (p) sq.innerHTML = pieceSVG(p);

      var isValid = interactive && placed < pieces.length && validRows.indexOf(r) !== -1 && !G.board[r][c];
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
  var pieces = G.playerPieces;
  var placed = placedCountForColor(G.playerColor);
  if (placed >= pieces.length) return;

  var type = pieces[placed];
  G.board[row][col] = mkP(type, G.playerColor);

  var newPlaced = placedCountForColor(G.playerColor);
  if (newPlaced >= pieces.length) {
    // Player done placing — switch to other color or finish
    advancePlacingTurn();
  } else {
    renderPlaceUI();
  }
}

function doAIPlacement() {
  var pieces = G.aiPieces;
  var placed = placedCountForColor(G.aiColor);
  var rows = G.aiColor === "black" ? [0, 1] : [6, 7];

  // Find empty valid squares
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

  // Place one piece at a time with delay for visual effect
  var type = pieces[placed];
  var sq = empty[Math.floor(Math.random() * empty.length)];
  G.board[sq.row][sq.col] = mkP(type, G.aiColor);
  renderPlaceBoard(false);

  var newPlaced = placedCountForColor(G.aiColor);
  if (newPlaced >= pieces.length) {
    setTimeout(function() { advancePlacingTurn(); }, 400);
  } else {
    setTimeout(function() { doAIPlacement(); }, 400);
  }
}

function advancePlacingTurn() {
  // White places, then black places, then game starts
  if (G.placingColor === "white") {
    G.placingColor = "black";
    G.placingIndex = 0;
    renderPlaceUI();
  } else {
    // Both done — start game
    startPlay();
  }
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

  // If AI is white, it moves first
  if (G.aiColor === "white") {
    setTimeout(doAIMove, 600);
  }
}

function updatePlayUI() {
  var state = gameState(G.board, G.turn, G.enPassantTarget);
  var turnLabel = G.turn.charAt(0).toUpperCase() + G.turn.slice(1);

  var statusEl = document.getElementById("playStatus");
  if (G.gameOver) {
    // already set
  } else if (state === "checkmate") {
    var winner = G.turn === "white" ? "Black" : "White";
    statusEl.textContent = "Checkmate! " + winner + " wins!";
    G.gameOver = true;
  } else if (state === "stalemate") {
    statusEl.textContent = "Stalemate — draw!";
    G.gameOver = true;
  } else if (state === "check") {
    statusEl.textContent = turnLabel + " is in check!";
  } else {
    var whose = G.turn === G.playerColor ? "Your" : "AI's";
    statusEl.textContent = whose + " turn (" + turnLabel + ")";
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

  // If a square is already selected
  if (G.selectedSquare) {
    // Try to move
    var move = G.legalMovesCache.find(function(m) {
      return m.to.row === row && m.to.col === col;
    });

    if (move) {
      // Handle promotion
      if (move.promotion) {
        // Pick best promotion automatically unless multiple choices
        // Show promotion picker
        var promos = G.legalMovesCache.filter(function(m) {
          return m.to.row === row && m.to.col === col && m.promotion;
        });
        showPromotionPicker(promos);
        return;
      }
      executeMove(move);
      return;
    }

    // Clicked own piece — reselect
    if (p && p.color === G.playerColor) {
      selectSquare(row, col);
      return;
    }

    // Deselect
    G.selectedSquare = null;
    G.legalMovesCache = [];
    renderPlayBoard();
    return;
  }

  // Nothing selected — select own piece
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
  G.board = applyMove(G.board, move);
  G.enPassantTarget = move.doublePush ? getEnPassantTarget(move, piece) : null;
  G.selectedSquare = null;
  G.legalMovesCache = [];
  G.turn = G.turn === "white" ? "black" : "white";

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

  // AI always promotes to queen
  if (move.promotion) move.promoteTo = "Q";

  G.board = applyMove(G.board, move);
  G.enPassantTarget = move.doublePush ? getEnPassantTarget(move, piece) : null;
  G.turn = G.turn === "white" ? "black" : "white";
  G.aiThinking = false;

  updatePlayUI();
}

// ─── Captured pieces display ───────────────────────────────────────────────

function renderCaptured() {
  var allTypes = { white: [], black: [] };
  for (var r = 0; r < 8; r++)
    for (var c = 0; c < 8; c++)
      if (G.board[r][c]) allTypes[G.board[r][c].color].push(G.board[r][c].type);

  // We track what the player bought to infer captures
  // Simpler: just show all living pieces as material count
  var wEl = document.getElementById("capturedWhite");
  var bEl = document.getElementById("capturedBlack");
  if (wEl) wEl.textContent = "White pieces: " + allTypes.white.length;
  if (bEl) bEl.textContent = "Black pieces: " + allTypes.black.length;
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
    playerPieces: [],
    aiPieces: [],
    placingColor: null,
    placingIndex: 0,
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
