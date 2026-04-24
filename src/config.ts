export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// Board layout
export const CELL = 26;           // pixels per board cell
export const BOARD_COLS = 20;
export const BOARD_ROWS = 20;
export const BOARD_ORIG_X = 65;   // left edge of board in world coords
export const BOARD_ORIG_Y = 100;  // top edge of board
export const BOARD_PX = CELL * BOARD_COLS; // 520px

// Right panel
export const PANEL_X = BOARD_ORIG_X + BOARD_PX + 14; // ~599
export const PANEL_W = GAME_WIDTH - PANEL_X - 10;    // ~671

// Piece thumbnail grid (7 columns × 3 rows inside right panel)
export const THUMB_COLS = 7;
export const THUMB_SIZE = 82;     // px per thumbnail slot
