// game.js — Chess Muster

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

// ─── Algebraic notation ────────────────────────────────────────────────────

function toAlgebraic(board, move, color) {
  var piece = board[move.from.row][move.from.col];
  if (!piece) return "?";

  var files = ["a","b","c","d","e","f","g","h"];
  var toFile = files[move.to.col];
  var toRank = 8 - move.to.row;
  var fromFile = files[move.from.col];

  var notation = "";

  if (piece.type === "K") {
    notation = "K";
  } else if (piece.type === "Q") {
    notation = "Q";
  } else if (piece.type === "R") {
    notation = "R";
  } else if (piece.type === "B") {
    notation = "B";
  } else if (piece.type === "N") {
    notation = "N";
  } else if (piece.type === "P") {
    // Pawn
    var capture = board[move.to.row][move.to.col] || move.enPassant;
    if (capture) {
      notation = fromFile + "x" + toFile + toRank;
    } else {
      notation = toFile + toRank;
    }
    if (move.promoteTo) notation += "=" + move.promoteTo;
    return notation;
  }

  var capture = board[move.to.row][move.to.col];
  notation += (capture ? "x" : "") + toFile + toRank;
  return notation;
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
  selectedPieceIndex: null,
  placedPieceIndices: [],

  // Play phase
  board: null,
  turn: "white",
  enPassantTarget: null,
  selectedSquare: null,
  legalMovesCache: [],
  promotionPending: null,
  gameOver: false,
  aiThinking: false,

  // Move history
  history: [],       // [{board, enPassantTarget, move, notation, color}]
  historyIndex: -1,  // current position in history (-1 = initial)
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
  ["startScreen","buyScreen","placeScreen","playScreen"].forEach(function(s) {
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
  sideEls.forEach(function(el, i) { if (rows[i] !== undefined) el.textContent = 8 - rows[i]; });

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
  if (G.buySecondsLeft <= 10) el.classList.add("urgent");
  else el.classList.remove("urgent");
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
  var types = ["Q","R","B","N","P"];
  var names = { Q:"Queen", R:"Rook", B:"Bishop", N:"Knight", P:"Pawn" };

  types.forEach(function(t) {
    var cost = PRICES[t];
    var disabled = G.playerCoins < cost || G.playerPurchases.length >= 15;
    var item = document.createElement("div");
    item.className = "shop-item" + (disabled ? " disabled" : "");
    item.innerHTML =
      '<div class="shop-piece">' + pieceSVG(mkP(t, G.playerColor)) + '</div>' +
      '<div class="shop-name">' + names[t] + '</div>' +
      '<div class="shop-cost">' + cost + ' coins</div>' +
      '<button class="shop-btn"' + (disabled ? " disabled" : "") + '>Buy</button>';
    if (!disabled) {
      item.querySelector(".shop-btn").addEventListener("click", function() { buyPiece(t); });
    }
    shopEl.appendChild(item);
  });

  renderPurchaseList();
  document.getElementById("kingDisplay").innerHTML = pieceSVG(mkP("K", G.playerColor));
}

function buyPiece(type) {
  if (G.playerCoins < PRICES[type] || G.playerPurchases.length >= 15) return;
  G.playerCoins -= PRICES[type];
  G.playerPurchases.push(type);
  renderBuyUI();
}

function renderPurchaseList() {
  var el = document.getElementById("purchaseList");
  el.innerHTML = "";
  var kw = document.createElement("div");
  kw.className = "purchased-piece";
  kw.innerHTML = pieceSVG(mkP("K", G.playerColor));
  el.appendChild(kw);
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
  G.playerCoins += PRICES[G.playerPurchases[i]];
  G.playerPurchases.splice(i, 1);
  renderBuyUI();
}

function finishBuy() {
  clearInterval(G.buyTimerInterval);
  G.playerPieces = ["K"].concat(G.playerPurchases);
  G.aiPieces = ["K"].concat(aiBuy());
  G.board = initEmptyBoard();
  G.placedPieceIndices = [];
  G.selectedPieceIndex = null;
  G.placingColor = "white";
  showScreen("placeScreen");
  renderPlaceUI();
}

// ─── PLACE PHASE ───────────────────────────────────────────────────────────

function placedCountForColor(color) {
  var n = 0;
  for (var r = 0; r < 8; r++)
    for (var c = 0; c < 8; c++)
      if (G.board[r][c] && G.board[r][c].color === color) n++;
  return n;
}

function renderPlaceUI() {
  var isPlayer = G.placingColor === G.playerColor;
  var colorLabel = G.placingColor.charAt(0).toUpperCase() + G.placingColor.slice(1);

  document.getElementById("placeStatus").textContent = isPlayer
    ? "Your turn — drag a piece onto the board"
    : colorLabel + " (AI) is placing...";
  document.getElementById("nextPieceLabel").textContent = isPlayer ? "Drag to place" : "";

  renderPiecePanelAI();
  renderPlaceBoard(isPlayer);

  if (!isPlayer) setTimeout(function() { doAIPlacementOne(); }, 600);
}

function renderPiecePanelAI() {
  // Only show player's pieces when it's player's turn
  var panel = document.getElementById("placePiecePanel");
  if (!panel) return;
  panel.innerHTML = "";

  if (G.placingColor !== G.playerColor) return;

  G.playerPieces.forEach(function(type, i) {
    if (G.placedPieceIndices.indexOf(i) !== -1) return;

    var wrap = document.createElement("div");
    wrap.className = "place-piece-option";
    wrap.draggable = true;
    wrap.dataset.pieceIndex = i;
    wrap.innerHTML = pieceSVG(mkP(type, G.playerColor));

    wrap.addEventListener("dragstart", function(e) {
      G.selectedPieceIndex = i;
      wrap.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", i);
    });

    wrap.addEventListener("dragend", function() {
      wrap.classList.remove("dragging");
    });

    panel.appendChild(wrap);
  });
}

function renderPlaceBoard(interactive) {
  var el = document.getElementById("placeBoard");
  el.innerHTML = "";
  var validRows = G.placingColor === "white" ? [6, 7] : [0, 1];
  var rows = boardRows();
  var cols = boardCols();

  rows.forEach(function(r) {
    cols.forEach(function(c) {
      var sq = document.createElement("div");
      sq.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark");

      var p = G.board[r][c];
      if (p) sq.innerHTML = pieceSVG(p);

      if (interactive) {
        var isValid = validRows.indexOf(r) !== -1 && !p;

        if (isValid) {
          sq.addEventListener("dragover", function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            sq.classList.add("drop-target");
          });

          sq.addEventListener("dragleave", function() {
            sq.classList.remove("drop-target");
          });

          sq.addEventListener("drop", function(e) {
            e.preventDefault();
            sq.classList.remove("drop-target");
            if (G.selectedPieceIndex === null) return;
            placePlayerPiece(r, c);
          });
        }
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
  G.placedPieceIndices.push(G.selectedPieceIndex);
  G.selectedPieceIndex = null;
  advancePlacingTurn();
}

function doAIPlacementOne() {
  var pieces = G.aiPieces;
  var placed = placedCountForColor(G.aiColor);
  if (placed >= pieces.length) { advancePlacingTurn(); return; }

  var rows = G.aiColor === "black" ? [0,1] : [6,7];
  var empty = [];
  rows.forEach(function(r) {
    for (var c = 0; c < 8; c++) if (!G.board[r][c]) empty.push({row:r,col:c});
  });
  if (!empty.length) { advancePlacingTurn(); return; }

  var type = pieces[placed];
  var sq = empty[Math.floor(Math.random() * empty.length)];
  G.board[sq.row][sq.col] = mkP(type, G.aiColor);
  playSound("place");
  advancePlacingTurn();
}

function advancePlacingTurn() {
  var playerDone = placedCountForColor(G.playerColor) >= G.playerPieces.length;
  var aiDone = placedCountForColor(G.aiColor) >= G.aiPieces.length;

  if (playerDone && aiDone) { setTimeout(startPlay, 400); return; }

  var next = G.placingColor === "white" ? "black" : "white";
  var nextIsPlayer = next === G.playerColor;
  var nextTotal = nextIsPlayer ? G.playerPieces.length : G.aiPieces.length;
  var nextPlaced = placedCountForColor(next);

  G.placingColor = nextPlaced >= nextTotal ? G.placingColor : next;
  renderPlaceUI();
}

// ─── PLAY PHASE ────────────────────────────────────────────────────────────

function startPlay() {
  G.phase = "play";
  G.turn = "white";
  G.enPassantTarget = null;
  G.selectedSquare = null;
  G.gameOver = false;
  G.history = [];
  G.historyIndex = -1;

  // Save initial board state
  G.history.push({
    board: cloneBoard(G.board),
    enPassantTarget: null,
    notation: null,
    color: null
  });
  G.historyIndex = 0;

  showScreen("playScreen");
  updatePlayUI();
  if (G.aiColor === "white") setTimeout(doAIMove, 600);
}

function updatePlayUI() {
  var board = currentViewBoard();
  var ep = currentViewEP();
  var state = G.historyIndex === G.history.length - 1
    ? gameState(G.board, G.turn, G.enPassantTarget)
    : "normal";

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
      statusEl.textContent = (G.turn === G.playerColor ? "You are" : "AI is") + " in check!";
      playSound("check");
    } else {
      var whose = G.turn === G.playerColor ? "Your" : "AI's";
      statusEl.textContent = whose + " turn (" + G.turn + ")";
    }
  }

  renderPlayBoard();
  renderMoveList();
}

function currentViewBoard() {
  return G.history[G.historyIndex] ? G.history[G.historyIndex].board : G.board;
}

function currentViewEP() {
  return G.history[G.historyIndex] ? G.history[G.historyIndex].enPassantTarget : null;
}

function renderPlayBoard() {
  var el = document.getElementById("playBoard");
  el.innerHTML = "";

  var board = currentViewBoard();
  var ep = currentViewEP();
  var isLive = G.historyIndex === G.history.length - 1;

  var highlights = [];
  if (G.selectedSquare && isLive) {
    highlights = G.legalMovesCache.map(function(m) { return m.to.row * 8 + m.to.col; });
  }

  var checkedKing = null;
  if (isLive && inCheck(board, G.turn, ep)) {
    checkedKing = findKing(board, G.turn);
  }

  // Highlight last move
  var lastMoveSquares = [];
  if (G.historyIndex > 0 && G.history[G.historyIndex].move) {
    var lm = G.history[G.historyIndex].move;
    lastMoveSquares = [lm.from.row * 8 + lm.from.col, lm.to.row * 8 + lm.to.col];
  }

  var rows = boardRows();
  var cols = boardCols();

  rows.forEach(function(r) {
    cols.forEach(function(c) {
      var sq = document.createElement("div");
      sq.className = "square " + ((r + c) % 2 === 0 ? "light" : "dark");

      var p = board[r][c];
      if (p) sq.innerHTML = pieceSVG(p);

      if (lastMoveSquares.indexOf(r * 8 + c) !== -1) sq.classList.add("last-move");
      if (G.selectedSquare && G.selectedSquare.row === r && G.selectedSquare.col === c) sq.classList.add("selected");
      if (highlights.indexOf(r * 8 + c) !== -1) sq.classList.add(p ? "capture-hint" : "move-hint");
      if (checkedKing && checkedKing.row === r && checkedKing.col === c) sq.classList.add("in-check");

      if (isLive && !G.gameOver && !G.aiThinking) {
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
  if (G.historyIndex !== G.history.length - 1) {
    // Viewing history — jump to live
    navLast();
    return;
  }

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
    if (p && p.color === G.playerColor) { selectSquare(row, col); return; }
    G.selectedSquare = null;
    G.legalMovesCache = [];
    renderPlayBoard();
    return;
  }

  if (p && p.color === G.playerColor) selectSquare(row, col);
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
  var isCapture = !!G.board[move.to.row][move.to.col] || !!move.enPassant;
  var notation = toAlgebraic(G.board, move, G.turn);

  G.board = applyMove(G.board, move);
  G.enPassantTarget = move.doublePush ? getEnPassantTarget(move, piece) : null;

  // Save to history
  G.history.push({
    board: cloneBoard(G.board),
    enPassantTarget: G.enPassantTarget,
    move: move,
    notation: notation,
    color: G.turn
  });
  G.historyIndex = G.history.length - 1;

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
  if (!move) { G.aiThinking = false; updatePlayUI(); return; }

  var piece = G.board[move.from.row][move.from.col];
  var isCapture = !!G.board[move.to.row][move.to.col] || !!move.enPassant;
  if (move.promotion) move.promoteTo = "Q";
  var notation = toAlgebraic(G.board, move, G.turn);

  G.board = applyMove(G.board, move);
  G.enPassantTarget = move.doublePush ? getEnPassantTarget(move, piece) : null;

  G.history.push({
    board: cloneBoard(G.board),
    enPassantTarget: G.enPassantTarget,
    move: move,
    notation: notation,
    color: G.turn
  });
  G.historyIndex = G.history.length - 1;

  G.turn = G.turn === "white" ? "black" : "white";
  G.aiThinking = false;

  playSound(isCapture ? "capture" : "move");
  updatePlayUI();
}

// ─── Move list ─────────────────────────────────────────────────────────────

function renderMoveList() {
  var el = document.getElementById("moveList");
  el.innerHTML = "";

  // history[0] is initial board, moves start at index 1
  var moves = G.history.slice(1);
  var moveNum = 1;

  for (var i = 0; i < moves.length; i += 2) {
    var row = document.createElement("div");
    row.className = "move-row";

    var numEl = document.createElement("div");
    numEl.className = "move-num";
    numEl.textContent = moveNum + ".";
    row.appendChild(numEl);

    // White move (index i)
    var w = document.createElement("div");
    w.className = "move-cell";
    w.textContent = moves[i].notation || "";
    var wIdx = i + 1; // history index
    if (G.historyIndex === wIdx) w.classList.add("current");
    (function(idx) {
      w.addEventListener("click", function() { navTo(idx); });
    })(wIdx);
    row.appendChild(w);

    // Black move (index i+1)
    var b = document.createElement("div");
    b.className = "move-cell";
    if (moves[i + 1]) {
      b.textContent = moves[i + 1].notation || "";
      var bIdx = i + 2;
      if (G.historyIndex === bIdx) b.classList.add("current");
      (function(idx) {
        b.addEventListener("click", function() { navTo(idx); });
      })(bIdx);
    }
    row.appendChild(b);

    el.appendChild(row);
    moveNum++;
  }

  // Scroll to bottom
  el.scrollTop = el.scrollHeight;
}

// ─── Navigation ────────────────────────────────────────────────────────────

function navTo(idx) {
  if (idx < 0 || idx >= G.history.length) return;
  G.historyIndex = idx;
  G.selectedSquare = null;
  G.legalMovesCache = [];
  renderPlayBoard();
  renderMoveList();
}

function navFirst() { navTo(0); }
function navPrev()  { navTo(G.historyIndex - 1); }
function navNext()  { navTo(G.historyIndex + 1); }
function navLast()  { navTo(G.history.length - 1); }

// ─── Resign ────────────────────────────────────────────────────────────────

function resignGame() {
  if (G.gameOver) return;
  G.gameOver = true;
  var winner = G.playerColor === "white" ? "Black" : "White";
  document.getElementById("playStatus").textContent = "You resigned. " + winner + " wins!";
  playSound("checkmate");
  renderPlayBoard();
}

// ─── Captured / material ───────────────────────────────────────────────────

function renderCaptured() {
  var board = currentViewBoard();
  var w = 0, b = 0;
  for (var r = 0; r < 8; r++)
    for (var c = 0; c < 8; c++)
      if (board[r][c]) { if (board[r][c].color === "white") w++; else b++; }
  var wEl = document.getElementById("capturedWhite");
  var bEl = document.getElementById("capturedBlack");
  if (wEl) wEl.textContent = "White: " + w;
  if (bEl) bEl.textContent = "Black: " + b;
}

// ─── New game ──────────────────────────────────────────────────────────────

function newGame() {
  clearInterval(G.buyTimerInterval);
  G = {
    phase: "buy", playerColor: null, aiColor: null,
    playerCoins: 50, playerPurchases: [], buySecondsLeft: 60, buyTimerInterval: null,
    playerPieces: [], aiPieces: [], placingColor: null, placingIndex: 0,
    selectedPieceIndex: null, placedPieceIndices: [],
    board: null, turn: "white", enPassantTarget: null,
    selectedSquare: null, legalMovesCache: [], promotionPending: null,
    gameOver: false, aiThinking: false,
    history: [], historyIndex: -1,
  };
  showScreen("startScreen");
}
