// utils.js — constants and helper functions for Chess Draft

var PIECE_BASE = "pieces/";

var COLS = ["a", "b", "c", "d", "e", "f", "g", "h"];

var PRICES = { P: 1, N: 3, B: 3, R: 5, Q: 9 };

var MAX_PIECES = 16; // including king

var PIECE_TYPES = ["K", "Q", "R", "B", "N", "P"];

// Build SVG img tag for a piece
function pieceSVG(p) {
  if (!p) return "";
  var prefix = p.color === "white" ? "w" : "b";
  var url = PIECE_BASE + prefix + p.type + ".svg";
  return '<img src="' + url + '" style="width:min(52px,11vw);height:min(52px,11vw);display:block;" draggable="false"/>';
}

// Create a piece object
function mkP(type, color) {
  return { type: type, color: color };
}

// Create an empty 8x8 board (all null)
function initEmptyBoard() {
  var b = [];
  for (var r = 0; r < 8; r++) {
    var row = [];
    for (var c = 0; c < 8; c++) row.push(null);
    b.push(row);
  }
  return b;
}

// Column index to letter
function colName(c) {
  return COLS[c];
}

// Get total coin cost of a list of piece types (excluding king)
function totalCost(types) {
  return types.reduce(function(sum, t) { return sum + (PRICES[t] || 0); }, 0);
}

// Deep clone a board
function cloneBoard(b) {
  return b.map(function(row) {
    return row.map(function(p) {
      return p ? { type: p.type, color: p.color, hasMoved: p.hasMoved } : null;
    });
  });
}

// Get all pieces on the board for a given color
function getPieces(board, color) {
  var pieces = [];
  for (var r = 0; r < 8; r++) {
    for (var c = 0; c < 8; c++) {
      if (board[r][c] && board[r][c].color === color) {
        pieces.push({ piece: board[r][c], row: r, col: c });
      }
    }
  }
  return pieces;
}

// Find the king position for a given color
function findKing(board, color) {
  for (var r = 0; r < 8; r++) {
    for (var c = 0; c < 8; c++) {
      if (board[r][c] && board[r][c].type === "K" && board[r][c].color === color) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}
