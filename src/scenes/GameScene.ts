import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

type GhostType = 'regular' | 'pumpkin' | 'bat' | 'boss';
type SpellShape = 'circle' | 'triangle' | 'lightning';

const GHOST_SPELL: Record<string, SpellShape> = {
  regular: 'circle',
  pumpkin: 'triangle',
  bat: 'lightning',
};

const SPELL_HINTS: Record<SpellShape, string> = {
  circle: '○',
  triangle: '△',
  lightning: '⚡',
};

const SPELL_COLORS: Record<SpellShape, number> = {
  circle: 0x64b5f6,
  triangle: 0x81c784,
  lightning: 0xffd54f,
};

const LEVELS: GhostType[][] = [
  ['regular', 'regular', 'regular', 'regular', 'regular'],
  ['regular', 'pumpkin', 'regular', 'pumpkin', 'regular', 'pumpkin', 'regular', 'pumpkin'],
  ['regular', 'bat', 'pumpkin', 'bat', 'regular', 'pumpkin', 'bat', 'regular', 'bat', 'pumpkin', 'regular', 'bat'],
  ['boss'],
];

interface Ghost {
  container: Phaser.GameObjects.Container;
  type: GhostType;
  hp: number;
  bossPhase: number; // for boss: 0=needs circle, 1=needs triangle, 2=needs lightning
  floatSeed: number;
  speed: number;
  alive: boolean;
  hintText: Phaser.GameObjects.Text;
  graphics: Phaser.GameObjects.Graphics;
  eyeL: Phaser.GameObjects.Graphics;
  eyeR: Phaser.GameObjects.Graphics;
}

export class GameScene extends Phaser.Scene {
  private ghosts: Ghost[] = [];
  private drawGraphics!: Phaser.GameObjects.Graphics;
  private trailGraphics!: Phaser.GameObjects.Graphics;
  private drawPath: { x: number; y: number }[] = [];
  private isDrawing = false;

  private catContainer!: Phaser.GameObjects.Container;
  private catY = GAME_HEIGHT - 100;

  private lives = 3;
  private score = 0;
  private currentLevel = 0;
  private spawnQueue: GhostType[] = [];
  private spawnIndex = 0;
  private nextSpawnTime = 0;
  private spawnDelay = 2200;

  private feedbackText!: Phaser.GameObjects.Text;
  private levelBanner!: Phaser.GameObjects.Text;
  private gameState: 'playing' | 'levelTransition' | 'gameover' | 'win' = 'playing';

  private elapsed = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.lives = 3;
    this.score = 0;
    this.currentLevel = 0;
    this.ghosts = [];
    this.spawnIndex = 0;
    this.nextSpawnTime = 3000;
    this.gameState = 'playing';
    this.elapsed = 0;

    this.drawBackground();
    this.drawGraveyard();
    this.drawCat();
    this.setupDrawing();
    this.setupFeedback();

    this.spawnQueue = [...LEVELS[this.currentLevel]];

    this.scene.launch('UIScene');
    this.time.delayedCall(100, () => {
      this.events.emit('uiLives', this.lives);
      this.events.emit('uiLevel', this.currentLevel + 1);
      this.events.emit('uiScore', this.score);
    });

