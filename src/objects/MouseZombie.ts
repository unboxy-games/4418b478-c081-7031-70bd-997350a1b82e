import Phaser from 'phaser';
import { WAYPOINTS } from '../config';

export class MouseZombie extends Phaser.GameObjects.Container {
  hp: number;
  readonly maxHp: number;
  private zombieSpeed: number;
  private waypointIndex = 1;
  private bodyGfx!: Phaser.GameObjects.Graphics;
  private hpBarGfx!: Phaser.GameObjects.Graphics;
  isDead = false;
  reachedEnd = false;
  readonly coinsReward: number;
  readonly enemyType: string;
  /** Damage multiplier for armored enemies */
  private armor: number;
  /** Slow effect: factor (0–1 speed multiplier) and remaining duration in ms */
  private slowFactor = 1.0;
  private slowTimer = 0;
  private slowGfx!: Phaser.GameObjects.Graphics;
  private burnDps = 0;
  private burnTimer = 0;
  private enrageTriggered = false;
  private speedMultiplier = 1.0;
  readonly isGhost: boolean;

  constructor(
    scene: Phaser.Scene,
    hp: number,
    speed: number,
    coins: number,
    enemyType = 'basic',
  ) {
    super(scene, WAYPOINTS[0].x, WAYPOINTS[0].y);
    this.hp = hp;
    this.maxHp = hp;
    this.zombieSpeed = speed;
    this.coinsReward = coins;
    this.enemyType = enemyType;
    this.armor = enemyType === 'armored' ? 0.5 : enemyType === 'boss' ? 0.75 : 1.0;
    this.isGhost = enemyType === 'ghost';

    this.bodyGfx = scene.make.graphics({ add: false } as Phaser.Types.GameObjects.Graphics.Options);
    this.hpBarGfx = scene.make.graphics({ add: false } as Phaser.Types.GameObjects.Graphics.Options);
    this.slowGfx  = scene.make.graphics({ add: false } as Phaser.Types.GameObjects.Graphics.Options);
    this.drawBody();
    this.drawHpBar();
    this.add([this.bodyGfx, this.slowGfx, this.hpBarGfx]);

    this.setDepth(1);
    scene.add.existing(this);
  }

  get pathProgress(): number {
    return this.waypointIndex;
  }

  private drawBody(): void {
    if (this.enemyType === 'speed') this.drawSpeedBody();
    else if (this.enemyType === 'brute') this.drawBruteBody();
    else if (this.enemyType === 'armored') this.drawArmoredBody();
    else if (this.enemyType === 'ghost') this.drawGhostBody();
    else if (this.enemyType === 'boss') this.drawBossBody();
    else if (this.enemyType === 'swarm') this.drawSwarmBody();
    else this.drawBasicBody();
  }

  private drawBasicBody(): void {
    const g = this.bodyGfx;
    g.clear();
    // Shadow
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(1, 17, 24, 7);
    // Body
    g.fillStyle(0x7a7a7a);
    g.fillCircle(0, 0, 14);
    // Ears
    g.fillStyle(0x9e9e9e);
    g.fillCircle(-9, -13, 5);
    g.fillCircle(9, -13, 5);
    // Ear inner
    g.fillStyle(0xffaaaa);
    g.fillCircle(-9, -13, 2.5);
    g.fillCircle(9, -13, 2.5);
    // Zombie glow aura
    g.fillStyle(0x00ff44, 0.15);
    g.fillCircle(0, 0, 18);
    // Eyes — glowing zombie green
    g.fillStyle(0x00ee44);
    g.fillCircle(-5, -2, 4);
    g.fillCircle(5, -2, 4);
    g.fillStyle(0x000000);
    g.fillCircle(-5, -2, 2);
    g.fillCircle(5, -2, 2);
    // Nose
    g.fillStyle(0xffaaaa);
    g.fillCircle(0, 3, 2);
    // Mouth (zigzag)
    g.lineStyle(1.5, 0x333333);
    g.beginPath();
    g.moveTo(-5, 8);
    g.lineTo(-2, 6);
    g.lineTo(1, 8);
    g.lineTo(4, 6);
    g.strokePath();
  }

