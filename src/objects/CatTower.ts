import Phaser from 'phaser';
import { Bullet } from './Bullet';
import { MouseZombie } from './MouseZombie';
import { CELL, TOWER_CONFIGS } from '../config';
import { audioManager } from '../audio/AudioManager';

export class CatTower extends Phaser.GameObjects.Container {
  readonly col: number;
  readonly row: number;
  readonly towerType: string;
  private towerRange: number;
  private fireRate: number;
  private damage: number;
  private lastFired = 0;
  private catGfx!: Phaser.GameObjects.Graphics;
  private rangeGfx!: Phaser.GameObjects.Graphics;
  private levelGfx!: Phaser.GameObjects.Graphics;

  /** Current upgrade level: 1 = base, 2 = upgraded once, 3 = max */
  level = 1;
  /** Total coins spent on this tower (placement + upgrades) — used for sell refund */
  totalSpent: number;

  constructor(scene: Phaser.Scene, col: number, row: number, towerType = 'basic') {
    super(scene, col * CELL + CELL / 2, row * CELL + CELL / 2);
    this.col = col;
    this.row = row;
    this.towerType = towerType;

    const cfg = TOWER_CONFIGS[towerType];
    this.towerRange = cfg.range;
    this.fireRate = cfg.fireRate;
    this.damage = cfg.damage;
    this.totalSpent = cfg.cost;

    // Range indicator (shown on hover)
    this.rangeGfx = scene.make.graphics({ add: false } as Phaser.Types.GameObjects.Graphics.Options);
    this.rangeGfx.setVisible(false);
    this.add(this.rangeGfx);
    this.redrawRange();

    // Cat graphic
    this.catGfx = scene.make.graphics({ add: false } as Phaser.Types.GameObjects.Graphics.Options);
    this.drawCat();
    this.add(this.catGfx);

    // Level badge (upgrade indicator diamonds)
    this.levelGfx = scene.make.graphics({ add: false } as Phaser.Types.GameObjects.Graphics.Options);
    this.drawLevelBadge();
    this.add(this.levelGfx);

    this.setDepth(2);
    this.setSize(CELL, CELL);
    this.setInteractive();
    this.on('pointerover', () => this.rangeGfx.setVisible(true));
    this.on('pointerout', () => this.rangeGfx.setVisible(false));

    scene.add.existing(this);
  }

  private drawCat(): void {
    if (this.towerType === 'sniper') this.drawSniperCat();
    else if (this.towerType === 'rapid') this.drawRapidCat();
    else if (this.towerType === 'bomb') this.drawBombCat();
    else if (this.towerType === 'taser') this.drawTaserCat();
    else if (this.towerType === 'freeze') this.drawFreezeCat();
    else if (this.towerType === 'flame') this.drawFlameCat();
    else if (this.towerType === 'trap') this.drawTrapCat();
    else this.drawBasicCat();
  }

  private drawBasicCat(): void {
    const g = this.catGfx;
    g.clear();
    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(1, 16, 26, 7);
    // Body
    g.fillStyle(0xff8c00);
    g.fillRoundedRect(-13, -8, 26, 22, 4);
    // Body stripes
    g.lineStyle(1.5, 0xcc6600, 0.5);
    g.lineBetween(-4, -5, -4, 11);
    g.lineBetween(0, -6, 0, 12);
    g.lineBetween(4, -5, 4, 11);
    // Head
    g.fillStyle(0xff8c00);
    g.fillCircle(0, -18, 14);
    // Ears (triangles)
    g.fillStyle(0xff8c00);
    g.fillTriangle(-14, -23, -5, -23, -12, -35);
    g.fillTriangle(14, -23, 5, -23, 12, -35);
    // Ear inner
    g.fillStyle(0xff6600);
    g.fillTriangle(-12, -24, -7, -24, -11, -31);
    g.fillTriangle(12, -24, 7, -24, 11, -31);
    // Muzzle
    g.fillStyle(0xffcc88);
    g.fillEllipse(0, -15, 14, 9);
    // Eyes
    g.fillStyle(0x44ff88);
    g.fillEllipse(-6, -21, 7, 8);
    g.fillEllipse(6, -21, 7, 8);
    // Pupils (vertical slits)
    g.fillStyle(0x000000);
    g.fillEllipse(-6, -21, 3, 7);
    g.fillEllipse(6, -21, 3, 7);
    // Nose
    g.fillStyle(0xff6699);
    g.fillTriangle(-3, -14, 3, -14, 0, -12);
    // Whiskers
    g.lineStyle(1, 0xffffff, 0.85);
    g.lineBetween(-6, -14, -17, -16);
    g.lineBetween(-6, -13, -17, -13);
    g.lineBetween(6, -14, 17, -16);
    g.lineBetween(6, -13, 17, -13);
    // Tail
    g.lineStyle(3, 0xff8c00);
    g.beginPath();
    g.moveTo(12, 10);
    g.lineTo(17, 16);
    g.lineTo(14, 20);
    g.strokePath();
  }

