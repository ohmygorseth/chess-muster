// chess.js — complete chess rule enforcement for Chess Muster
// No castling. En passant OK. Promotion OK.
// Double-step only on pawn's first move from placed square.

// ─── Pseudo-legal move generation ─────────────────────────────────────────

function pseudoMoves(board, row, col, enPassantTarget) {
  var p = board[row][col];
  if (!p) return [];
  var moves = [];
  var t = p.type;
  var color = p.color;
  var dir = color === "white" ? -1 : 1;

  if (t === "P") {
    var nr = row + dir;

    // Single step
    if (nr >= 0 && nr < 8 && !board[nr][col]) {
      moves.push({ from: {row:row,col:col}, to: {row:nr,col:col}, doublePush:false, enPassant:false });

      // Double step — only if pawn has never moved
      if (!p.hasMoved) {
        var nr2 = row + dir * 2;
        if (nr2 >= 0 && nr2 < 8 && !board[nr2][col]) {
          moves.push({ from: {row:row,col:col}, to: {row:nr2,col:col}, doublePush:true, enPassant:false });
        }
      }
    }

    // Diagonal captures
    if (nr >= 0 && nr < 8) {
      [-1, 1].forEach(function(dc) {
        var nc = col + dc;
        if (nc >= 0 && nc < 8) {
          var target = board[nr][nc];
          if (target && target.color !== color) {
            moves.push({ from: {row:row,col:col}, to: {row:nr,col:nc}, doublePush:false, enPassant:false });
          }
          // En passant
          if (enPassantTarget && nr === enPassantTarget.row && nc === enPassantTarget.col) {
            moves.push({ from: {row:row,col:col}, to: {row:nr,col:nc}, doublePush:false, enPassant:true });
          }
        }
      });
    }

  } else if (t === "N") {
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(function(d) {
      var nr = row + d[0], nc = col + d[1];
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        var target = board[nr][nc];
        if (!target || target.color !== color) {
          moves.push({ from: {row:row,col:col}, to: {row:nr,col:nc} });
        }
      }
    });

  } else if (t === "K") {
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(function(d) {
      var nr = row + d[0], nc = col + d[1];
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        var target = board[nr][nc];
        if (!target || target.color !== color) {
          moves.push({ from: {row:row,col:col}, to: {row:nr,col:nc} });
        }
      }
    });

  } else {
    // Sliding: Q, R, B
    var dirs = [];
    if (t === "R" || t === "Q") dirs = dirs.concat([[-1,0],[1,0],[0,-1],[0,1]]);
    if (t === "B" || t === "Q") dirs = dirs.concat([[-1,-1],[-1,1],[1,-1],[1,1]]);

    dirs.forEach(function(d) {
      var nr = row + d[0], nc = col + d[1];
      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        var target = board[nr][nc];
        if (target) {
          if (target.color !== color) {
            moves.push({ from: {row:row,col:col}, to: {row:nr,col:nc} });
          }
          break;
        }
        moves.push({ from: {row:row,col:col}, to: {row:nr,col:nc} });
        nr += d[0]; nc += d[1];
      }
    });
  }

  return moves;
}

// ─── Apply move ────────────────────────────────────────────────────────────

function applyMove(board, move) {
  var b = cloneBoard(board);
  var p = b[move.from.row][move.from.col];
  var piece = { type: p.type, color: p.color, hasMoved: true };

  // En passant: remove captured pawn
  if (move.enPassant) {
    b[move.from.row][move.to.col] = null;
  }

  // Promotion
  if (move.promoteTo) {
    piece.type = move.promoteTo;
  }

  b[move.to.row][move.to.col] = piece;
  b[move.from.row][move.from.col] = null;
  return b;
}

// ─── Check detection ───────────────────────────────────────────────────────

function isSquareAttacked(board, row, col, byColor) {
  for (var r = 0; r < 8; r++) {
    for (var c = 0; c < 8; c++) {
      var p = board[r][c];
      if (!p || p.color !== byColor) continue;
      var moves = pseudoMoves(board, r, c, null);
      for (var i = 0; i < moves.length; i++) {
        if (moves[i].to.row === row && moves[i].to.col === col) return true;
      }
    }
  }
  return false;
}

function inCheck(board, color, enPassantTarget) {
  var king = findKing(board, color);
  if (!king) return true; // King missing = in check (illegal state)
  var opponent = color === "white" ? "black" : "white";
  return isSquareAttacked(board, king.row, king.col, opponent);
}

// ─── Legal moves ───────────────────────────────────────────────────────────

function legalMoves(board, color, enPassantTarget) {
  var moves = [];
  var opponent = color === "white" ? "black" : "white";
  var promotionRow = color === "white" ? 0 : 7;

  for (var r = 0; r < 8; r++) {
    for (var c = 0; c < 8; c++) {
      var p = board[r][c];
      if (!p || p.color !== color) continue;

      var pm = pseudoMoves(board, r, c, enPassantTarget);

      pm.forEach(function(move) {
        // Expand promotions
        if (p.type === "P" && move.to.row === promotionRow) {
          ["Q", "R", "B", "N"].forEach(function(pt) {
            var m2 = Object.assign({}, move, { promoteTo: pt, promotion: true });
            var nb = applyMove(board, m2);
            if (!inCheck(nb, color, null)) moves.push(m2);
          });
        } else {
          var nb = applyMove(board, move);
          var nextEP = move.doublePush ? getEnPassantTarget(move, p) : null;
          if (!inCheck(nb, color, nextEP)) moves.push(move);
        }
      });
    }
  }
  return moves;
}

function legalMovesForPiece(board, row, col, enPassantTarget) {
  var p = board[row][col];
  if (!p) return [];
  var all = legalMoves(board, p.color, enPassantTarget);
  return all.filter(function(m) { return m.from.row === row && m.from.col === col; });
}

// ─── Game state ────────────────────────────────────────────────────────────

function gameState(board, color, enPassantTarget) {
  // King missing = immediate loss
  var king = findKing(board, color);
  if (!king) return "checkmate";

  var moves = legalMoves(board, color, enPassantTarget);
  var checked = inCheck(board, color, enPassantTarget);

  if (moves.length === 0) return checked ? "checkmate" : "stalemate";
  return checked ? "check" : "normal";
}

// ─── En passant target ─────────────────────────────────────────────────────

function getEnPassantTarget(move, piece) {
  if (piece.type === "P" && move.doublePush) {
    var dir = piece.color === "white" ? 1 : -1;
    return { row: move.to.row + dir, col: move.to.col };
  }
  return null;
}