  private drawSpeedBody(): void {
    const g = this.bodyGfx;
    g.clear();
    // Shadow - small
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(1, 13, 18, 5);
    // Speed trail
    g.lineStyle(2, 0x88ff88, 0.3);
    g.lineBetween(-18, -2, -10, -2);
    g.lineBetween(-16, 3, -10, 3);
    // Body - tan/brown, smaller
    g.fillStyle(0xaa7744);
    g.fillCircle(0, 0, 10);
    // Ears - large relative to body
    g.fillStyle(0xcc9966);
    g.fillCircle(-7, -10, 5);
    g.fillCircle(7, -10, 5);
    g.fillStyle(0xffccaa);
    g.fillCircle(-7, -10, 3);
    g.fillCircle(7, -10, 3);
    // Zombie glow
    g.fillStyle(0x00ff44, 0.12);
    g.fillCircle(0, 0, 14);
    // Eyes - small, bright green
    g.fillStyle(0x00ff44);
    g.fillCircle(-4, -1, 3);
    g.fillCircle(4, -1, 3);
    g.fillStyle(0x000000);
    g.fillCircle(-4, -1, 1.5);
    g.fillCircle(4, -1, 1.5);
    // Nose
    g.fillStyle(0xffaaaa);
    g.fillCircle(0, 3, 1.5);
    // Mouth
    g.lineStyle(1, 0x333333);
    g.beginPath();
    g.moveTo(-3, 6);
    g.lineTo(-1, 4);
    g.lineTo(1, 6);
    g.lineTo(3, 4);
    g.strokePath();
    // Long thin tail
    g.lineStyle(1.5, 0xcc9966);
    g.beginPath();
    g.moveTo(8, 5);
    g.lineTo(14, 8);
    g.lineTo(16, 4);
    g.lineTo(20, 6);
    g.strokePath();
  }

  private drawBruteBody(): void {
    const g = this.bodyGfx;
    g.clear();
    // Shadow - big
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(2, 22, 36, 10);
    // Zombie aura - sickly green
    g.fillStyle(0x00ff44, 0.12);
    g.fillCircle(0, 0, 24);
    // Body - large dark grey
    g.fillStyle(0x3d3d3d);
    g.fillCircle(0, 0, 19);
    // Scars
    g.lineStyle(2, 0x222222, 0.8);
    g.lineBetween(-8, -8, -3, -3);
    g.lineBetween(5, -10, 9, -5);
    g.lineBetween(-5, 5, -1, 9);
    // Ears - small stubby
    g.fillStyle(0x4a4a4a);
    g.fillCircle(-13, -14, 6);
    g.fillCircle(13, -14, 6);
    g.fillStyle(0xff6666);
    g.fillCircle(-13, -14, 3);
    g.fillCircle(13, -14, 3);
    // Eyes - angry red zombie
    g.fillStyle(0xff2200);
    g.fillCircle(-6, -3, 5);
    g.fillCircle(6, -3, 5);
    g.fillStyle(0x000000);
    g.fillCircle(-6, -3, 2.5);
    g.fillCircle(6, -3, 2.5);
    // Eye glow
    g.fillStyle(0xff4400, 0.4);
    g.fillCircle(-6, -3, 8);
    g.fillCircle(6, -3, 8);
    // Nose - flat
    g.fillStyle(0xffaaaa);
    g.fillEllipse(0, 4, 8, 5);
    // Mouth - bared teeth
    g.lineStyle(2, 0x111111);
    g.beginPath();
    g.moveTo(-8, 10);
    g.lineTo(8, 10);
    g.strokePath();
    g.fillStyle(0xeeeedd);
    g.fillRect(-7, 8, 4, 4);
    g.fillRect(-1, 8, 4, 4);
    g.fillRect(5, 8, 3, 4);
  }