  private drawSniperCat(): void {
    const g = this.catGfx;
    g.clear();
    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(1, 16, 26, 7);
    // Body - dark blue/navy
    g.fillStyle(0x1a3088);
    g.fillRoundedRect(-13, -8, 26, 22, 4);
    // Body subtle stripes
    g.lineStyle(1.5, 0x112266, 0.6);
    g.lineBetween(-4, -5, -4, 11);
    g.lineBetween(4, -5, 4, 11);
    // Head
    g.fillStyle(0x1a3088);
    g.fillCircle(0, -18, 14);
    // Ears - pointed
    g.fillStyle(0x1a3088);
    g.fillTriangle(-14, -23, -5, -23, -12, -36);
    g.fillTriangle(14, -23, 5, -23, 12, -36);
    g.fillStyle(0x112266);
    g.fillTriangle(-12, -24, -7, -24, -11, -32);
    g.fillTriangle(12, -24, 7, -24, 11, -32);
    // Muzzle
    g.fillStyle(0x3355aa);
    g.fillEllipse(0, -15, 14, 9);
    // Eyes - golden scope-like
    g.fillStyle(0xffcc00);
    g.fillEllipse(-6, -21, 7, 8);
    g.fillEllipse(6, -21, 7, 8);
    g.fillStyle(0x000000);
    g.fillEllipse(-6, -21, 3, 7);
    g.fillEllipse(6, -21, 3, 7);
    // Highlight
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(-5, -22, 1.5);
    g.fillCircle(7, -22, 1.5);
    // Nose
    g.fillStyle(0xcc6699);
    g.fillTriangle(-3, -14, 3, -14, 0, -12);
    // Whiskers - longer
    g.lineStyle(1, 0xaaccff, 0.7);
    g.lineBetween(-6, -14, -19, -16);
    g.lineBetween(-6, -13, -19, -12);
    g.lineBetween(6, -14, 19, -16);
    g.lineBetween(6, -13, 19, -12);
    // Sniper rifle barrel (on top of head)
    g.fillStyle(0x445588);
    g.fillRect(-3, -36, 6, 12);
    g.fillStyle(0x2233aa);
    g.fillRect(-2, -50, 4, 16);
    // Scope on barrel
    g.fillStyle(0x88aadd);
    g.fillRect(-5, -46, 10, 6);
    // Scope lens glow
    g.fillStyle(0x88eeff, 0.9);
    g.fillCircle(0, -50, 3);
    g.fillStyle(0x44aaff, 0.5);
    g.fillCircle(0, -50, 5);
  }