    this.showLevelBanner(this.currentLevel + 1);
  }

  // ─── BACKGROUND ───────────────────────────────────────────────────────────

  private drawBackground(): void {
    const bg = this.add.graphics().setDepth(0);
    // Night sky gradient (simulate with rects)
    bg.fillGradientStyle(0x0d0221, 0x0d0221, 0x1a0a3a, 0x1a0a3a, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.75);
    bg.fillGradientStyle(0x1a0a3a, 0x1a0a3a, 0x0f1a0f, 0x0f1a0f, 1);
    bg.fillRect(0, GAME_HEIGHT * 0.75, GAME_WIDTH, GAME_HEIGHT * 0.25);

    // Moon
    const moon = this.add.graphics().setDepth(1);
    moon.fillStyle(0xfff8e1, 1);
    moon.fillCircle(1100, 130, 70);
    moon.fillStyle(0xffe082, 0.4);
    moon.fillCircle(1100, 130, 85);
    // Moon craters
    moon.fillStyle(0xffe0b2, 0.5);
    moon.fillCircle(1080, 115, 12);
    moon.fillCircle(1120, 145, 8);

    // Stars
    const stars = this.add.graphics().setDepth(1);
    const rng = new Phaser.Math.RandomDataGenerator(['halloween']);
    for (let i = 0; i < 80; i++) {
      const x = rng.between(0, GAME_WIDTH);
      const y = rng.between(0, GAME_HEIGHT * 0.65);
      const r = rng.realInRange(1, 3);
      stars.fillStyle(0xffffff, rng.realInRange(0.4, 1.0));
      stars.fillCircle(x, y, r);
    }

    // Twinkle a few
    for (let i = 0; i < 6; i++) {
      const x = [120, 300, 500, 750, 900, 1150][i];
      const y = [80, 150, 60, 120, 80, 200][i];
      const s = this.add.graphics().setDepth(1);
      s.fillStyle(0xffffff, 1);
      s.fillCircle(x, y, 3);
      this.tweens.add({
        targets: s,
        alpha: { from: 1, to: 0.1 },
        duration: 800 + i * 300,
        yoyo: true,
        repeat: -1,
        delay: i * 200,
      });
    }
  }

  private drawGraveyard(): void {
    const g = this.add.graphics().setDepth(2);

    // Ground
    g.fillStyle(0x1b2a1b, 1);
    g.fillRect(0, GAME_HEIGHT - 90, GAME_WIDTH, 90);
    g.fillStyle(0x2e4a1e, 1);
    g.fillRect(0, GAME_HEIGHT - 95, GAME_WIDTH, 12);

    // Tombstones
    const stones: [number, number, number, number][] = [
      [100, GAME_HEIGHT - 140, 55, 80],
      [220, GAME_HEIGHT - 120, 45, 65],
      [380, GAME_HEIGHT - 145, 50, 85],
      [520, GAME_HEIGHT - 115, 40, 60],
      [700, GAME_HEIGHT - 150, 55, 90],
      [870, GAME_HEIGHT - 120, 48, 70],
      [1010, GAME_HEIGHT - 135, 52, 80],
      [1160, GAME_HEIGHT - 115, 45, 65],
    ];
    for (const [x, y, w, h] of stones) {
      g.fillStyle(0x546e7a, 1);
      g.fillRoundedRect(x - w / 2, y, w, h, 8);
      g.fillStyle(0x607d8b, 1);
      g.fillRoundedRect(x - w / 2 + 3, y + 3, w - 6, h - 6, 6);
    }

    // Dead trees
    this.drawDeadTree(g, 460, GAME_HEIGHT - 90, 0.9);
    this.drawDeadTree(g, 800, GAME_HEIGHT - 90, 1.0);
  }

  private drawDeadTree(g: Phaser.GameObjects.Graphics, x: number, baseY: number, scale: number): void {
    g.lineStyle(6 * scale, 0x3e2723, 1);
    g.beginPath(); g.moveTo(x, baseY); g.lineTo(x, baseY - 130 * scale); g.strokePath();
    g.lineStyle(4 * scale, 0x3e2723, 1);
    g.beginPath(); g.moveTo(x, baseY - 80 * scale); g.lineTo(x - 40 * scale, baseY - 120 * scale); g.strokePath();
    g.beginPath(); g.moveTo(x, baseY - 80 * scale); g.lineTo(x + 35 * scale, baseY - 110 * scale); g.strokePath();
    g.beginPath(); g.moveTo(x, baseY - 110 * scale); g.lineTo(x - 25 * scale, baseY - 140 * scale); g.strokePath();
    g.beginPath(); g.moveTo(x, baseY - 110 * scale); g.lineTo(x + 20 * scale, baseY - 135 * scale); g.strokePath();
  }

  // ─── CAT ──────────────────────────────────────────────────────────────────

  private drawCat(): void {
    this.catContainer = this.add.container(GAME_WIDTH / 2, this.catY).setDepth(10);
    const g = this.add.graphics();

    // Body
    g.fillStyle(0xe67e22, 1);
    g.fillRoundedRect(-30, -10, 60, 65, 15);
    // Stripes
    g.lineStyle(3, 0xd35400, 0.6);
    g.beginPath(); g.moveTo(-15, 5); g.lineTo(-15, 45); g.strokePath();
    g.beginPath(); g.moveTo(0, 5); g.lineTo(0, 45); g.strokePath();
    g.beginPath(); g.moveTo(15, 5); g.lineTo(15, 45); g.strokePath();

    // Head
    g.fillStyle(0xe67e22, 1);
    g.fillCircle(0, -30, 35);
    // Cheek fluff
    g.fillStyle(0xf39c12, 0.5);
    g.fillCircle(-25, -18, 12);
    g.fillCircle(25, -18, 12);

    // Ears
    g.fillStyle(0xe67e22, 1);
    g.fillTriangle(-30, -55, -10, -55, -20, -75);
    g.fillTriangle(10, -55, 30, -55, 20, -75);
    g.fillStyle(0xf1948a, 1);
    g.fillTriangle(-27, -57, -12, -57, -20, -68);
    g.fillTriangle(12, -57, 27, -57, 20, -68);

    // Witch hat
    g.fillStyle(0x1a0a3a, 1);
    g.fillRect(-38, -68, 76, 14); // brim
    g.fillTriangle(-18, -68, 18, -68, 2, -120); // cone
    // Hat buckle
    g.fillStyle(0xffd700, 1);
    g.fillRect(-7, -70, 14, 10);
    g.fillStyle(0x1a0a3a, 1);
    g.fillRect(-4, -68, 8, 7);

    // Eyes
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(-14, -32, 20, 18);
    g.fillEllipse(14, -32, 20, 18);
    g.fillStyle(0x27ae60, 1);
    g.fillCircle(-14, -32, 7);
    g.fillCircle(14, -32, 7);
    g.fillStyle(0x000000, 1);
    g.fillCircle(-14, -32, 4);
    g.fillCircle(14, -32, 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-11, -35, 2);
    g.fillCircle(17, -35, 2);

    // Nose + mouth
    g.fillStyle(0xe91e63, 1);
    g.fillTriangle(-4, -22, 4, -22, 0, -17);
    g.lineStyle(2, 0x333333, 1);
    g.beginPath(); g.moveTo(0, -17); g.lineTo(-8, -12); g.strokePath();
    g.beginPath(); g.moveTo(0, -17); g.lineTo(8, -12); g.strokePath();

    // Whiskers
    g.lineStyle(2, 0xffffff, 0.7);
    for (let s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 5, -20); g.lineTo(s * 38, -18); g.strokePath();
      g.beginPath(); g.moveTo(s * 5, -16); g.lineTo(s * 38, -22); g.strokePath();
    }

    // Wand / staff
    g.fillStyle(0x5d4037, 1);
    g.fillRect(28, -55, 8, 70);
    // Star on wand
    this.drawStar(g, 32, -65, 5, 12, 0xffd700);

    // Paws
    g.fillStyle(0xe67e22, 1);
    g.fillCircle(-30, 50, 14);
    g.fillCircle(30, 50, 14);
    g.fillStyle(0xf1948a, 0.8);
    g.fillCircle(-30, 53, 8);
    g.fillCircle(30, 53, 8);

    this.catContainer.add(g);

    // Idle bob
    this.tweens.add({
      targets: this.catContainer,
      y: this.catY - 8,
      duration: 1200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Wand star twinkle
    const star = this.add.graphics().setDepth(11);
    this.catContainer.add(star);
    this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        star.clear();
        if (Math.random() > 0.5) {
          star.fillStyle(0xffd700, 0.9);
          this.drawStar(star, 32, -65, 5, 12, 0xffd700);
          star.fillStyle(0xffffff, 0.7);
          this.drawStar(star, 32, -65, 4, 6, 0xffffff);
        }
      },
    });
  }

  private drawStar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, points: number, r: number, color: number): void {
    g.fillStyle(color, 1);
    const pts: Phaser.Geom.Point[] = [];
    for (let i = 0; i < points * 2; i++) {
      const a = (i * Math.PI) / points - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.45;
      pts.push(new Phaser.Geom.Point(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad));
    }
    g.fillPoints(pts, true);
  }

  // ─── GHOSTS ───────────────────────────────────────────────────────────────

  private spawnGhost(type: GhostType): void {
    const x = Phaser.Math.Between(120, GAME_WIDTH - 120);
    const y = -80;
    const container = this.add.container(x, y).setDepth(8);

    const g = this.add.graphics();
    const eyeL = this.add.graphics();
    const eyeR = this.add.graphics();

    const hintSpell = type === 'boss' ? 'circle' : (GHOST_SPELL[type] as SpellShape);
    const hintText = this.add
      .text(0, -75, SPELL_HINTS[hintSpell], { fontSize: '28px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(9);

    container.add([g, eyeL, eyeR]);

    const hp = type === 'boss' ? 3 : 1;
    const ghost: Ghost = {
      container,
      type,
      hp,
      bossPhase: 0,
      floatSeed: Math.random() * Math.PI * 2,
      speed: type === 'boss' ? 18 : Phaser.Math.Between(22, 38),
      alive: true,
      hintText,
      graphics: g,
      eyeL,
      eyeR,
    };
    this.renderGhost(ghost);
    this.ghosts.push(ghost);

    // Entrance bounce
    this.tweens.add({
      targets: container,
      scaleX: { from: 0.4, to: 1 },
      scaleY: { from: 0.4, to: 1 },
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  private renderGhost(ghost: Ghost): void {
    const g = ghost.graphics;
    const el = ghost.eyeL;
    const er = ghost.eyeR;
    g.clear(); el.clear(); er.clear();

    if (ghost.type === 'regular') {
      // White ghost body
      g.fillStyle(0xe8eaf6, 1);
      g.fillEllipse(0, -20, 80, 70);
      g.fillRect(-40, -20, 80, 40);
      // Wavy bottom
      const waveY = 22;
      g.fillStyle(0xe8eaf6, 1);
      for (let i = -3; i <= 3; i++) {
        g.fillCircle(i * 13, waveY, 10);
      }
      // Shadow
      g.fillStyle(0xb0bec5, 0.3);
      g.fillEllipse(0, 25, 70, 15);

      el.fillStyle(0x3f51b5, 1); el.fillEllipse(-18, -12, 18, 20);
      er.fillStyle(0x3f51b5, 1); er.fillEllipse(18, -12, 18, 20);
      el.fillStyle(0x000000, 1); el.fillCircle(-18, -12, 5);
      er.fillStyle(0x000000, 1); er.fillCircle(18, -12, 5);
      el.fillStyle(0xffffff, 1); el.fillCircle(-15, -15, 2);
      er.fillStyle(0xffffff, 1); er.fillCircle(21, -15, 2);

    } else if (ghost.type === 'pumpkin') {
      // Orange pumpkin body
      g.fillStyle(0xff8f00, 1);
      g.fillEllipse(0, -15, 85, 65);
      // Pumpkin ridges
      g.fillStyle(0xe65100, 0.4);
      g.fillEllipse(-25, -15, 30, 60);
      g.fillEllipse(25, -15, 30, 60);
      // Stem
      g.fillStyle(0x4caf50, 1);
      g.fillRect(-5, -55, 10, 18);
      // Ghost tail
      g.fillStyle(0xffe0b2, 0.9);
      g.fillEllipse(0, 28, 70, 40);
      for (let i = -2; i <= 2; i++) {
        g.fillCircle(i * 15, 42, 10);
      }
      // Carved face
      g.fillStyle(0x1a0a3a, 1);
      g.fillTriangle(-22, -25, -10, -10, -32, -10); // left eye triangle
      g.fillTriangle(10, -25, 22, -10, 30, -10);     // right
      // jagged mouth
      g.fillRect(-25, -2, 50, 10);
      for (let i = 0; i < 4; i++) {
        g.fillTriangle(-20 + i * 13, -2, -20 + i * 13 + 7, -2, -20 + i * 13 + 3.5, -12);
      }

    } else if (ghost.type === 'bat') {
      // Purple bat ghost
      g.fillStyle(0x7b1fa2, 1);
      g.fillEllipse(0, -10, 70, 60);
      // Wings
      g.fillStyle(0x4a148c, 1);
      // Left wing
      g.fillTriangle(-35, -10, -90, -50, -90, 15);
      g.fillTriangle(-35, -10, -90, 15, -55, 20);
      // Right wing
      g.fillTriangle(35, -10, 90, -50, 90, 15);
      g.fillTriangle(35, -10, 90, 15, 55, 20);
      // Wing veins
      g.lineStyle(2, 0x6a1b9a, 0.6);
      g.beginPath(); g.moveTo(-35, -10); g.lineTo(-80, -30); g.strokePath();
      g.beginPath(); g.moveTo(-35, -10); g.lineTo(-85, 5); g.strokePath();
      g.beginPath(); g.moveTo(35, -10); g.lineTo(80, -30); g.strokePath();
      g.beginPath(); g.moveTo(35, -10); g.lineTo(85, 5); g.strokePath();
      // Ghost tail
      g.fillStyle(0xce93d8, 0.8);
      g.fillEllipse(0, 25, 55, 30);
      for (let i = -2; i <= 2; i++) {
        g.fillCircle(i * 12, 35, 8);
      }
      // Tiny fangs
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(-8, 5, -3, 5, -5, 14);
      g.fillTriangle(3, 5, 8, 5, 5, 14);

      el.fillStyle(0xff6f00, 1); el.fillEllipse(-16, -15, 18, 16);
      er.fillStyle(0xff6f00, 1); er.fillEllipse(16, -15, 18, 16);
      el.fillStyle(0x000000, 1); el.fillCircle(-16, -15, 4);
      er.fillStyle(0x000000, 1); er.fillCircle(16, -15, 4);

    } else if (ghost.type === 'boss') {
      // Big ominous boss ghost
      const phase = ghost.bossPhase;
      const hpColor = [0xc62828, 0xf57f17, 0x1565c0][phase] ?? 0xc62828;
      g.fillStyle(hpColor, 0.3);
      g.fillCircle(0, 0, 85);
      g.fillStyle(0xfce4ec, 1);
      g.fillEllipse(0, -20, 130, 110);
      g.fillRect(-65, -20, 130, 60);
      // Wavy bottom
      for (let i = -4; i <= 4; i++) {
        g.fillStyle(0xfce4ec, 1);
        g.fillCircle(i * 16, 42, 14);
      }
      g.fillStyle(0x4a148c, 0.5);
      g.fillEllipse(-35, -25, 40, 45);
      g.fillEllipse(35, -25, 40, 45);
      // Crown
      g.fillStyle(0xffd700, 1);
      g.fillRect(-40, -80, 80, 18);
      g.fillTriangle(-40, -80, -30, -80, -35, -100);
      g.fillTriangle(-5, -80, 5, -80, 0, -105);
      g.fillTriangle(30, -80, 40, -80, 35, -100);
      // Jewels
      g.fillStyle(0xe53935, 1); g.fillCircle(-35, -74, 7);
      g.fillStyle(0x43a047, 1); g.fillCircle(0, -74, 7);
      g.fillStyle(0x1e88e5, 1); g.fillCircle(35, -74, 7);

      el.fillStyle(0xfff176, 1); el.fillEllipse(-28, -20, 30, 28);
      er.fillStyle(0xfff176, 1); er.fillEllipse(28, -20, 30, 28);
      el.fillStyle(0x000000, 1); el.fillEllipse(-28, -20, 14, 20);
      er.fillStyle(0x000000, 1); er.fillEllipse(28, -20, 14, 20);
      el.fillStyle(0xffffff, 1); el.fillCircle(-24, -24, 4);
      er.fillStyle(0xffffff, 1); er.fillCircle(32, -24, 4);
    }
  }

  private getRequiredSpell(ghost: Ghost): SpellShape {
    if (ghost.type === 'boss') {
      return (['circle', 'triangle', 'lightning'] as SpellShape[])[ghost.bossPhase];
    }
    return GHOST_SPELL[ghost.type] as SpellShape;
  }

  // ─── DRAWING SYSTEM ───────────────────────────────────────────────────────

  private setupDrawing(): void {
    this.drawGraphics = this.add.graphics().setDepth(50);
    this.trailGraphics = this.add.graphics().setDepth(50);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDrawing = true;
      this.drawPath = [{ x: p.x, y: p.y }];
      this.drawGraphics.clear();
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDrawing) return;
      this.drawPath.push({ x: p.x, y: p.y });
      this.renderTrail();
    });

    this.input.on('pointerup', () => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      if (this.gameState !== 'playing') { this.clearTrail(); return; }
      const shape = this.recognizeShape(this.drawPath);
      if (shape) {
        this.tryHitGhost(shape);
      } else {
        this.showFeedback('✗ Try again!', 0xff5252);
      }
      this.time.delayedCall(350, () => this.clearTrail());
    });
  }

  private renderTrail(): void {
    this.drawGraphics.clear();
    const pts = this.drawPath;
    if (pts.length < 2) return;

    // Glow layers
    for (let layer = 0; layer < 3; layer++) {
      const width = [10, 5, 2][layer];
      const alpha = [0.15, 0.35, 0.9][layer];
      this.drawGraphics.lineStyle(width, 0xa78bfa, alpha);
      this.drawGraphics.beginPath();
      this.drawGraphics.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        this.drawGraphics.lineTo(pts[i].x, pts[i].y);
      }
      this.drawGraphics.strokePath();
    }

    // Sparkle dots along trail
    for (let i = 0; i < pts.length; i += 6) {
      this.drawGraphics.fillStyle(0xffd700, 0.6);
      this.drawGraphics.fillCircle(pts[i].x, pts[i].y, 3);
    }
  }

  private clearTrail(): void {
    this.drawGraphics.clear();
    this.drawPath = [];
  }

  // ─── GESTURE RECOGNITION ──────────────────────────────────────────────────

  /** Smooth path with a moving-average window to remove mouse jitter. */
  private smoothPath(pts: { x: number; y: number }[]): { x: number; y: number }[] {
    const W = 5;
    return pts.map((_, i) => {
      let sx = 0, sy = 0, cnt = 0;
      for (let j = Math.max(0, i - W); j <= Math.min(pts.length - 1, i + W); j++) {
        sx += pts[j].x; sy += pts[j].y; cnt++;
      }
      return { x: sx / cnt, y: sy / cnt };
    });
  }

  private recognizeShape(pts: { x: number; y: number }[]): SpellShape | null {
    if (pts.length < 12) return null;

    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX;
    const h = maxY - minY;
    if (w < 40 && h < 40) return null; // too small

    const start = pts[0];
    const end = pts[pts.length - 1];
    const startEndDist = Math.hypot(end.x - start.x, end.y - start.y);
    const diagonal = Math.hypot(w, h);
    const isClosed = startEndDist < diagonal * 0.42;

    const smooth = this.smoothPath(pts);

    if (isClosed) {
      // ── Circle vs Triangle ──────────────────────────────────────────────
      // Key insight: measure how uniform each point's distance is from the
      // path centroid. A circle → all points ~equidistant → low CV.
      // A triangle → corner points stick far out, edge midpoints are close → high CV.
      // Mouse jitter cannot meaningfully change this ratio.
      const cx = smooth.reduce((s, p) => s + p.x, 0) / smooth.length;
      const cy = smooth.reduce((s, p) => s + p.y, 0) / smooth.length;
      const dists = smooth.map(p => Math.hypot(p.x - cx, p.y - cy));
      const avgD = dists.reduce((s, d) => s + d, 0) / dists.length;
      if (avgD < 10) return null; // degenerate
      const stdD = Math.sqrt(dists.reduce((s, d) => s + (d - avgD) ** 2, 0) / dists.length);
      const cv = stdD / avgD; // coefficient of variation

      // Empirically: drawn circles give CV ~0.05–0.15; triangles give CV ~0.22–0.40
      if (cv < 0.20) return 'circle';
      return 'triangle';

    } else {
      // ── Lightning / zigzag ───────────────────────────────────────────────
      const xReversals = this.countXReversals(pts);
      const sharpCorners = this.countSharpCorners(smooth);
      if (xReversals >= 2 || sharpCorners >= 3) return 'lightning';
      return null;
    }
  }

  /** Count sharp direction changes (> 60°) for zigzag detection only. */
  private countSharpCorners(pts: { x: number; y: number }[]): number {
    const step = Math.max(1, Math.floor(pts.length / 20));
    const sampled: { x: number; y: number }[] = [];
    for (let i = 0; i < pts.length; i += step) sampled.push(pts[i]);

    let corners = 0;
    for (let i = 2; i < sampled.length - 2; i++) {
      const a1 = Math.atan2(sampled[i].y - sampled[i - 2].y, sampled[i].x - sampled[i - 2].x);
      const a2 = Math.atan2(sampled[i + 2].y - sampled[i].y, sampled[i + 2].x - sampled[i].x);
      let diff = Math.abs(a2 - a1);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff > 1.05) corners++; // > ~60°
    }
    return corners;
  }

  private countXReversals(pts: { x: number; y: number }[]): number {
    const step = Math.max(1, Math.floor(pts.length / 20));
    let reversals = 0;
    let prevDir = 0;
    for (let i = step; i < pts.length; i += step) {
      const dx = pts[i].x - pts[i - step].x;
      const dir = dx > 10 ? 1 : dx < -10 ? -1 : 0;
      if (dir !== 0 && prevDir !== 0 && dir !== prevDir) reversals++;
      if (dir !== 0) prevDir = dir;
    }
    return reversals;
  }

  // ─── GHOST INTERACTION ────────────────────────────────────────────────────

  private tryHitGhost(shape: SpellShape): void {
    // Use the centroid of the drawn path as the "aim" point
    const pathCx = this.drawPath.reduce((s, p) => s + p.x, 0) / Math.max(1, this.drawPath.length);
    const pathCy = this.drawPath.reduce((s, p) => s + p.y, 0) / Math.max(1, this.drawPath.length);

    // Find any alive ghost that needs this spell — prioritise the one
    // whose centre is nearest to where the player actually drew.
    let best: Ghost | null = null;
    let bestDist = Infinity;

    for (const ghost of this.ghosts) {
      if (!ghost.alive) continue;
      const needed = this.getRequiredSpell(ghost);
      if (needed !== shape) continue;
      const d = Math.hypot(ghost.container.x - pathCx, ghost.container.y - pathCy);
      if (d < bestDist) { bestDist = d; best = ghost; }
    }

    if (best) {
      this.hitGhost(best);
    } else {
      this.showFeedback('Wrong spell!', 0xff9800);
    }
  }

  private hitGhost(ghost: Ghost): void {
    const spell = this.getRequiredSpell(ghost);
    const color = SPELL_COLORS[spell];
    this.spawnMagicBurst(ghost.container.x, ghost.container.y, color);

    if (ghost.type === 'boss') {
      ghost.bossPhase++;
      ghost.hp--;
      if (ghost.hp <= 0) {
        this.defeatGhost(ghost);
        this.score += 500;
      } else {
        const nextSpell = this.getRequiredSpell(ghost);
        ghost.hintText.setText(SPELL_HINTS[nextSpell]);
        this.renderGhost(ghost);
        this.tweens.add({
          targets: ghost.container,
          scaleX: 1.2, scaleY: 1.2,
          duration: 100, yoyo: true,
        });
        this.showFeedback(`Boss: ${3 - ghost.hp}/3 💥`, color);
        this.score += 150;
      }
    } else {
      this.defeatGhost(ghost);
      this.score += 100;
    }

    this.events.emit('uiScore', this.score);
    this.showFeedback('+' + (ghost.type === 'boss' ? '150' : '100') + ' ✨', color);
  }

  private defeatGhost(ghost: Ghost): void {
    ghost.alive = false;
    this.spawnMagicBurst(ghost.container.x, ghost.container.y, 0xffd700);
    ghost.hintText.destroy();

    this.tweens.add({
      targets: ghost.container,
      scaleX: 2.0, scaleY: 2.0, alpha: 0,
      duration: 400, ease: 'Power2',
      onComplete: () => ghost.container.destroy(),
    });

    // Check level completion
    this.time.delayedCall(500, () => this.checkLevelComplete());
  }

  private ghostEscapes(ghost: Ghost): void {
    if (!ghost.alive) return;
    ghost.alive = false;
    ghost.hintText.destroy();

    this.lives--;
    this.events.emit('uiLives', this.lives);
    this.showFeedback('A ghost escaped! 👻', 0xff5252);

    this.tweens.add({
      targets: ghost.container,
      alpha: 0,
      duration: 400,
      onComplete: () => ghost.container.destroy(),
    });

    // Flash cat red
    this.tweens.add({
      targets: this.catContainer,
      alpha: 0.3,
      duration: 100, yoyo: true, repeat: 3,
      onComplete: () => this.catContainer.setAlpha(1),
    });

    if (this.lives <= 0) {
      this.time.delayedCall(600, () => this.triggerGameOver());
    } else {
      this.time.delayedCall(500, () => this.checkLevelComplete());
    }
  }

  // ─── PARTICLES ────────────────────────────────────────────────────────────

  private spawnMagicBurst(x: number, y: number, color: number): void {
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const speed = Phaser.Math.Between(55, 130);
      const pG = this.add.graphics().setDepth(30);
      pG.fillStyle(color, 1);
      pG.fillCircle(0, 0, Phaser.Math.Between(3, 8));
      pG.setPosition(x, y);
      this.tweens.add({
        targets: pG,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0, scaleX: 0.1, scaleY: 0.1,
        duration: Phaser.Math.Between(400, 700),
        ease: 'Power2',
        onComplete: () => pG.destroy(),
      });
    }
    // Central flash
    const flash = this.add.graphics().setDepth(30);
    flash.fillStyle(0xffffff, 0.9);
    flash.fillCircle(x, y, 30);
    this.tweens.add({
      targets: flash,
      alpha: 0, scaleX: 2.5, scaleY: 2.5,
      duration: 250,
      onComplete: () => flash.destroy(),
    });
  }

  // ─── FEEDBACK TEXT ────────────────────────────────────────────────────────

  private setupFeedback(): void {
    this.feedbackText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, '', {
        fontSize: '32px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(60)
      .setAlpha(0);
  }

  private showFeedback(msg: string, color: number): void {
    const hex = '#' + color.toString(16).padStart(6, '0');
    this.feedbackText.setText(msg).setColor(hex).setAlpha(1).setScale(1);
    this.tweens.killTweensOf(this.feedbackText);
    this.tweens.add({
      targets: this.feedbackText,
      y: { from: GAME_HEIGHT / 2 - 60, to: GAME_HEIGHT / 2 - 120 },
      scaleX: { from: 1.2, to: 1 }, scaleY: { from: 1.2, to: 1 },
      alpha: { from: 1, to: 0 },
      duration: 1200,
      ease: 'Power2',
    });
  }

  // ─── LEVEL MANAGEMENT ─────────────────────────────────────────────────────

  private showLevelBanner(levelNum: number): void {
    if (this.levelBanner) this.levelBanner.destroy();

    const label = levelNum > LEVELS.length ? 'YOU WIN! 🎉' : (levelNum === LEVELS.length ? '⚠ BOSS BATTLE!' : `Level ${levelNum}`);
    this.levelBanner = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, label, {
        fontSize: '52px', color: '#ffd700',
        stroke: '#4a0080', strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScale(0.5);

    this.tweens.add({
      targets: this.levelBanner,
      scaleX: 1, scaleY: 1,
      duration: 400, ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(1200, () => {
          this.tweens.add({
            targets: this.levelBanner,
            alpha: 0, y: GAME_HEIGHT / 2 - 60,
            duration: 500,
            onComplete: () => { if (this.levelBanner) this.levelBanner.destroy(); },
          });
        });
      },
    });
  }

  private checkLevelComplete(): void {
    if (this.gameState !== 'playing') return;
    const alive = this.ghosts.filter(g => g.alive);
    if (alive.length > 0) return;
    if (this.spawnIndex < this.spawnQueue.length) return;

    this.gameState = 'levelTransition';
    this.time.delayedCall(800, () => this.advanceLevel());
  }

  private advanceLevel(): void {
    this.currentLevel++;
    if (this.currentLevel >= LEVELS.length) {
      this.triggerWin();
      return;
    }
    this.spawnQueue = [...LEVELS[this.currentLevel]];
    this.spawnIndex = 0;
    this.nextSpawnTime = this.elapsed + 1500;
    this.gameState = 'playing';
    this.events.emit('uiLevel', this.currentLevel + 1);
    this.showLevelBanner(this.currentLevel + 1);
  }

  private triggerGameOver(): void {
    this.gameState = 'gameover';
    this.scene.get('UIScene').events.emit('gameOver', this.score);

    const overlay = this.add.graphics().setDepth(200);
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const msg = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, '💀 Game Over 💀', {
        fontSize: '60px', color: '#ff5252', stroke: '#000', strokeThickness: 6,
      })
      .setOrigin(0.5).setDepth(210).setScale(0);

    const sub = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, `Score: ${this.score}`, {
        fontSize: '36px', color: '#ffffff', stroke: '#000', strokeThickness: 4,
      })
      .setOrigin(0.5).setDepth(210).setAlpha(0);

    const restart = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 110, '▶  Play Again', {
        fontSize: '32px', color: '#ffd700', stroke: '#000', strokeThickness: 4,
        backgroundColor: '#4a0080', padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5).setDepth(210).setAlpha(0).setInteractive({ useHandCursor: true });

    this.tweens.add({ targets: msg, scaleX: 1, scaleY: 1, duration: 500, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [sub, restart], alpha: 1, delay: 400, duration: 400 });

    restart.on('pointerover', () => restart.setScale(1.1));
    restart.on('pointerout', () => restart.setScale(1));
    restart.on('pointerdown', () => {
      this.scene.stop('UIScene');
      this.scene.restart();
    });
  }

  private triggerWin(): void {
    this.gameState = 'win';

    const overlay = this.add.graphics().setDepth(200);
    overlay.fillStyle(0x000000, 0.55);
    overlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const msg = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, '🎃 You Won! 🎃', {
        fontSize: '64px', color: '#ffd700', stroke: '#4a0080', strokeThickness: 7,
      })
      .setOrigin(0.5).setDepth(210).setScale(0.3);

    const sub = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, `All ghosts banished!\nScore: ${this.score}`, {
        fontSize: '34px', color: '#ffffff', stroke: '#000', strokeThickness: 4, align: 'center',
      })
      .setOrigin(0.5).setDepth(210).setAlpha(0);

    const restart = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 130, '▶  Play Again', {
        fontSize: '32px', color: '#1a0a3a', stroke: '#000', strokeThickness: 2,
        backgroundColor: '#ffd700', padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5).setDepth(210).setAlpha(0).setInteractive({ useHandCursor: true });

    this.tweens.add({ targets: msg, scaleX: 1, scaleY: 1, duration: 600, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [sub, restart], alpha: 1, delay: 500, duration: 400 });

    // Confetti burst
    for (let i = 0; i < 40; i++) {
      this.time.delayedCall(i * 60, () => {
        const cx = Phaser.Math.Between(100, GAME_WIDTH - 100);
        this.spawnMagicBurst(cx, Phaser.Math.Between(100, 400),
          [0xffd700, 0xff6f00, 0x7b1fa2, 0x1565c0, 0x2e7d32][i % 5]);
      });
    }

    restart.on('pointerover', () => restart.setScale(1.1));
    restart.on('pointerout', () => restart.setScale(1));
    restart.on('pointerdown', () => {
      this.scene.stop('UIScene');
      this.scene.restart();
    });
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    this.elapsed += delta;

    if (this.gameState !== 'playing') return;

    // Spawn ghosts
    if (this.spawnIndex < this.spawnQueue.length && this.elapsed > this.nextSpawnTime) {
      this.spawnGhost(this.spawnQueue[this.spawnIndex]);
      this.spawnIndex++;
      const delay = this.currentLevel === 3 ? 3500 : this.spawnDelay - this.currentLevel * 200;
      this.nextSpawnTime = this.elapsed + delay;
    }

    // Move ghosts
    const escapeY = GAME_HEIGHT - 130;
    for (const ghost of this.ghosts) {
      if (!ghost.alive) continue;

      // Float downward with sine wave
      ghost.container.y += (ghost.speed * delta) / 1000;
      ghost.container.x += Math.sin(this.elapsed / 900 + ghost.floatSeed) * 1.2;

      // Eye wiggle (idle life)
      ghost.eyeL.x = Math.sin(this.elapsed / 400 + ghost.floatSeed) * 2;
      ghost.eyeR.x = Math.sin(this.elapsed / 400 + ghost.floatSeed) * 2;

      // Update hint text position
      ghost.hintText.setPosition(ghost.container.x, ghost.container.y - (ghost.type === 'boss' ? 120 : 85));

      // Escape check
      if (ghost.container.y > escapeY) {
        this.ghostEscapes(ghost);
      }
    }
  }
}
