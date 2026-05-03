import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { unboxyReady } from '../main';

// ─── Tile palette (matches GameScene exactly) ────────────────────────────────
const COLORS = [
  { base: 0x4a8a2e, light: 0x72cc48, dark: 0x2c5a18, shadow: 0x183a0c, inner: 0x3a6e22 },
  { base: 0xc8982a, light: 0xecc04a, dark: 0x886a18, shadow: 0x584408, inner: 0xa88020 },
  { base: 0x2858a8, light: 0x4888d8, dark: 0x183a78, shadow: 0x0c2448, inner: 0x3878c0 },
  { base: 0xac4618, light: 0xd87038, dark: 0x6c2c0c, shadow: 0x3c1806, inner: 0x943c14 },
] as const;

const TILE_SIZE = 78;

// ─── Scene ───────────────────────────────────────────────────────────────────
export class StartScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StartScene' });
  }

  async create(): Promise<void> {
    this.drawBackground();
    this.drawTitlePanel();
    this.drawDecorTiles();
    this.drawPlayButton();
    await this.showHighScore();
  }

  // ─── Background (same earthy style as GameScene) ──────────────────────────

  private drawBackground(): void {
    const bg = this.add.graphics().setDepth(0);
    for (let y = 0; y < GAME_HEIGHT; y += 4) {
      const t = y / GAME_HEIGHT;
      const r = Phaser.Math.Linear(0x18, 0x0c, t) | 0;
      const g = Phaser.Math.Linear(0x34, 0x20, t) | 0;
      const b = Phaser.Math.Linear(0x16, 0x0e, t) | 0;
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, y, GAME_WIDTH, 4);
    }

    const moss = this.add.graphics().setDepth(1);
    for (const blob of [
      { x: -40,              y: 155,              r: 130, a: 0.55 },
      { x: 80,               y: 105,              r:  90, a: 0.40 },
      { x: GAME_WIDTH + 40,  y: 165,              r: 130, a: 0.55 },
      { x: GAME_WIDTH - 70,  y: 110,              r:  90, a: 0.40 },
      { x: -30,              y: 475,              r: 115, a: 0.50 },
      { x: 45,               y: 615,              r:  80, a: 0.38 },
      { x: -15,              y: 755,              r: 100, a: 0.46 },
      { x: GAME_WIDTH + 30,  y: 485,              r: 115, a: 0.50 },
      { x: GAME_WIDTH - 40,  y: 625,              r:  80, a: 0.38 },
      { x: GAME_WIDTH + 15,  y: 765,              r: 100, a: 0.46 },
      { x: -35,              y: GAME_HEIGHT - 250, r: 130, a: 0.55 },
      { x: 65,               y: GAME_HEIGHT - 155, r:  90, a: 0.40 },
      { x: 18,               y: GAME_HEIGHT - 65,  r:  80, a: 0.35 },
      { x: GAME_WIDTH + 35,  y: GAME_HEIGHT - 250, r: 130, a: 0.55 },
      { x: GAME_WIDTH - 60,  y: GAME_HEIGHT - 155, r:  90, a: 0.40 },
      { x: GAME_WIDTH - 15,  y: GAME_HEIGHT - 65,  r:  80, a: 0.35 },
    ]) {
      moss.fillStyle(0x4a8a28, blob.a);
      moss.fillCircle(blob.x, blob.y, blob.r);
      moss.fillStyle(0x60aa30, blob.a * 0.5);
      moss.fillCircle(blob.x - 18, blob.y - 18, blob.r * 0.55);
    }

    for (const p of [
      { x: 42,  y: 345  }, { x: 677, y: 315  },
      { x: 36,  y: 562  }, { x: 684, y: 592  },
      { x: 50,  y: 795  }, { x: 671, y: 815  },
      { x: 58,  y: 1062 }, { x: 661, y: 1045 },
    ]) this.drawDaisy(moss, p.x, p.y);
  }

  private drawDaisy(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(0xf0f0e0, 0.72);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillCircle(x + Math.cos(a) * 11, y + Math.sin(a) * 11, 5.5);
    }
    g.fillStyle(0xf0d840, 0.90);
    g.fillCircle(x, y, 5.5);
  }

  // ─── Title panel ─────────────────────────────────────────────────────────

  private drawTitlePanel(): void {
    const cx = GAME_WIDTH / 2;
    // Target display size for the title banner
    const bannerW = 590, bannerH = 150;
    // buttonLong_grey_pressed native size in the Kenney atlas is 190 × 49 px
    const nativeW = 190, nativeH = 49;
    const bannerCY = 183; // vertical centre of the banner area

    // Atlas frame as the banner background — scale to fill our target size
    this.add.image(cx, bannerCY, 'uipack_rpg_sheet', 'buttonLong_grey_pressed.png')
      .setScale(bannerW / nativeW, bannerH / nativeH)
      .setDepth(2);

    // Title text — sits on the grey frame; light colours read well against it
    const title = this.add.text(cx, bannerCY - 22, 'Bubble Popper', {
      fontSize: '54px', fontStyle: 'bold', color: '#d4e868',
      stroke: '#1e3810', strokeThickness: 5,
      shadow: { offsetX: 2, offsetY: 4, color: '#0c1c06', blur: 6, stroke: true, fill: true },
    }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: title, y: bannerCY - 26, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Subtitle
    this.add.text(cx, bannerCY + 42, 'A colour-match puzzle game', {
      fontSize: '22px', color: '#a0c870', stroke: '#1e3810', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);
  }

  // ─── Decorative tile row ──────────────────────────────────────────────────

  private drawDecorTiles(): void {
    const cx = GAME_WIDTH / 2;
    const tileY = 430;
    const colorIds = [0, 1, 2, 3, 2, 1, 0];
    const spacing = 86;
    const startX = cx - (colorIds.length - 1) * spacing / 2;

    for (let i = 0; i < colorIds.length; i++) {
      const x = startX + i * spacing;
      const gfx = this.add.graphics().setPosition(x, tileY).setDepth(3);
      this.drawTileGfx(gfx, colorIds[i]);
      const delay = i * 130;
      this.tweens.add({
        targets: gfx, y: tileY - 5,
        duration: 1700 + i * 70, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay,
      });
    }

    this.add.text(cx, tileY + 62, 'Tap connected tiles of the same colour to pop them!', {
      fontSize: '18px', color: '#a0c870', stroke: '#1e3810', strokeThickness: 2, align: 'center',
      wordWrap: { width: 520 },
    }).setOrigin(0.5).setDepth(10);

    this.add.text(cx, tileY + 108, '10 hand-crafted levels', {
      fontSize: '20px', fontStyle: 'bold', color: '#d4e868', stroke: '#1e3810', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);
  }

  // ─── Tile rendering (mirrors GameScene) ──────────────────────────────────

  private drawTileGfx(g: Phaser.GameObjects.Graphics, colorId: number): void {
    const c = COLORS[colorId];
    const h = TILE_SIZE / 2;
    const r = 12;
    g.fillStyle(c.shadow, 0.52);
    g.fillRoundedRect(-h + 5, -h + 6, TILE_SIZE, TILE_SIZE, r);
    g.fillStyle(c.base, 1);
    g.fillRoundedRect(-h, -h, TILE_SIZE, TILE_SIZE, r);
    g.fillStyle(c.light, 0.42);
    g.fillRoundedRect(-h + 3, -h + 3, TILE_SIZE - 6, 15, { tl: r - 2, tr: r - 2, bl: 0, br: 0 });
    g.fillStyle(c.dark, 0.32);
    g.fillRoundedRect(-h + 4, h - 11, TILE_SIZE - 8, 9, { tl: 0, tr: 0, bl: r - 2, br: r - 2 });
    switch (colorId) {
      case 0: this.markGreen(g, h); break;
      case 1: this.markYellow(g, h, c); break;
      case 2: this.markBlue(g, c); break;
      case 3: this.markOrange(g, h, c); break;
    }
  }

  private markGreen(g: Phaser.GameObjects.Graphics, h: number): void {
    g.fillStyle(0x80d050, 0.68);
    g.fillCircle(-h + 20, -h + 18, 13);
    g.fillCircle(-h + 42, -h + 14, 11);
    g.fillCircle(-h + 63, -h + 18, 12);
    g.fillStyle(0x50a030, 0.48);
    g.fillRect(-h + 8, -h + 18, TILE_SIZE - 16, 9);
  }

  private markYellow(g: Phaser.GameObjects.Graphics, h: number, c: typeof COLORS[number]): void {
    const inset = 17;
    g.lineStyle(5, c.dark, 0.62);
    g.strokeRoundedRect(-h + inset, -h + inset, TILE_SIZE - inset * 2, TILE_SIZE - inset * 2, 6);
    g.fillStyle(c.inner, 0.25);
    g.fillRoundedRect(-h + inset + 3, -h + inset + 3, TILE_SIZE - (inset + 3) * 2, TILE_SIZE - (inset + 3) * 2, 4);
  }

  private markBlue(g: Phaser.GameObjects.Graphics, c: typeof COLORS[number]): void {
    g.fillStyle(c.inner, 1); g.fillCircle(1, 5, 24);
    g.fillStyle(c.light, 0.52); g.fillCircle(-6, -2, 11);
    g.fillStyle(0xffffff, 0.26); g.fillCircle(-9, -7, 5);
  }

  private markOrange(g: Phaser.GameObjects.Graphics, h: number, c: typeof COLORS[number]): void {
    const bw = 22, ty = 17;
    g.fillStyle(c.dark, 0.70);
    g.fillTriangle(0, -ty, -bw, -h + ty + 5, bw, -h + ty + 5);
    g.fillTriangle(0, ty, -bw, h - ty - 5, bw, h - ty - 5);
    g.fillStyle(c.dark, 0.42);
    g.fillRect(-5, -ty, 10, ty * 2);
  }

  // ─── PLAY button ─────────────────────────────────────────────────────────

  private drawPlayButton(): void {
    const cx = GAME_WIDTH / 2;
    const btnY = 680;

    // buttonLong_beige_pressed.png from atlas — scale up to ~300×70
    // Native kenney frame is ~190×49 px
    const scaleX = 300 / 190;
    const scaleY = 70 / 49;

    const btnImg = this.add.image(cx, btnY, 'uipack_rpg_sheet', 'buttonLong_beige_pressed.png')
      .setScale(scaleX, scaleY)
      .setDepth(10)
      .setAlpha(0);

    // Text sits 3px lower to match the pressed-down visual offset of the frame
    const btnText = this.add.text(cx, btnY + 3, 'PLAY', {
      fontSize: '36px', fontStyle: 'bold',
      color: '#3a2408',
      stroke: '#c8a040', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(11).setAlpha(0);

    // Fade in
    this.tweens.add({ targets: [btnImg, btnText], alpha: 1, duration: 550, delay: 250 });

    // Interactive zone sized to match the scaled button
    const zone = this.add.zone(cx, btnY, 300, 70).setInteractive().setDepth(12);

    const onTap = (): void => {
      zone.removeInteractive();
      this.tweens.add({
        targets: [btnImg, btnText], scaleX: scaleX * 0.93, scaleY: scaleY * 0.93,
        duration: 90, yoyo: true,
        onComplete: () => {
          this.cameras.main.fadeOut(220, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('GameScene', { level: 0 });
          });
        },
      });
    };

    zone.on('pointerdown', onTap);
    zone.on('pointerover', () => {
      this.tweens.add({ targets: [btnImg, btnText], scaleX: scaleX * 1.06, scaleY: scaleY * 1.06, duration: 100 });
    });
    zone.on('pointerout', () => {
      this.tweens.add({ targets: [btnImg, btnText], scaleX, scaleY, duration: 100 });
    });
  }

  // ─── High score ──────────────────────────────────────────────────────────

  private async showHighScore(): Promise<void> {
    try {
      const u = await unboxyReady;
      if (!u) return;
      const hs = await u.saves.get<number>('highScore');
      if (hs != null && hs > 0) {
        const cx = GAME_WIDTH / 2;
        this.add.text(cx, 770, `Best score: ${hs}`, {
          fontSize: '22px', color: '#d4e868', stroke: '#1e3810', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(10);
      }
    } catch (e) { console.warn('Load high score failed', e); }
  }
}