  private drawRapidCat(): void {
    const g = this.catGfx;
    g.clear();
    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(1, 14, 22, 6);
    // Body - golden yellow, compact
    g.fillStyle(0xffcc00);
    g.fillRoundedRect(-11, -6, 22, 18, 4);
    // Energy stripes
    g.lineStyle(1.5, 0xff9900, 0.7);
    g.lineBetween(-3, -3, -3, 9);
    g.lineBetween(3, -3, 3, 9);
    // Head - slightly smaller
    g.fillStyle(0xffcc00);
    g.fillCircle(0, -16, 12);
    // Ears - very pointy / alert
    g.fillStyle(0xffcc00);
    g.fillTriangle(-12, -21, -4, -21, -10, -33);
    g.fillTriangle(12, -21, 4, -21, 10, -33);
    g.fillStyle(0xff9900);
    g.fillTriangle(-10, -22, -6, -22, -9, -29);
    g.fillTriangle(10, -22, 6, -22, 9, -29);
    // Muzzle
    g.fillStyle(0xffe077);
    g.fillEllipse(0, -13, 12, 8);
    // Eyes - bright red-orange, intense
    g.fillStyle(0xff4400);
    g.fillCircle(-5, -18, 4);
    g.fillCircle(5, -18, 4);
    g.fillStyle(0x000000);
    g.fillCircle(-5, -18, 2);
    g.fillCircle(5, -18, 2);
    // Eye highlights
    g.fillStyle(0xffffff);
    g.fillCircle(-4, -19, 1);
    g.fillCircle(6, -19, 1);
    // Nose
    g.fillStyle(0xff6699);
    g.fillTriangle(-2, -12, 2, -12, 0, -10);
    // Whiskers - short, angled up (alert)
    g.lineStyle(1, 0xffee88, 0.9);
    g.lineBetween(-5, -13, -15, -16);
    g.lineBetween(-5, -12, -14, -11);
    g.lineBetween(5, -13, 15, -16);
    g.lineBetween(5, -12, 14, -11);
    // Energy sparks on sides
    g.lineStyle(2, 0xff8800, 0.85);
    g.lineBetween(10, -3, 16, -8);
    g.lineBetween(10, 2, 17, 1);
    g.lineBetween(-10, -3, -16, -8);
    g.lineBetween(-10, 2, -17, 1);
    // Tail - short energetic
    g.lineStyle(2.5, 0xffcc00);
    g.beginPath();
    g.moveTo(10, 8);
    g.lineTo(15, 12);
    g.lineTo(12, 16);
    g.strokePath();
  }

  private drawBombCat(): void {
    const g = this.catGfx;
    g.clear();
    // Shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(1, 16, 28, 8);
    // Body — dark crimson/maroon
    g.fillStyle(0x7a1010);
    g.fillRoundedRect(-13, -8, 26, 22, 4);
    // Bandolier straps (diagonal lines across body)
    g.lineStyle(2, 0x440000, 0.8);
    g.lineBetween(-13, -2, 13, 8);
    g.lineBetween(-13, 4, 13, -2);
    // Head
    g.fillStyle(0x881818);
    g.fillCircle(0, -18, 14);
    // Ears — short, alert
    g.fillStyle(0x881818);
    g.fillTriangle(-14, -23, -5, -23, -11, -33);
    g.fillTriangle(14, -23, 5, -23, 11, -33);
    g.fillStyle(0x550000);
    g.fillTriangle(-12, -24, -7, -24, -10, -30);
    g.fillTriangle(12, -24, 7, -24, 10, -30);
    // Helmet — dark olive green military helmet
    g.fillStyle(0x3a4a10);
    g.fillEllipse(0, -26, 30, 14);
    g.fillRect(-15, -28, 30, 7);
    // Helmet rim
    g.lineStyle(1.5, 0x2a3a08);
    g.strokeRect(-16, -29, 32, 8);
    // Muzzle
    g.fillStyle(0xaa5555);
    g.fillEllipse(0, -15, 14, 9);
    // Eyes — fierce orange glow
    g.fillStyle(0xff6600);
    g.fillEllipse(-5, -21, 7, 8);
    g.fillEllipse(5, -21, 7, 8);
    g.fillStyle(0x000000);
    g.fillEllipse(-5, -21, 3, 7);
    g.fillEllipse(5, -21, 3, 7);
    g.fillStyle(0xffcc00, 0.8);
    g.fillCircle(-4, -22, 1.5);
    g.fillCircle(6, -22, 1.5);
    // Nose
    g.fillStyle(0xff6699);
    g.fillTriangle(-3, -14, 3, -14, 0, -12);
    // Whiskers
    g.lineStyle(1, 0xddaaaa, 0.8);
    g.lineBetween(-6, -14, -17, -16);
    g.lineBetween(-6, -13, -17, -13);
    g.lineBetween(6, -14, 17, -16);
    g.lineBetween(6, -13, 17, -13);
    // Bomb held overhead (right paw raised)
    // Bomb body
    g.fillStyle(0x111111);
    g.fillCircle(14, -30, 7);
    g.lineStyle(1.5, 0x333333);
    g.strokeCircle(14, -30, 7);
    // Bomb shine
    g.fillStyle(0x555555, 0.5);
    g.fillCircle(11, -33, 3);
    // Fuse cord
    g.lineStyle(2, 0x8B4513);
    g.beginPath();
    g.moveTo(14, -37);
    g.lineTo(16, -43);
    g.lineTo(18, -46);
    g.strokePath();
    // Fuse spark
    g.fillStyle(0xff8800);
    g.fillCircle(18, -46, 3);
    g.fillStyle(0xffee00, 0.9);
    g.fillCircle(18, -46, 1.5);
    // Arm holding bomb
    g.lineStyle(3, 0x7a1010);
    g.lineBetween(8, -5, 14, -23);
    // Tail
    g.lineStyle(3, 0x881818);
    g.beginPath();
    g.moveTo(12, 10);
    g.lineTo(17, 16);
    g.lineTo(14, 20);
    g.strokePath();
  }

