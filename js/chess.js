// chess.js — move generation and rule enforcement for Chess Draft
// No castling. En passant OK. Pawn promotion OK.
// Double-step allowed only on pawn's first move from placed square.

// Returns all pseudo-legal moves for a piece at (row, col)
// enPassantTarget: {row, col} or null — the square a pawn can capture en passant
function pseudoMoves(board, row, col, enPassantTarget) {
  var p = board[row][col];
  if (!p) return [];
  var moves = [];
  var t = p.type;
  var color = p.color;
  var dir = color === "white" ? -1 : 1; // white moves up (decreasing row), black down

  if (t === "P") {
    // Single step forward
    var nr = row + dir;
    if (nr >= 0 && nr < 8 && !board[nr][col]) {
      moves.push({ from: { row: row, col: col }, to: { row: nr, col: col }, promotion: false });

      // Double step — only if pawn has never moved
      if (!p.hasMoved) {
        var nr2 = row + dir * 2;
        if (nr2 >= 0 && nr2 < 8 && !board[nr2][col]) {
          moves.push({ from: { row: row, col: col }, to: { row: nr2, col: col }, promotion: false, doublePush: true });
        }
      }
    }

    // Captures (diagonal)
    [-1, 1].forEach(function(dc) {
      var nc = col + dc;
      if (nc >= 0 && nc < 8) {
        var target = board[nr] && board[nr][nc];
        if (target && target.color !== color) {
          moves.push({ from: { row: row, col: col }, to: { row: nr, col: nc }, promotion: false });
        }
        // En passant
        if (enPassantTarget && nr === enPassantTarget.row && nc === enPassantTarget.col) {
          moves.push({ from: { row: row, col: col }, to: { row: nr, col: nc }, enPassant: true, promotion: false });
        }
      }
    });

  } else if (t === "N") {
    var knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    knightMoves.forEach(function(d) {
      var nr = row + d[0], nc = col + d[1];
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        var target = board[nr][nc];
        if (!target || target.color !== color) {
          moves.push({ from: { row: row, col: col }, to: { row: nr, col: nc } });
        }
      }
    });

  } else if (t === "K") {
    var kingMoves = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    kingMoves.forEach(function(d) {
      var nr = row + d[0], nc = col + d[1];
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        var target = board[nr][nc];
        if (!target || target.color !== color) {
          moves.push({ from: { row: row, col: col }, to: { row: nr, col: nc } });
        }
      }
    });

  } else {
    // Sliding pieces: Q, R, B
    var dirs = [];
    if (t === "R" || t === "Q") dirs = dirs.concat([[-1,0],[1,0],[0,-1],[0,1]]);
    if (t === "B" || t === "Q") dirs = dirs.concat([[-1,-1],[-1,1],[1,-1],[1,1]]);

    dirs.forEach(function(d) {
      var nr = row + d[0], nc = col + d[1];
      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        var target = board[nr][nc];
        if (target) {
          if (target.color !== color) {
            moves.push({ from: { row: row, col: col }, to: { row: nr, col: nc } });
          }
          break;
        }
        moves.push({ from: { row: row, col: col }, to: { row: nr, col: nc } });
        nr += d[0];
        nc += d[1];
      }
    });
  }

  return moves;
}

// Apply a move to a board (returns new board, does not mutate)
// move: { from, to, enPassant, doublePush, promoteTo }
function applyMove(board, move) {
  var b = cloneBoard(board);
  var p = b[move.from.row][move.from.col];
  var piece = { type: p.type, color: p.color, hasMoved: true };

  // En passant capture
  if (move.enPassant) {
    var captureRow = move.from.row; // the captured pawn is on the same row as the moving pawn
    b[captureRow][move.to.col] = null;
  }

  // Promotion
  if (move.promoteTo) {
    piece.type = move.promoteTo;
  }

  b[move.to.row][move.to.col] = piece;
  b[move.from.row][move.from.col] = null;

  return b;
}

// Is the given color's king in check on this board?
function inCheck(board, color, enPassantTarget) {
  var king = findKing(board, color);
  if (!king) return false;
  var opponent = color === "white" ? "black" : "white";

  for (var r = 0; r < 8; r++) {
    for (var c = 0; c < 8; c++) {
      if (board[r][c] && board[r][c].color === opponent) {
        var moves = pseudoMoves(board, r, c, enPassantTarget);
        for (var i = 0; i < moves.length; i++) {
          if (moves[i].to.row === king.row && moves[i].to.col === king.col) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// Get all legal moves for a color (filters out moves that leave own king in check)
function legalMoves(board, color, enPassantTarget) {
  var moves = [];
  for (var r = 0; r < 8; r++) {
    for (var c = 0; c < 8; c++) {
      if (board[r][c] && board[r][c].color === color) {
        var pm = pseudoMoves(board, r, c, enPassantTarget);
        pm.forEach(function(move) {
          // Expand promotions
          var promotionRow = color === "white" ? 0 : 7;
          if (board[r][c].type === "P" && move.to.row === promotionRow) {
            ["Q", "R", "B", "N"].forEach(function(pt) {
              var pm2 = Object.assign({}, move, { promoteTo: pt, promotion: true });
              var nb = applyMove(board, pm2);
              if (!inCheck(nb, color, null)) moves.push(pm2);
            });
          } else {
            var nb = applyMove(board, move);
            if (!inCheck(nb, color, move.doublePush ? null : enPassantTarget)) {
              moves.push(move);
            }
          }
        });
      }
    }
  }
  return moves;
}

// Get legal moves for a specific piece at (row, col)
function legalMovesForPiece(board, row, col, enPassantTarget) {
  var p = board[row][col];
  if (!p) return [];
  var all = legalMoves(board, p.color, enPassantTarget);
  return all.filter(function(m) { return m.from.row === row && m.from.col === col; });
}

// Check game state for the side whose turn it is
// Returns: "normal", "check", "checkmate", "stalemate"
function gameState(board, color, enPassantTarget) {
  var moves = legalMoves(board, color, enPassantTarget);
  var checked = inCheck(board, color, enPassantTarget);
  if (moves.length === 0) {
    return checked ? "checkmate" : "stalemate";
  }
  return checked ? "check" : "normal";
}

// Compute the en passant target square after a double pawn push
// Returns {row, col} of the square behind the pawn, or null
function getEnPassantTarget(move, piece) {
  if (piece.type === "P" && move.doublePush) {
    var dir = piece.color === "white" ? 1 : -1; // square behind = opposite of move direction
    return { row: move.to.row + dir, col: move.to.col };
  }
  return null;
}
