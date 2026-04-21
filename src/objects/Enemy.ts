import Phaser from 'phaser';

export type EnemyType = 'mouse' | 'bug' | 'bird';

export interface EnemyConfig {
  hp: number;
  speed: number;
  gold: number;
}

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  mouse: { hp: 60,  speed: 80,  gold: 10 },
  bug:   { hp: 150, speed: 45,  gold: 25 },
  bird:  { hp: 35,  speed: 140, gold: 15 },
};

export class Enemy {
  static _nextId = 0;

  scene: Phaser.Scene;
  type: EnemyType;
  container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Container;
  private bodyG: Phaser.GameObjects.Graphics;
  private hpG: Phaser.GameObjects.Graphics;

  id: number;
  maxHp: number;
  hp: number;
  speed: number;
  gold: number;

  waypointIndex = 1;
  waypoints: { x: number; y: number }[];
  alive = true;
  reachedEnd = false;

  constructor(
    scene: Phaser.Scene,
    type: EnemyType,
    waypoints: { x: number; y: number }[],
    hpScale = 1
  ) {
    this.scene = scene;
    this.type = type;
    this.waypoints = waypoints;
    this.id = ++Enemy._nextId;

    const cfg = ENEMY_CONFIGS[type];
    this.maxHp = Math.round(cfg.hp * hpScale);
    this.hp = this.maxHp;
    this.speed = cfg.speed;
    this.gold = cfg.gold;

    this.bodyG = scene.add.graphics();
    this.hpG = scene.add.graphics();
    this.body = scene.add.container(0, 0, [this.bodyG]);

    this.container = scene.add.container(waypoints[0].x, waypoints[0].y, [
      this.body,
      this.hpG,
    ]);
    this.container.setDepth(2);

    this.drawBody();
    this.drawHp();
    this.setupAnimatedParts();

    // Gentle bob
    scene.tweens.add({
      targets: this.body,
      y: -4,
      duration: 480 + Math.random() * 220,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private drawBody(): void {
    const g = this.bodyG;
    g.clear();

    if (this.type === 'mouse') {
      // Body
      g.fillStyle(0xb8b8c8);
      g.fillEllipse(0, 4, 36, 28);
      // Ears
      g.fillStyle(0xd0d0e0);
      g.fillCircle(-12, -12, 10);
      g.fillCircle(10, -14, 10);
      g.fillStyle(0xffaabb);
      g.fillCircle(-12, -12, 6);
      g.fillCircle(10, -14, 6);
      // Face
      g.fillStyle(0xd8d8ea);
      g.fillEllipse(0, -4, 24, 18);
      // Eyes
      g.fillStyle(0x110011);
      g.fillCircle(-6, -6, 4);
      g.fillCircle(6, -6, 4);
      g.fillStyle(0xff3366);
      g.fillCircle(-6, -6, 2);
      g.fillCircle(6, -6, 2);
      g.fillStyle(0xffffff);
      g.fillCircle(-5, -8, 1.5);
      g.fillCircle(7, -8, 1.5);
      // Nose
      g.fillStyle(0xff9999);
      g.fillCircle(0, -1, 3);
      // Whiskers
      g.lineStyle(1.2, 0xaaaaaa, 0.9);
      g.lineBetween(-15, -2, -4, -1);
      g.lineBetween(-15, 2, -4, 1);
      g.lineBetween(4, -1, 15, -2);
      g.lineBetween(4, 1, 15, 2);
      // Tail drawn in setupAnimatedParts()
    } else if (this.type === 'bug') {
      // Abdomen
      g.fillStyle(0x1a8a1a);
      g.fillEllipse(0, 10, 22, 28);
      // Thorax
      g.fillStyle(0x22aa22);
      g.fillEllipse(0, -4, 20, 16);
      // Head
      g.fillStyle(0x33bb33);
      g.fillCircle(0, -16, 11);
      // Shell center line
      g.lineStyle(2, 0x006600);
      g.lineBetween(0, -1, 0, 22);
      // Shell spots
      g.fillStyle(0x006600, 0.5);
      g.fillCircle(-5, 8, 3.5);
      g.fillCircle(5, 8, 3.5);
      g.fillCircle(-5, 17, 3.5);
      g.fillCircle(5, 17, 3.5);
      // Eyes
      g.fillStyle(0xff2200);
      g.fillCircle(-5, -18, 4);
      g.fillCircle(5, -18, 4);
      g.fillStyle(0xffffff);
      g.fillCircle(-4, -19, 1.8);
      g.fillCircle(6, -19, 1.8);
      // Antennae + Legs drawn in setupAnimatedParts()
    } else {
      // Bird body
      g.fillStyle(0xffe066);
      g.fillCircle(0, 4, 17);
      // Head
      g.fillStyle(0xffcc00);
      g.fillCircle(-2, -10, 14);
      // Wings drawn in setupAnimatedParts()
      // Beak
      g.fillStyle(0xff7700);
      g.fillTriangle(-2, -6, 10, -10, -2, -14);
      // Eye
      g.fillStyle(0x111111);
      g.fillCircle(-8, -13, 4.5);
      g.fillStyle(0xffffff);
      g.fillCircle(-7, -14.5, 2);
      // Tail
      g.fillStyle(0xffaa00);
      g.fillTriangle(15, 4, 28, -2, 24, 12);
      g.fillStyle(0xff8800);
      g.fillTriangle(16, 9, 30, 8, 26, 17);
      // Crown
      g.fillStyle(0xff5500);
      g.fillTriangle(-6, -22, -4, -30, -2, -22);
      g.fillTriangle(-2, -23, 0, -31, 2, -23);
      g.fillTriangle(2, -22, 4, -29, 6, -22);
    }
  }

  private drawHp(): void {
    const pct = this.hp / this.maxHp;
    const w = 36;
    const h = 5;
    const x = -w / 2;
    const y = this.type === 'bug' ? -46 : -32;

    this.hpG.clear();
    this.hpG.fillStyle(0x330000);
    this.hpG.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 2);
    if (pct > 0) {
      const col =
        pct > 0.55 ? 0x44ff55 : pct > 0.28 ? 0xffcc00 : 0xff3333;
      this.hpG.fillStyle(col);
      this.hpG.fillRoundedRect(x, y, w * pct, h, 2);
    }
  }

  private setupAnimatedParts(): void {
    const scene = this.scene;

    if (this.type === 'mouse') {
      // Animated tail — separate container so it wags independently
      const tailG = scene.add.graphics();
      tailG.lineStyle(3.5, 0xbbbbcc);
      tailG.lineBetween(0, 0, 7, -5);
      tailG.lineBetween(7, -5, 9, -15);
      const tailCont = scene.add.container(15, 10, [tailG]);
      this.body.add(tailCont);

      scene.tweens.add({
        targets: tailCont,
        angle: 28,
        duration: 380,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 200,
      });

      // Waddle — gentle body lean when walking
      scene.tweens.add({
        targets: this.body,
        angle: 6,
        duration: 230,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

    } else if (this.type === 'bug') {
      // Animated antennae
      const antG = scene.add.graphics();
      antG.lineStyle(2, 0x005500);
      antG.lineBetween(-3, -24, -9, -34);
      antG.lineBetween(3, -24, 9, -34);
      antG.fillStyle(0x005500);
      antG.fillCircle(-9, -34, 3);
      antG.fillCircle(9, -34, 3);
      const antCont = scene.add.container(0, 0, [antG]);
      this.body.add(antCont);

      scene.tweens.add({
        targets: antCont,
        angle: 10,
        duration: 340,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Animated legs — scuttling squish cycle
      const legsG = scene.add.graphics();
      legsG.lineStyle(2, 0x117711);
      legsG.lineBetween(-10, -2, -21, -9);
      legsG.lineBetween(-10, 5, -22, 5);
      legsG.lineBetween(-10, 12, -21, 18);
      legsG.lineBetween(10, -2, 21, -9);
      legsG.lineBetween(10, 5, 22, 5);
      legsG.lineBetween(10, 12, 21, 18);
      const legsCont = scene.add.container(0, 0, [legsG]);
      // Insert at index 0 so legs render behind body
      this.body.addAt(legsCont, 0);

      scene.tweens.add({
        targets: legsCont,
        scaleX: 0.80,
        scaleY: 1.15,
        duration: 190,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

    } else if (this.type === 'bird') {
      // Animated left wing — inserted behind body
      const lwG = scene.add.graphics();
      lwG.fillStyle(0xffaa00);
      lwG.fillEllipse(0, 0, 20, 11);
      const leftWingCont = scene.add.container(-17, 5, [lwG]);
      this.body.addAt(leftWingCont, 0);

      // Animated right wing
      const rwG = scene.add.graphics();
      rwG.fillStyle(0xffaa00);
      rwG.fillEllipse(0, 0, 20, 11);
      const rightWingCont = scene.add.container(17, 5, [rwG]);
      this.body.addAt(rightWingCont, 0);

      // Alternating wing flap (half-period offset for natural look)
      scene.tweens.add({
        targets: leftWingCont,
        scaleY: -0.35,
        duration: 210,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      scene.tweens.add({
        targets: rightWingCont,
        scaleY: -0.35,
        duration: 210,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: 105,
      });
    }
  }

  private flashHit(): void {
    this.scene.tweens.add({
      targets: this.body,
      alpha: 0.15,
      duration: 50,
      yoyo: true,
      ease: 'Linear',
    });
  }

  takeDamage(dmg: number): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.drawHp();
    if (this.hp > 0) this.flashHit();
    if (this.hp <= 0) {
      this.alive = false;
      this.scene.events.emit('enemy-killed', this);
      this.scene.tweens.killTweensOf(this.body);
      this.scene.tweens.add({
        targets: this.container,
        scaleX: 1.8,
        scaleY: 1.8,
        alpha: 0,
        duration: 260,
        ease: 'Power2',
        onComplete: () => {
          if (this.container && this.container.scene) {
            this.container.destroy();
          }
        },
      });
    }
  }

  update(delta: number): void {
    if (!this.alive || this.reachedEnd) return;

    const target = this.waypoints[this.waypointIndex];
    if (!target) return;

    const dx = target.x - this.container.x;
    const dy = target.y - this.container.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const move = (this.speed * delta) / 1000;

    if (dist <= move) {
      this.container.x = target.x;
      this.container.y = target.y;
      this.waypointIndex++;
      if (this.waypointIndex >= this.waypoints.length) {
        this.reachedEnd = true;
        this.alive = false;
        this.scene.tweens.killTweensOf(this.body);
        this.container.destroy();
      }
    } else {
      this.container.x += (dx / dist) * move;
      this.container.y += (dy / dist) * move;
    }

    // Flip body when moving left/right
    if (Math.abs(dx) > 2) {
      this.body.scaleX = dx < 0 ? -1 : 1;
    }
  }

  get x(): number { return this.container.x; }
  get y(): number { return this.container.y; }

  // ─── Multiplayer guest helpers ─────────────────────────────────────────────

  /** Snap position (used by guest to mirror host's enemy positions). */
  syncPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  /** Update HP values and redraw HP bar (used by guest). */
  syncHp(hp: number, maxHp: number): void {
    this.hp = hp;
    this.maxHp = maxHp;
    this.drawHp();
  }

  /**
   * Trigger the death scale-and-fade animation without emitting 'enemy-killed'.
   * Used on the guest to visually destroy a ghost enemy when the host reports it dead.
   */
  triggerDeathAnimation(): void {
    if (!this.alive) return;
    this.alive = false;
    this.scene.tweens.killTweensOf(this.body);
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 0,
      duration: 260,
      ease: 'Power2',
      onComplete: () => {
        if (this.container && this.container.scene) {
          this.container.destroy();
        }
      },
    });
  }
}