  private drawTaserCat(): void {
    const g = this.catGfx;
    g.clear();
    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(1, 16, 26, 7);
    // Body — silver white with blue sheen
    g.fillStyle(0xddeeff);
    g.fillRoundedRect(-13, -8, 26, 22, 4);
    // Body electric stripe highlights
    g.lineStyle(1.5, 0x00ccff, 0.55);
    g.lineBetween(-4, -5, -4, 11);
    g.lineBetween(4, -5, 4, 11);
    // Head
    g.fillStyle(0xddeeff);
    g.fillCircle(0, -18, 14);
    // Ears — alert/pointed
    g.fillStyle(0xddeeff);
    g.fillTriangle(-14, -23, -5, -23, -12, -35);
    g.fillTriangle(14, -23, 5, -23, 12, -35);
    // Ear inner — electric cyan
    g.fillStyle(0x00ccff);
    g.fillTriangle(-12, -24, -7, -24, -11, -31);
    g.fillTriangle(12, -24, 7, -24, 11, -31);
    // Muzzle
    g.fillStyle(0xeef8ff);
    g.fillEllipse(0, -15, 14, 9);
    // Eyes — glowing electric cyan
    g.fillStyle(0x00ffff);
    g.fillEllipse(-6, -21, 7, 8);
    g.fillEllipse(6, -21, 7, 8);
    // Eye glow rings
    g.fillStyle(0x00aaff, 0.35);
    g.fillCircle(-6, -21, 7);
    g.fillCircle(6, -21, 7);
    // Pupils
    g.fillStyle(0x000000);
    g.fillEllipse(-6, -21, 3, 7);
    g.fillEllipse(6, -21, 3, 7);
    // Eye highlights
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(-5, -22, 1.5);
    g.fillCircle(7, -22, 1.5);
    // Nose
    g.fillStyle(0xff88aa);
    g.fillTriangle(-3, -14, 3, -14, 0, -12);
    // Whiskers — electric blue tint
    g.lineStyle(1, 0x88eeff, 0.9);
    g.lineBetween(-6, -14, -17, -16);
    g.lineBetween(-6, -13, -17, -13);
    g.lineBetween(6, -14, 17, -16);
    g.lineBetween(6, -13, 17, -13);
    // Electric arcs on sides of body
    g.lineStyle(2, 0x00ffff, 0.85);
    g.lineBetween(12, -4, 18, -9);
    g.lineBetween(18, -9, 14, -14);
    g.lineBetween(-12, -4, -18, -9);
    g.lineBetween(-18, -9, -14, -14);
    // Secondary sparks
    g.lineStyle(1.5, 0x44ddff, 0.7);
    g.lineBetween(12, 4, 17, 1);
    g.lineBetween(-12, 4, -17, 1);
    // Lightning bolt held overhead (left paw raised)
    // Bolt body — jagged yellow/white shape
    g.fillStyle(0xffee00);
    g.fillTriangle(-5, -32, 1, -32, -2, -40);   // top tip
    g.fillTriangle(-2, -40, 4, -40, -1, -48);   // upper
    g.fillRect(-4, -38, 8, 8);                   // mid bar
    g.fillStyle(0xffffff, 0.7);
    g.fillTriangle(-3, -33, 0, -33, -2, -38);   // highlight
    // Bolt glow
    g.fillStyle(0x00ffff, 0.25);
    g.fillCircle(-1, -40, 12);
    // Arm holding bolt
    g.lineStyle(3, 0xbbddff);
    g.lineBetween(-8, -5, -6, -25);
    // Tail — pale with cyan tip
    g.lineStyle(3, 0xbbddff);
    g.beginPath();
    g.moveTo(12, 10);
    g.lineTo(17, 16);
    g.lineTo(14, 20);
    g.strokePath();
    g.fillStyle(0x00ccff);
    g.fillCircle(14, 20, 3);
  }