  private drawArmoredBody(): void {
    const g = this.bodyGfx;
    g.clear();
    // Shadow
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(1, 18, 28, 8);
    // Base body (grey mouse)
    g.fillStyle(0x7a7a7a);
    g.fillCircle(0, 0, 14);
    // Ears
    g.fillStyle(0x9e9e9e);
    g.fillCircle(-9, -13, 5);
    g.fillCircle(9, -13, 5);
    g.fillStyle(0xffaaaa);
    g.fillCircle(-9, -13, 2.5);
    g.fillCircle(9, -13, 2.5);
    // Armor plates - teal/green metallic
    g.fillStyle(0x226655);
    g.fillRoundedRect(-12, -10, 24, 18, 3);
    // Armor rivets
    g.fillStyle(0x44aa88);
    g.fillCircle(-8, -6, 2);
    g.fillCircle(8, -6, 2);
    g.fillCircle(-8, 4, 2);
    g.fillCircle(8, 4, 2);
    // Armor highlight line
    g.lineStyle(1, 0x55ddbb, 0.8);
    g.lineBetween(-10, -4, 10, -4);
    // Shoulder plates
    g.fillStyle(0x1a5544);
    g.fillRect(-16, -6, 6, 10);
    g.fillRect(10, -6, 6, 10);
    // Zombie glow aura (muted under armor)
    g.fillStyle(0x00ff44, 0.08);
    g.fillCircle(0, 0, 18);
    // Eyes - zombie green (visible above armor)
    g.fillStyle(0x00ee44);
    g.fillCircle(-5, -4, 4);
    g.fillCircle(5, -4, 4);
    g.fillStyle(0x000000);
    g.fillCircle(-5, -4, 2);
    g.fillCircle(5, -4, 2);
    // Helmet
    g.fillStyle(0x1a5544);
    g.fillRoundedRect(-11, -20, 22, 10, 4);
    g.lineStyle(1, 0x55ddbb, 0.6);
    g.strokeRoundedRect(-11, -20, 22, 10, 4);
  }

  private drawGhostBody(): void {
    const g = this.bodyGfx;
    g.clear();
    // Ghostly aura glow
    g.fillStyle(0xaaddff, 0.12);
    g.fillCircle(0, 0, 22);
    g.fillStyle(0xcceeff, 0.18);
    g.fillCircle(0, 0, 16);
    // Body — pale translucent white/blue
    g.fillStyle(0xddeeff, 0.65);
    g.fillCircle(0, 0, 13);
    // Ghost wisps at bottom (tail-like)
    g.fillStyle(0xbbddff, 0.5);
    g.fillEllipse(-6, 14, 8, 10);
    g.fillEllipse(0, 16, 8, 10);
    g.fillEllipse(6, 14, 8, 10);
    // Ears — barely visible
    g.fillStyle(0xeef6ff, 0.5);
    g.fillCircle(-8, -12, 5);
    g.fillCircle(8, -12, 5);
    // Eyes — eerie glowing blue-white
    g.fillStyle(0x88ccff, 0.9);
    g.fillCircle(-5, -2, 5);
    g.fillCircle(5, -2, 5);
    g.fillStyle(0xffffff);
    g.fillCircle(-5, -2, 2.5);
    g.fillCircle(5, -2, 2.5);
    // Glow rings around eyes
    g.lineStyle(1, 0x88eeff, 0.6);
    g.strokeCircle(-5, -2, 6);
    g.strokeCircle(5, -2, 6);
    // Mouth — wavy ghost mouth
    g.lineStyle(1.5, 0xaaccff, 0.6);
    g.beginPath();
    g.moveTo(-5, 7);
    g.lineTo(-2, 5);
    g.lineTo(0, 7);
    g.lineTo(2, 5);
    g.lineTo(5, 7);
    g.strokePath();
  }

