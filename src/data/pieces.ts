export type PieceCells = [number, number][];

export interface PieceState {
  name: string;
  orientationIdx: number;
}

// Rotate 90° clockwise: (x, y) -> (-y, x) then normalize
function rotateCW(cells: PieceCells): PieceCells {
  const rotated = cells.map(([x, y]) => [-y, x] as [number, number]);
  const minX = Math.min(...rotated.map(c => c[0]));
  const minY = Math.min(...rotated.map(c => c[1]));
  return rotated.map(([x, y]) => [x - minX, y - minY] as [number, number]);
}

function flipH(cells: PieceCells): PieceCells {
  const flipped = cells.map(([x, y]) => [-x, y] as [number, number]);
  const minX = Math.min(...flipped.map(c => c[0]));
  return flipped.map(([x, y]) => [x - minX, y] as [number, number]);
}

function cellsKey(cells: PieceCells): string {
  return [...cells]
    .sort((a, b) => a[1] !== b[1] ? a[1] - b[1] : a[0] - b[0])
    .map(([x, y]) => `${x},${y}`)
    .join('|');
}

export function getOrientations(baseCells: PieceCells): PieceCells[] {
  const seen = new Set<string>();
  const result: PieceCells[] = [];
  let cur = baseCells;
  for (let f = 0; f < 2; f++) {
    for (let r = 0; r < 4; r++) {
      const key = cellsKey(cur);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(cur);
      }
      cur = rotateCW(cur);
    }
    cur = flipH(baseCells);
  }
  return result;
}

// All 21 Blokus piece base shapes
export const BASE_PIECES: Record<string, PieceCells> = {
  'I1': [[0,0]],
  'I2': [[0,0],[1,0]],
  'I3': [[0,0],[1,0],[2,0]],
  'V3': [[0,0],[1,0],[0,1]],
  'I4': [[0,0],[1,0],[2,0],[3,0]],
  'L4': [[0,0],[0,1],[0,2],[1,2]],
  'T4': [[0,0],[1,0],[2,0],[1,1]],
  'S4': [[1,0],[2,0],[0,1],[1,1]],
  'O4': [[0,0],[1,0],[0,1],[1,1]],
  'F5': [[1,0],[2,0],[0,1],[1,1],[1,2]],
  'I5': [[0,0],[1,0],[2,0],[3,0],[4,0]],
  'L5': [[0,0],[0,1],[0,2],[0,3],[1,3]],
  'N5': [[1,0],[1,1],[0,2],[1,2],[0,3]],
  'P5': [[0,0],[1,0],[0,1],[1,1],[0,2]],
  'T5': [[0,0],[1,0],[2,0],[1,1],[1,2]],
  'U5': [[0,0],[2,0],[0,1],[1,1],[2,1]],
  'V5': [[0,0],[0,1],[0,2],[1,2],[2,2]],
  'W5': [[0,0],[0,1],[1,1],[1,2],[2,2]],
  'X5': [[1,0],[0,1],[1,1],[2,1],[1,2]],
  'Y5': [[1,0],[0,1],[1,1],[1,2],[1,3]],
  'Z5': [[0,0],[1,0],[1,1],[1,2],[2,2]],
};

// Pre-compute all unique orientations per piece
export const PIECE_ORIENTATIONS: Record<string, PieceCells[]> = {};
for (const [name, cells] of Object.entries(BASE_PIECES)) {
  PIECE_ORIENTATIONS[name] = getOrientations(cells);
}

export const ALL_PIECE_NAMES = Object.keys(BASE_PIECES);

// Player starting corners [x, y] in board coordinates
export const PLAYER_CORNERS: [number, number][] = [
  [0, 0],   // Player 0: top-left
  [19, 19], // Player 1: bottom-right
  [19, 0],  // Player 2: top-right
  [0, 19],  // Player 3: bottom-left
];

// Player colors
export const PLAYER_COLORS = [0x3b82f6, 0xef4444, 0x22c55e, 0xf59e0b];
export const PLAYER_COLORS_DARK = [0x1d4ed8, 0xb91c1c, 0x15803d, 0xb45309];
export const PLAYER_NAMES = ['Blue', 'Red', 'Green', 'Yellow'];

export function canPlacePiece(
  board: number[],
  cells: [number, number][],
  playerIndex: number,
  isFirstMove: boolean
): boolean {
  const cellSet = new Set(cells.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of cells) {
    if (x < 0 || x >= 20 || y < 0 || y >= 20) return false;
    if (board[y * 20 + x] !== -1) return false;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]] as [number,number][]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < 20 && ny >= 0 && ny < 20) {
        if (board[ny * 20 + nx] === playerIndex) return false;
      }
    }
  }
  if (isFirstMove) {
    const [cx, cy] = PLAYER_CORNERS[playerIndex];
    return cells.some(([x, y]) => x === cx && y === cy);
  } else {
    for (const [x, y] of cells) {
      for (const [dx, dy] of [[1,1],[1,-1],[-1,1],[-1,-1]] as [number,number][]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < 20 && ny >= 0 && ny < 20) {
          if (board[ny * 20 + nx] === playerIndex && !cellSet.has(`${nx},${ny}`)) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

export function getPieceCells(
  pieceName: string,
  orientationIdx: number,
  boardX: number,
  boardY: number
): [number, number][] {
  const orientations = PIECE_ORIENTATIONS[pieceName];
  const cells = orientations[orientationIdx % orientations.length];
  return cells.map(([dx, dy]) => [boardX + dx, boardY + dy] as [number, number]);
}

export function countRemainingCells(pieceNames: string[]): number {
  return pieceNames.reduce((t, n) => t + BASE_PIECES[n].length, 0);
}

export function hasValidMove(
  board: number[],
  pieceNames: string[],
  playerIndex: number,
  isFirstMove: boolean
): boolean {
  for (const name of pieceNames) {
    for (const cells of PIECE_ORIENTATIONS[name]) {
      for (let by = 0; by < 20; by++) {
        for (let bx = 0; bx < 20; bx++) {
          const abs = cells.map(([dx, dy]) => [bx + dx, by + dy] as [number, number]);
          if (canPlacePiece(board, abs, playerIndex, isFirstMove)) return true;
        }
      }
    }
  }
  return false;
}