  private drawFreezeCat(): void {
    const g = this.catGfx;
    g.clear();
    // Shadow
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(1, 16, 26, 7);
    // Body — ice blue
    g.fillStyle(0x99ccee);
    g.fillRoundedRect(-13, -8, 26, 22, 4);
    // Frost crystal pattern on body
    g.lineStyle(1, 0xddeeff, 0.5);
    g.lineBetween(-8, -2, -8, 8);
    g.lineBetween(-8, 3, -4, -1);
    g.lineBetween(-8, 3, -4, 7);
    g.lineBetween(8, -2, 8, 8);
    g.lineBetween(8, 3, 4, -1);
    g.lineBetween(8, 3, 4, 7);
    // Head
    g.fillStyle(0x99ccee);
    g.fillCircle(0, -18, 14);
    // Ears — frosty pointed
    g.fillStyle(0x99ccee);
    g.fillTriangle(-14, -23, -5, -23, -12, -36);
    g.fillTriangle(14, -23, 5, -23, 12, -36);
    g.fillStyle(0xbbddff);
    g.fillTriangle(-12, -24, -7, -24, -11, -32);
    g.fillTriangle(12, -24, 7, -24, 11, -32);
    // Muzzle
    g.fillStyle(0xbbddff);
    g.fillEllipse(0, -15, 14, 9);
    // Eyes — pale blue glow
    g.fillStyle(0xccffff);
    g.fillEllipse(-6, -21, 7, 8);
    g.fillEllipse(6, -21, 7, 8);
    g.fillStyle(0x000000);
    g.fillEllipse(-6, -21, 3, 7);
    g.fillEllipse(6, -21, 3, 7);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(-5, -22, 1.5);
    g.fillCircle(7, -22, 1.5);
    // Nose
    g.fillStyle(0xffbbcc);
    g.fillTriangle(-3, -14, 3, -14, 0, -12);
    // Whiskers
    g.lineStyle(1, 0xddeeff, 0.8);
    g.lineBetween(-6, -14, -17, -16);
    g.lineBetween(-6, -13, -17, -13);
    g.lineBetween(6, -14, 17, -16);
    g.lineBetween(6, -13, 17, -13);
    // Snowflake held overhead
    g.lineStyle(2.5, 0xeeffff, 0.95);
    g.lineBetween(-2, -30, -2, -48);
    g.lineBetween(-11, -39, 7, -39);
    g.lineBetween(-9, -33, 5, -45);
    g.lineBetween(-9, -45, 5, -33);
    // Snowflake tips
    g.lineStyle(1.5, 0xccffff, 0.8);
    g.lineBetween(-2, -30, -5, -27);
    g.lineBetween(-2, -30, 1, -27);
    g.lineBetween(-2, -48, -5, -51);
    g.lineBetween(-2, -48, 1, -51);
    // Ice crystal aura
    g.fillStyle(0xaaddff, 0.15);
    g.fillCircle(-2, -39, 14);
    // Arm holding snowflake
    g.lineStyle(3, 0x88bbdd);
    g.lineBetween(-8, -5, -5, -25);
    // Tail
    g.lineStyle(3, 0x99ccee);
    g.beginPath();
    g.moveTo(12, 10);
    g.lineTo(17, 16);
    g.lineTo(14, 20);
    g.strokePath();
    g.fillStyle(0xccffff);
    g.fillCircle(14, 20, 3);
  }