  private drawBossBody(): void {
    const g = this.bodyGfx;
    g.clear();
    // Shadow — huge
    g.fillStyle(0x000000, 0.45);
    g.fillEllipse(2, 28, 52, 14);
    // Dark evil aura
    g.fillStyle(0x440066, 0.2);
    g.fillCircle(0, 0, 32);
    g.fillStyle(0x880099, 0.12);
    g.fillCircle(0, 0, 28);
    // Body — huge dark purple
    g.fillStyle(0x330044);
    g.fillCircle(0, 0, 24);
    // Body highlight
    g.fillStyle(0x550066);
    g.fillCircle(-4, -6, 16);
    // Battle scars
    g.lineStyle(2.5, 0x220033, 0.9);
    g.lineBetween(-12, -12, -4, -4);
    g.lineBetween(6, -14, 12, -6);
    g.lineBetween(-8, 6, -2, 12);
    g.lineBetween(4, 8, 10, 3);
    // Ears — large demonic
    g.fillStyle(0x440055);
    g.fillTriangle(-18, -18, -8, -18, -16, -36);
    g.fillTriangle(18, -18, 8, -18, 16, -36);
    g.fillStyle(0xcc00ff, 0.4);
    g.fillTriangle(-16, -20, -10, -20, -14, -32);
    g.fillTriangle(16, -20, 10, -20, 14, -32);
    // Crown (boss indicator)
    g.fillStyle(0xffcc00);
    g.fillTriangle(-14, -30, -10, -38, -6, -30);
    g.fillTriangle(-3, -30, 0, -40, 3, -30);
    g.fillTriangle(6, -30, 10, -38, 14, -30);
    g.fillRect(-15, -30, 30, 5);
    g.fillStyle(0xff4400);
    g.fillCircle(-10, -34, 2);
    g.fillCircle(0, -37, 2.5);
    g.fillCircle(10, -34, 2);
    // Eyes — terrifying red-purple glow
    g.fillStyle(0xff00ff, 0.3);
    g.fillCircle(-7, -4, 10);
    g.fillCircle(7, -4, 10);
    g.fillStyle(0xff00cc);
    g.fillCircle(-7, -4, 6);
    g.fillCircle(7, -4, 6);
    g.fillStyle(0x000000);
    g.fillCircle(-7, -4, 3);
    g.fillCircle(7, -4, 3);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(-6, -5, 1.5);
    g.fillCircle(8, -5, 1.5);
    // Nose
    g.fillStyle(0xcc44cc);
    g.fillEllipse(0, 5, 8, 5);
    // Mouth — huge fangs
    g.lineStyle(2, 0x110022);
    g.beginPath();
    g.moveTo(-10, 12);
    g.lineTo(10, 12);
    g.strokePath();
    g.fillStyle(0xeeeedd);
    g.fillRect(-9, 10, 5, 6);
    g.fillRect(-2, 10, 5, 6);
    g.fillRect(5, 10, 4, 6);
    // Fang tips
    g.fillStyle(0xffffff);
    g.fillTriangle(-9, 16, -6, 16, -7.5, 20);
    g.fillTriangle(-2, 16, 1, 16, -0.5, 20);
    g.fillTriangle(5, 16, 8, 16, 6.5, 20);
  }

  private drawSwarmBody(): void {
    const g = this.bodyGfx;
    g.clear();
    // Shadow — tiny
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(0, 10, 14, 4);
    // Body — tiny yellow-brown
    g.fillStyle(0xcc9900);
    g.fillCircle(0, 0, 8);
    // Ears — small
    g.fillStyle(0xddaa22);
    g.fillCircle(-5, -8, 4);
    g.fillCircle(5, -8, 4);
    g.fillStyle(0xffccaa);
    g.fillCircle(-5, -8, 2);
    g.fillCircle(5, -8, 2);
    // Zombie glow — yellow-green tint
    g.fillStyle(0xaaff44, 0.12);
    g.fillCircle(0, 0, 11);
    // Eyes — tiny zombie
    g.fillStyle(0xaaff44);
    g.fillCircle(-3, -1, 2.5);
    g.fillCircle(3, -1, 2.5);
    g.fillStyle(0x000000);
    g.fillCircle(-3, -1, 1);
    g.fillCircle(3, -1, 1);
    // Nose
    g.fillStyle(0xffccaa);
    g.fillCircle(0, 2, 1.5);
    // Tail — long relative to body
    g.lineStyle(1.5, 0xcc9900);
    g.beginPath();
    g.moveTo(6, 4);
    g.lineTo(10, 7);
    g.lineTo(12, 4);
    g.lineTo(15, 6);
    g.strokePath();
  }

  private drawHpBar(): void {
    const g = this.hpBarGfx;
    g.clear();
    const w = this.enemyType === 'boss' ? 48 : this.enemyType === 'brute' ? 36 : 28;
    const h = 4;
    const bx = -w / 2;
    const by = this.enemyType === 'boss' ? 32 : this.enemyType === 'brute' ? 26 : 20;
    g.fillStyle(0x111111);
    g.fillRect(bx, by, w, h);
    const pct = Math.max(0, this.hp / this.maxHp);
    const color = pct > 0.6 ? 0x00cc00 : pct > 0.3 ? 0xcccc00 : 0xcc0000;
    g.fillStyle(color);
    g.fillRect(bx, by, Math.floor(w * pct), h);
    // Armor indicator
    if (this.enemyType === 'armored') {
      g.fillStyle(0x44aa88, 0.8);
      g.fillRect(bx, by + 5, w, 2);
    }
  }

