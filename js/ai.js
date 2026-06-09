// ai.js — AI logic for Chess Draft
// Phase 1: random buying within budget
// Phase 2: random placement on back two rows
// Phase 3: minimax with alpha-beta pruning

// ─── Phase 1: Buying ───────────────────────────────────────────────────────

// Randomly buy pieces within 50 coins, max 15 bought (+ king = 16)
function aiBuy() {
  var budget = 50;
  var maxBuy = 15;
  var bought = []; // does not include king
  var types = ["Q", "R", "B", "N", "P"];

  // Keep trying to add random pieces until we can't afford any or hit max
  var attempts = 0;
  while (bought.length < maxBuy && attempts < 500) {
    attempts++;
    var affordable = types.filter(function(t) { return PRICES[t] <= budget; });
    if (affordable.length === 0) break;
    var pick = affordable[Math.floor(Math.random() * affordable.length)];
    bought.push(pick);
    budget -= PRICES[pick];
  }

  return bought; // array of type strings, e.g. ["Q","R","N","P","P","P"]
}

// ─── Phase 2: Placement ────────────────────────────────────────────────────

// Place AI pieces randomly on its two back rows (rows 0 and 1 for black)
// pieces: array of type strings including "K"
// Returns board with AI pieces placed (white squares untouched)
function aiPlace(board, pieces, color) {
  var b = cloneBoard(board);
  var rows = color === "black" ? [0, 1] : [6, 7];

  // Collect empty squares in AI's rows
  var empty = [];
  rows.forEach(function(r) {
    for (var c = 0; c < 8; c++) {
      if (!b[r][c]) empty.push({ row: r, col: c });
    }
  });

  // Shuffle empty squares
  for (var i = empty.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = empty[i]; empty[i] = empty[j]; empty[j] = tmp;
  }

  // Place each piece on a random empty square
  pieces.forEach(function(type, i) {
    if (i < empty.length) {
      b[empty[i].row][empty[i].col] = mkP(type, color);
    }
  });

  return b;
}

// ─── Phase 3: Minimax ──────────────────────────────────────────────────────

// Piece values for evaluation
var PIECE_VALUE = { K: 10000, Q: 900, R: 500, B: 330, N: 320, P: 100 };

// Piece-square tables (from AI's perspective — flipped for white AI)
var PST = {
  P: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 25, 25, 10,  5,  5],
    [ 0,  0,  0, 20, 20,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-20,-20, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0]
  ],
  N: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ],
  B: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ],
  R: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0]
  ],
  Q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
  ],
  K: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20]
  ]
};

function getPSTValue(type, row, col, color) {
  var table = PST[type];
  if (!table) return 0;
  // Black uses table as-is (rows 0-7 = black's perspective from top)
  // White mirrors vertically
  var r = color === "black" ? row : 7 - row;
  return table[r][col];
}

// Static board evaluation (positive = good for black AI)
function evaluate(board) {
  var score = 0;
  for (var r = 0; r < 8; r++) {
    for (var c = 0; c < 8; c++) {
      var p = board[r][c];
      if (!p) continue;
      var val = PIECE_VALUE[p.type] + getPSTValue(p.type, r, c, p.color);
      score += p.color === "black" ? val : -val;
    }
  }
  return score;
}

// Minimax with alpha-beta pruning
// Returns { score, move }
function minimax(board, depth, alpha, beta, maximizing, enPassantTarget) {
  var color = maximizing ? "black" : "white";
  var state = gameState(board, color, enPassantTarget);

  if (state === "checkmate") return { score: maximizing ? -99999 : 99999, move: null };
  if (state === "stalemate") return { score: 0, move: null };
  if (depth === 0) return { score: evaluate(board), move: null };

  var moves = legalMoves(board, color, enPassantTarget);
  // Sort: captures first (improves alpha-beta pruning)
  moves.sort(function(a, b) {
    var capA = board[a.to.row][a.to.col] ? 1 : 0;
    var capB = board[b.to.row][b.to.col] ? 1 : 0;
    return capB - capA;
  });

  var bestMove = moves[0] || null;

  if (maximizing) {
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var piece = board[m.from.row][m.from.col];
      var nb = applyMove(board, m);
      var nextEP = m.doublePush ? getEnPassantTarget(m, piece) : null;
      var result = minimax(nb, depth - 1, alpha, beta, false, nextEP);
      if (result.score > best) { best = result.score; bestMove = m; }
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return { score: best, move: bestMove };
  } else {
    var best = Infinity;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var piece = board[m.from.row][m.from.col];
      var nb = applyMove(board, m);
      var nextEP = m.doublePush ? getEnPassantTarget(m, piece) : null;
      var result = minimax(nb, depth - 1, alpha, beta, true, nextEP);
      if (result.score < best) { best = result.score; bestMove = m; }
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return { score: best, move: bestMove };
  }
}

// Entry point: get the best move for the AI (black)
// depth 3 is reasonable for this kind of game
function aiBestMove(board, enPassantTarget) {
  var result = minimax(board, 3, -Infinity, Infinity, true, enPassantTarget);
  return result.move;
}