  private drawFlameCat(): void {
    const g = this.catGfx;
    g.clear();
    // Shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(1, 16, 28, 8);
    // Heat aura
    g.fillStyle(0xff4400, 0.1);
    g.fillCircle(0, -12, 22);
    // Body — dark orange-red
    g.fillStyle(0xdd3300);
    g.fillRoundedRect(-13, -8, 26, 22, 4);
    // Flame lick lines on body
    g.lineStyle(2, 0xff7700, 0.7);
    g.lineBetween(-4, -8, -6, -14);
    g.lineBetween(0, -8, 0, -16);
    g.lineBetween(4, -8, 6, -14);
    // Head
    g.fillStyle(0xdd3300);
    g.fillCircle(0, -18, 14);
    // Ears — short, tips glowing
    g.fillStyle(0xdd3300);
    g.fillTriangle(-14, -23, -5, -23, -11, -33);
    g.fillTriangle(14, -23, 5, -23, 11, -33);
    g.fillStyle(0xffaa00);
    g.fillTriangle(-12, -24, -7, -24, -10, -30);
    g.fillTriangle(12, -24, 7, -24, 10, -30);
    // Muzzle
    g.fillStyle(0xee5533);
    g.fillEllipse(0, -15, 14, 9);
    // Eyes — burning ember orange
    g.fillStyle(0xffaa00);
    g.fillEllipse(-6, -21, 7, 8);
    g.fillEllipse(6, -21, 7, 8);
    g.fillStyle(0x000000);
    g.fillEllipse(-6, -21, 3, 7);
    g.fillEllipse(6, -21, 3, 7);
    g.fillStyle(0xffee44, 0.9);
    g.fillCircle(-5, -22, 1.5);
    g.fillCircle(7, -22, 1.5);
    // Nose
    g.fillStyle(0xff8866);
    g.fillTriangle(-3, -14, 3, -14, 0, -12);
    // Whiskers — singed, orange tint
    g.lineStyle(1, 0xffaa44, 0.9);
    g.lineBetween(-6, -14, -17, -16);
    g.lineBetween(-6, -13, -17, -13);
    g.lineBetween(6, -14, 17, -16);
    g.lineBetween(6, -13, 17, -13);
    // Flame jet held forward (right paw)
    // Flame base
    g.fillStyle(0xff2200, 0.8);
    g.fillEllipse(20, -28, 14, 10);
    g.fillStyle(0xff8800, 0.9);
    g.fillEllipse(26, -31, 10, 8);
    g.fillStyle(0xffee00, 0.85);
    g.fillEllipse(31, -33, 7, 6);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(34, -35, 2.5);
    // Flamethrower nozzle/arm
    g.lineStyle(4, 0xaa2200);
    g.lineBetween(8, -5, 20, -25);
    g.fillStyle(0x882200);
    g.fillRect(16, -30, 8, 5);
    // Tail — fiery
    g.lineStyle(3, 0xff6600);
    g.beginPath();
    g.moveTo(12, 10);
    g.lineTo(17, 16);
    g.lineTo(14, 20);
    g.strokePath();
    g.fillStyle(0xffaa00);
    g.fillCircle(14, 20, 3);
  }

  private drawTrapCat(): void {
    const g = this.catGfx;
    g.clear();
    // Shadow
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(1, 16, 26, 7);
    // Body — forest green/khaki
    g.fillStyle(0x335522);
    g.fillRoundedRect(-13, -8, 26, 22, 4);
    // Camouflage pattern
    g.fillStyle(0x224411, 0.8);
    g.fillEllipse(-5, 0, 10, 8);
    g.fillEllipse(5, 6, 8, 6);
    g.fillEllipse(-2, 9, 12, 6);
    // Head
    g.fillStyle(0x335522);
    g.fillCircle(0, -18, 14);
    // Ears
    g.fillStyle(0x335522);
    g.fillTriangle(-14, -23, -5, -23, -12, -35);
    g.fillTriangle(14, -23, 5, -23, 12, -35);
    g.fillStyle(0x224411);
    g.fillTriangle(-12, -24, -7, -24, -11, -31);
    g.fillTriangle(12, -24, 7, -24, 11, -31);
    // Goggles/visor (tactical look)
    g.fillStyle(0x113300, 0.9);
    g.fillRoundedRect(-10, -25, 20, 10, 3);
    g.lineStyle(1.5, 0x44aa22);
    g.strokeRoundedRect(-10, -25, 20, 10, 3);
    // Goggle lenses
    g.fillStyle(0x44ff44, 0.6);
    g.fillCircle(-5, -20, 4);
    g.fillCircle(5, -20, 4);
    g.fillStyle(0x88ff88, 0.4);
    g.fillCircle(-5, -20, 2);
    g.fillCircle(5, -20, 2);
    // Muzzle
    g.fillStyle(0x446633);
    g.fillEllipse(0, -15, 14, 9);
    // Nose
    g.fillStyle(0xff99aa);
    g.fillTriangle(-3, -14, 3, -14, 0, -12);
    // Whiskers — tactical short
    g.lineStyle(1, 0x88aa66, 0.8);
    g.lineBetween(-6, -14, -16, -15);
    g.lineBetween(-6, -13, -15, -13);
    g.lineBetween(6, -14, 16, -15);
    g.lineBetween(6, -13, 15, -13);
    // Mine/trap held in paw
    g.fillStyle(0x1a3311);
    g.fillCircle(14, -28, 9);
    g.lineStyle(2, 0x44ff44, 0.85);
    g.strokeCircle(14, -28, 9);
    // Mine detail
    g.fillStyle(0x44ff44);
    g.fillCircle(14, -28, 4);
    // Mine sensor prongs
    g.lineStyle(2, 0x88ff88, 0.9);
    g.lineBetween(14, -37, 14, -42);
    g.lineBetween(10, -35, 7, -39);
    g.lineBetween(18, -35, 21, -39);
    // Arm holding mine
    g.lineStyle(3, 0x335522);
    g.lineBetween(8, -5, 14, -19);
    // Tail
    g.lineStyle(3, 0x335522);
    g.beginPath();
    g.moveTo(12, 10);
    g.lineTo(17, 16);
    g.lineTo(14, 20);
    g.strokePath();
    g.fillStyle(0x44aa22);
    g.fillCircle(14, 20, 3);
  }