  /** Apply a speed-slow effect. A lower factor = slower. Stacks by keeping the worst. */
  applySlow(factor: number, durationMs: number): void {
    if (this.isDead) return;
    // Accept if no current slow or this one is stronger / longer
    if (factor < this.slowFactor || this.slowTimer <= 0) {
      this.slowFactor = factor;
    }
    if (durationMs > this.slowTimer) {
      this.slowTimer = durationMs;
    }
    this.drawSlowGfx(true);
  }

  applyBurn(dps: number, durationMs: number): void {
    if (this.isDead) return;
    if (dps > this.burnDps || durationMs > this.burnTimer) {
      this.burnDps = Math.max(this.burnDps, dps);
      this.burnTimer = Math.max(this.burnTimer, durationMs);
    }
  }

  private drawSlowGfx(show: boolean): void {
    this.slowGfx.clear();
    if (!show) return;
    const r = this.enemyType === 'boss' ? 30 : this.enemyType === 'brute' ? 24 : this.enemyType === 'speed' ? 14 : this.enemyType === 'swarm' ? 12 : 18;
    // Electric blue aura
    this.slowGfx.fillStyle(0x00aaff, 0.18);
    this.slowGfx.fillCircle(0, 0, r + 4);
    this.slowGfx.lineStyle(1.5, 0x44ddff, 0.85);
    this.slowGfx.strokeCircle(0, 0, r + 4);
    // Zigzag arcs
    this.slowGfx.lineStyle(1.5, 0x00ffff, 0.9);
    this.slowGfx.lineBetween(-r, -4, -r + 6, -8);
    this.slowGfx.lineBetween(-r + 6, -8, -r, -12);
    this.slowGfx.lineBetween(r, -4, r - 6, -8);
    this.slowGfx.lineBetween(r - 6, -8, r, -12);
    this.slowGfx.lineBetween(-4, -r, -8, -r + 6);
    this.slowGfx.lineBetween(-8, -r + 6, -4, -r + 12);
  }

  takeDamage(dmg: number): void {
    if (this.isDead) return;
    const actualDmg = Math.ceil(dmg * this.armor);
    // Ghost evasion: 50% chance to dodge
    if (this.isGhost && Math.random() < 0.5) return;
    this.hp = Math.max(0, this.hp - actualDmg);
    // Boss enrage at 50% HP
    if (this.enemyType === 'boss' && !this.enrageTriggered && this.hp <= this.maxHp * 0.5) {
      this.enrageTriggered = true;
      this.speedMultiplier = 1.75;
    }
    this.drawHpBar();
    if (this.hp <= 0) {
      this.isDead = true;
    }
  }

  // Returns true when zombie reaches the base
  step(delta: number): boolean {
    if (this.isDead || this.reachedEnd) return false;

    // Tick down slow timer
    if (this.slowTimer > 0) {
      this.slowTimer -= delta;
      if (this.slowTimer <= 0) {
        this.slowTimer = 0;
        this.slowFactor = 1.0;
        this.drawSlowGfx(false);
      }
    }

    // Burn tick
    if (this.burnTimer > 0) {
      this.burnTimer -= delta;
      // Apply burn damage as DPS (damage each tick based on elapsed delta)
      const burnDmgThisTick = this.burnDps * (delta / 1000);
      this.hp = Math.max(0, this.hp - burnDmgThisTick);
      this.drawHpBar();
      if (this.hp <= 0) {
        this.isDead = true;
        return false;
      }
      if (this.burnTimer <= 0) {
        this.burnTimer = 0;
        this.burnDps = 0;
      }
    }

    const target = WAYPOINTS[this.waypointIndex];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const effectiveDelta = delta * (this.slowTimer > 0 ? this.slowFactor : 1.0);
    const move = this.zombieSpeed * this.speedMultiplier * (effectiveDelta / 1000);

    if (dist <= move) {
      this.x = target.x;
      this.y = target.y;
      this.waypointIndex++;
      if (this.waypointIndex >= WAYPOINTS.length) {
        this.reachedEnd = true;
        return true;
      }
    } else {
      this.x += (dx / dist) * move;
      this.y += (dy / dist) * move;
    }
    return false;
  }
}
