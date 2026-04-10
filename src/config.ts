export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const CELL = 40;
export const COLS = 20;
export const ROWS = 13;

export const WAYPOINTS: { x: number; y: number }[] = [
  { x: -20, y: 260 },
  { x: 140, y: 260 },
  { x: 140, y: 100 },
  { x: 420, y: 100 },
  { x: 420, y: 420 },
  { x: 620, y: 420 },
  { x: 620, y: 180 },
  { x: 820, y: 180 },
];

export const PATH_TILE_SET = new Set<string>([
  '0,6','1,6','2,6','3,6',
  '3,5','3,4','3,3','3,2',
  '4,2','5,2','6,2','7,2','8,2','9,2','10,2',
  '10,3','10,4','10,5','10,6','10,7','10,8','10,9','10,10',
  '11,10','12,10','13,10','14,10','15,10',
  '15,9','15,8','15,7','15,6','15,5','15,4',
  '16,4','17,4','18,4','19,4',
]);

export const CAT_COST = 75;
export const STARTING_COINS = 150;
export const STARTING_LIVES = 20;

export interface TowerConfig {
  cost: number;
  range: number;
  fireRate: number;
  damage: number;
  label: string;
  color: number;
  colorStr: string;
  rangeColor: number;
  bulletColor: number;
  bulletSize: number;
  bulletSpeed: number;
  desc: string;
  splashRadius?: number;
  chainRadius?: number;
  slowFactor?: number;
  slowDuration?: number;
  burnDps?: number;
  burnDuration?: number;
  trapProximity?: number;
}

export const TOWER_CONFIGS: Record<string, TowerConfig> = {
  basic: {
    cost: 75, range: 120, fireRate: 1500, damage: 30,
    label: 'Basic', color: 0xff8c00, colorStr: '#ff8c00',
    rangeColor: 0x6688ff, bulletColor: 0xffee00, bulletSize: 5, bulletSpeed: 350,
    desc: 'Balanced all-rounder',
  },
  sniper: {
    cost: 150, range: 220, fireRate: 3000, damage: 100,
    label: 'Sniper', color: 0x4488ff, colorStr: '#4488ff',
    rangeColor: 0x44aaff, bulletColor: 0x88ddff, bulletSize: 7, bulletSpeed: 220,
    desc: 'Long range, high dmg',
  },
  rapid: {
    cost: 100, range: 80, fireRate: 380, damage: 12,
    label: 'Rapid', color: 0xffcc00, colorStr: '#ffcc00',
    rangeColor: 0xff8844, bulletColor: 0xff5500, bulletSize: 3, bulletSpeed: 520,
    desc: 'Fast, short range',
  },
  bomb: {
    cost: 200, range: 150, fireRate: 2800, damage: 80,
    label: 'Bomber', color: 0xdd2222, colorStr: '#dd2222',
    rangeColor: 0xff4400, bulletColor: 0x111111, bulletSize: 8, bulletSpeed: 190,
    desc: 'Slow AoE splash',
    splashRadius: 70,
  },
  taser: {
    cost: 175, range: 110, fireRate: 2200, damage: 25,
    label: 'Taser', color: 0x00ccff, colorStr: '#00ccff',
    rangeColor: 0x00eeee, bulletColor: 0x00ffff, bulletSize: 5, bulletSpeed: 620,
    desc: 'Slows & chains 2',
    chainRadius: 80, slowFactor: 0.4, slowDuration: 2000,
  },
  freeze: {
    cost: 125, range: 130, fireRate: 2500, damage: 20,
    label: 'Freeze', color: 0x88ddff, colorStr: '#88ddff',
    rangeColor: 0x88ddff, bulletColor: 0xaaeeff, bulletSize: 8, bulletSpeed: 300,
    desc: 'Freezes enemies solid',
    slowFactor: 0.05, slowDuration: 2000,
  },
  flame: {
    cost: 150, range: 90, fireRate: 500, damage: 10,
    label: 'Flame', color: 0xff5500, colorStr: '#ff5500',
    rangeColor: 0xff6622, bulletColor: 0xff3300, bulletSize: 6, bulletSpeed: 280,
    desc: 'Burns enemies over time',
    burnDps: 8, burnDuration: 3000,
  },
  trap: {
    cost: 175, range: 160, fireRate: 8000, damage: 150,
    label: 'Trap', color: 0x44cc44, colorStr: '#44cc44',
    rangeColor: 0x55ee55, bulletColor: 0x228822, bulletSize: 10, bulletSpeed: 800,
    desc: 'Ground mine, big AoE',
    splashRadius: 80, trapProximity: 35,
  },
};