  // ── Public stat accessors ──────────────────────────────────────
  get currentDamage(): number { return this.damage; }
  get currentRange(): number { return this.towerRange; }
  get currentFireRateMs(): number { return this.fireRate; }

  /** Coin cost to upgrade to the next level (0 when already max level) */
  get upgradeCost(): number {
    if (this.level >= 3) return 0;
    return Math.floor(TOWER_CONFIGS[this.towerType].cost * 0.75);
  }

  /** Coins returned when selling this tower (60% of total spent) */
  get sellValue(): number {
    return Math.floor(this.totalSpent * 0.6);
  }

  /** Boost stats and redraw visuals. Called by GameScene after paying. */
  upgradeLevel(): void {
    this.level++;
    this.damage   = Math.ceil(this.damage * 1.35);
    this.towerRange = Math.ceil(this.towerRange * 1.10);
    this.fireRate = Math.floor(this.fireRate * 0.85);
    this.redrawRange();
    this.drawLevelBadge();
  }

  private redrawRange(): void {
    const cfg = TOWER_CONFIGS[this.towerType];
    this.rangeGfx.clear();
    this.rangeGfx.fillStyle(cfg.rangeColor, 0.1);
    this.rangeGfx.fillCircle(0, 0, this.towerRange);
    this.rangeGfx.lineStyle(1.5, cfg.rangeColor, 0.5);
    this.rangeGfx.strokeCircle(0, 0, this.towerRange);
  }

  private drawLevelBadge(): void {
    const g = this.levelGfx;
    g.clear();
    const upgrades = this.level - 1; // 0 for lv1, 1 for lv2, 2 for lv3
    if (upgrades <= 0) return;
    // Draw small diamonds below the cat body (local y ≈ 20-28)
    const spacing = 9;
    const startX = -(upgrades - 1) * spacing / 2;
    for (let i = 0; i < upgrades; i++) {
      // lv2 = gold, lv3 = purple
      g.fillStyle(upgrades >= 2 ? 0xdd88ff : 0xffee33);
      const cx = startX + i * spacing;
      g.fillTriangle(cx, 20, cx - 3.5, 24, cx, 28);
      g.fillTriangle(cx, 28, cx + 3.5, 24, cx, 20);
    }
  }

  step(time: number, zombies: MouseZombie[], bullets: Bullet[]): void {
    if (time - this.lastFired < this.fireRate) return;

    // Target: enemy furthest along the path (highest pathProgress) within range
    let bestTarget: MouseZombie | null = null;
    let bestProgress = -1;

    for (const z of zombies) {
      if (z.isDead || !z.active) continue;
      const dx = z.x - this.x;
      const dy = z.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.towerRange && z.pathProgress > bestProgress) {
        bestTarget = z;
        bestProgress = z.pathProgress;
      }
    }

    if (bestTarget) {
      this.lastFired = time;
      const allZombies = (this.towerType === 'bomb' || this.towerType === 'taser' || this.towerType === 'trap') ? zombies : undefined;
      const bullet = new Bullet(this.scene, this.x, this.y, bestTarget, this.damage, this.towerType, allZombies);
      bullets.push(bullet);
      audioManager.playShoot(this.towerType);
    }
  }
}
