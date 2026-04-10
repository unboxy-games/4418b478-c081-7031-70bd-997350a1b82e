import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, ROWS, CELL, STARTING_COINS, STARTING_LIVES, TOWER_CONFIGS } from '../config';
import { GameScene } from './GameScene';
import { CatTower } from '../objects/CatTower';

const PANEL_Y = ROWS * CELL; // 520

export class UIScene extends Phaser.Scene {
  private coinsText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private msgText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private gameOverGroup!: Phaser.GameObjects.Group;
  private goVisible = false;

  // Tower info panel (shown when a placed tower is selected)
  private infoPanelBg!: Phaser.GameObjects.Graphics;
  private infoNameText!: Phaser.GameObjects.Text;
  private infoStatsText!: Phaser.GameObjects.Text;
  private upgradeBtnGfx!: Phaser.GameObjects.Graphics;
  private upgradeBtnText!: Phaser.GameObjects.Text;
  private upgradeZone!: Phaser.GameObjects.Zone;
  private sellBtnGfx!: Phaser.GameObjects.Graphics;
  private sellBtnText!: Phaser.GameObjects.Text;
  private sellZone!: Phaser.GameObjects.Zone;
  private currentSelectedCat: CatTower | null = null;
  private infoPanelCoins = STARTING_COINS;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    const game = this.scene.get('GameScene') as GameScene;

    // ── Top HUD bar ──────────────────────────────────────────────
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x000000, 0.55);
    hudBg.fillRect(0, 0, GAME_WIDTH, 26);

    this.waveText = this.add.text(8, 4, 'Wave 0', {
      fontSize: '17px', color: '#ffaa44', fontStyle: 'bold',
    });
    this.livesText = this.add.text(160, 4, `Lives: ${STARTING_LIVES}`, {
      fontSize: '17px', color: '#ff5555',
    });
    this.coinsText = this.add.text(320, 4, `Coins: ${STARTING_COINS}`, {
      fontSize: '17px', color: '#ffdd00',
    });
    this.scoreText = this.add.text(510, 4, 'Score: 0', {
      fontSize: '17px', color: '#88aaff',
    });

    // Pause button in HUD (top right)
    const pauseBtn = this.add.text(GAME_WIDTH - 10, 4, '⏸ Pause', {
      fontSize: '14px', color: '#8899cc',
    }).setOrigin(1, 0).setInteractive().setDepth(5);
    pauseBtn.on('pointerover', () => pauseBtn.setColor('#aabbff'));
    pauseBtn.on('pointerout',  () => pauseBtn.setColor('#8899cc'));
    pauseBtn.on('pointerdown', () => game.togglePause());

    // ── Bottom panel — Tower Selection ────────────────────────────
    const towerTypes = ['basic', 'sniper', 'rapid', 'bomb', 'taser', 'freeze', 'flame', 'trap'];
    const towerIcons: Record<string, string> = { basic: '🐱', sniper: '🎯', rapid: '⚡', bomb: '💣', taser: '🌩', freeze: '❄️', flame: '🔥', trap: '🪤' };
    const btnW = 56;
    const btnH = 64;
    const btnStartX = 2;
    const btnGap = 3;

    let currentType = 'basic';
    const borderGfxList: Phaser.GameObjects.Graphics[] = [];

    const redrawBorders = (coins: number) => {
      towerTypes.forEach((type, i) => {
        const bx = btnStartX + i * (btnW + btnGap);
        const by = PANEL_Y + 8;
        const bg = borderGfxList[i];
        bg.clear();
        const isSelected = type === currentType;
        const canAfford = coins >= TOWER_CONFIGS[type].cost;
        const borderCol = isSelected
          ? TOWER_CONFIGS[type].color
          : canAfford ? 0x334466 : 0x331111;
        if (isSelected) {
          bg.fillStyle(TOWER_CONFIGS[type].color, 0.12);
          bg.fillRoundedRect(bx, by, btnW, btnH, 5);
          bg.lineStyle(2.5, TOWER_CONFIGS[type].color, 1.0);
          bg.strokeRoundedRect(bx, by, btnW, btnH, 5);
          // Selection glow
          bg.lineStyle(1, TOWER_CONFIGS[type].color, 0.25);
          bg.strokeRoundedRect(bx - 2, by - 2, btnW + 4, btnH + 4, 7);
        } else {
          bg.lineStyle(1, borderCol);
          bg.strokeRoundedRect(bx, by, btnW, btnH, 5);
        }
      });
    };

    let currentCoins = STARTING_COINS;

    towerTypes.forEach((type, i) => {
      const cfg = TOWER_CONFIGS[type];
      const bx = btnStartX + i * (btnW + btnGap);
      const by = PANEL_Y + 8;

      // Border graphics (redrawn when selection/coins change)
      const borderGfx = this.add.graphics().setDepth(6);
      borderGfxList.push(borderGfx);

      // Tower icon + name (compact)
      this.add.text(bx + 4, by + 6, `${towerIcons[type]}`, {
        fontSize: '16px',
      }).setDepth(7);
      this.add.text(bx + 4, by + 26, cfg.label, {
        fontSize: '11px', color: cfg.colorStr, fontStyle: 'bold',
      }).setDepth(7);

      // Cost
      this.add.text(bx + 4, by + 43, `${cfg.cost}💰`, {
        fontSize: '11px', color: '#ffdd88',
      }).setDepth(7);

      // Keyboard hint
      this.add.text(bx + btnW - 4, by + 6, `[${i + 1}]`, {
        fontSize: '9px', color: '#445566',
      }).setOrigin(1, 0).setDepth(7);

      // Interactive zone
      const zone = this.add.zone(bx + btnW / 2, by + btnH / 2, btnW, btnH)
        .setInteractive()
        .setDepth(8);

      zone.on('pointerdown', () => {
        currentType = type;
        game.selectedTowerType = type;
        redrawBorders(currentCoins);
      });
    });

    redrawBorders(currentCoins);

    // Wave info / countdown (right side of panel)
    this.countdownText = this.add.text(625, PANEL_Y + 32, '', {
      fontSize: '18px', color: '#44ffaa', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(7);

    // Flash message (below top bar)
    this.msgText = this.add.text(GAME_WIDTH / 2, 38, '', {
      fontSize: '16px', color: '#ff4444', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setAlpha(0).setDepth(10);

    // Hover hint
    this.add.text(GAME_WIDTH - 12, PANEL_Y + 12, 'Hover tower = see range', {
      fontSize: '11px', color: '#555577',
    }).setOrigin(1, 0).setDepth(7);

    // Enemy types hint
    this.add.text(GAME_WIDTH - 12, PANEL_Y + 26, 'Keys 1-8 select tower', {
      fontSize: '11px', color: '#444466',
    }).setOrigin(1, 0).setDepth(7);

    // Keyboard shortcuts for tower selection
    this.input.keyboard?.on('keydown-ONE',   () => { currentType = 'basic';  game.selectedTowerType = 'basic';  redrawBorders(currentCoins); });
    this.input.keyboard?.on('keydown-TWO',   () => { currentType = 'sniper'; game.selectedTowerType = 'sniper'; redrawBorders(currentCoins); });
    this.input.keyboard?.on('keydown-THREE', () => { currentType = 'rapid';  game.selectedTowerType = 'rapid';  redrawBorders(currentCoins); });
    this.input.keyboard?.on('keydown-FOUR',  () => { currentType = 'bomb';   game.selectedTowerType = 'bomb';   redrawBorders(currentCoins); });
    this.input.keyboard?.on('keydown-FIVE',  () => { currentType = 'taser';  game.selectedTowerType = 'taser';  redrawBorders(currentCoins); });
    this.input.keyboard?.on('keydown-SIX',   () => { currentType = 'freeze'; game.selectedTowerType = 'freeze'; redrawBorders(currentCoins); });
    this.input.keyboard?.on('keydown-SEVEN', () => { currentType = 'flame';  game.selectedTowerType = 'flame';  redrawBorders(currentCoins); });
    this.input.keyboard?.on('keydown-EIGHT', () => { currentType = 'trap';   game.selectedTowerType = 'trap';   redrawBorders(currentCoins); });
    // Escape to deselect tower
    this.input.keyboard?.on('keydown-ESC', () => { game.deselectCat(); });

    // ── Tower info panel (right portion of bottom bar) ────────────
    // Layout: x=468..796, y=523..592 (total ~328×69)
    const IP_X = 466;
    const IP_Y = PANEL_Y + 3;
    const IP_W = 328;
    const IP_H = 73;
    const BTN_Y = IP_Y + IP_H - 28;
    const UPG_X = IP_X + 4;
    const UPG_W = 158;
    const SELL_X = IP_X + 4 + UPG_W + 6;
    const SELL_W = 156;

    this.infoPanelBg = this.add.graphics().setDepth(6).setVisible(false);

    this.infoNameText = this.add.text(IP_X + 8, IP_Y + 7, '', {
      fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
    }).setDepth(7).setVisible(false);

    this.infoStatsText = this.add.text(IP_X + 8, IP_Y + 27, '', {
      fontSize: '11px', color: '#aabbcc',
    }).setDepth(7).setVisible(false);

    this.upgradeBtnGfx = this.add.graphics().setDepth(7).setVisible(false);
    this.upgradeBtnText = this.add.text(UPG_X + UPG_W / 2, BTN_Y + 12, '', {
      fontSize: '12px', color: '#44ff88', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(8).setVisible(false);
    this.upgradeZone = this.add.zone(UPG_X + UPG_W / 2, BTN_Y + 12, UPG_W, 24)
      .setInteractive().setDepth(9).setVisible(false);

    this.sellBtnGfx = this.add.graphics().setDepth(7).setVisible(false);
    this.sellBtnText = this.add.text(SELL_X + SELL_W / 2, BTN_Y + 12, '', {
      fontSize: '12px', color: '#ff8866', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(8).setVisible(false);
    this.sellZone = this.add.zone(SELL_X + SELL_W / 2, BTN_Y + 12, SELL_W, 24)
      .setInteractive().setDepth(9).setVisible(false);

    this.upgradeZone.on('pointerdown', () => {
      if (this.currentSelectedCat) game.upgradeTower(this.currentSelectedCat);
    });
    this.upgradeZone.on('pointerover', () => {
      if (this.currentSelectedCat && this.currentSelectedCat.level < 3) {
        this.upgradeBtnText.setColor('#aaffcc');
      }
    });
    this.upgradeZone.on('pointerout', () => { this.upgradeBtnText.setColor('#44ff88'); });

    this.sellZone.on('pointerdown', () => {
      if (this.currentSelectedCat) game.sellTower(this.currentSelectedCat);
    });
    this.sellZone.on('pointerover', () => { this.sellBtnText.setColor('#ffaa88'); });
    this.sellZone.on('pointerout',  () => { this.sellBtnText.setColor('#ff8866'); });

    const showInfoPanel = (cat: CatTower) => {
      this.currentSelectedCat = cat;
      this.infoPanelCoins = currentCoins;
      const cfg = TOWER_CONFIGS[cat.towerType];
      const lvlStars = '★'.repeat(cat.level) + '☆'.repeat(3 - cat.level);
      this.infoNameText.setText(`${cfg.label} Cat  ${lvlStars}`).setColor(cfg.colorStr);
      const rateS = (cat.currentFireRateMs / 1000).toFixed(2);
      this.infoStatsText.setText(
        `Dmg: ${cat.currentDamage}  Range: ${cat.currentRange}  Rate: ${rateS}s`
      );

      // Upgrade button
      const canUpgrade = cat.level < 3;
      const canAffordUpg = canUpgrade && currentCoins >= cat.upgradeCost;
      this.upgradeBtnGfx.clear();
      this.upgradeBtnGfx.fillStyle(canAffordUpg ? 0x1a4a2a : 0x1a1a1a);
      this.upgradeBtnGfx.fillRoundedRect(UPG_X, BTN_Y, UPG_W, 24, 4);
      this.upgradeBtnGfx.lineStyle(1.5, canUpgrade ? (canAffordUpg ? 0x44ff88 : 0x336633) : 0x333333);
      this.upgradeBtnGfx.strokeRoundedRect(UPG_X, BTN_Y, UPG_W, 24, 4);
      this.upgradeBtnText
        .setText(canUpgrade ? `⬆ Upgrade  ${cat.upgradeCost}💰` : '✨ MAX LEVEL')
        .setColor(canUpgrade ? (canAffordUpg ? '#44ff88' : '#336633') : '#aaaaff');

      // Sell button
      this.sellBtnGfx.clear();
      this.sellBtnGfx.fillStyle(0x3a1a0a);
      this.sellBtnGfx.fillRoundedRect(SELL_X, BTN_Y, SELL_W, 24, 4);
      this.sellBtnGfx.lineStyle(1.5, 0xff8844);
      this.sellBtnGfx.strokeRoundedRect(SELL_X, BTN_Y, SELL_W, 24, 4);
      this.sellBtnText.setText(`💰 Sell  ${cat.sellValue}💰`);

      // Info panel background
      this.infoPanelBg.clear();
      this.infoPanelBg.fillStyle(0x0d1020, 0.95);
      this.infoPanelBg.fillRoundedRect(IP_X, IP_Y, IP_W, IP_H, 5);
      this.infoPanelBg.lineStyle(1.5, cfg.color, 0.8);
      this.infoPanelBg.strokeRoundedRect(IP_X, IP_Y, IP_W, IP_H, 5);

      // Show all elements
      [this.infoPanelBg, this.infoNameText, this.infoStatsText,
       this.upgradeBtnGfx, this.upgradeBtnText, this.upgradeZone,
       this.sellBtnGfx, this.sellBtnText, this.sellZone].forEach(o => o.setVisible(true));
      this.countdownText.setVisible(false);
    };

    const hideInfoPanel = () => {
      this.currentSelectedCat = null;
      [this.infoPanelBg, this.infoNameText, this.infoStatsText,
       this.upgradeBtnGfx, this.upgradeBtnText, this.upgradeZone,
       this.sellBtnGfx, this.sellBtnText, this.sellZone].forEach(o => o.setVisible(false));
      this.countdownText.setVisible(true);
    };

    // ── Pause overlay ────────────────────────────────────────────
    const PW = 360;
    const PH = 260;
    const PX = GAME_WIDTH / 2 - PW / 2;
    const PY = GAME_HEIGHT / 2 - PH / 2;

    const pauseBg = this.add.graphics().setDepth(30).setVisible(false);
    // Full-screen dim
    pauseBg.fillStyle(0x000000, 0.65);
    pauseBg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Panel
    pauseBg.fillStyle(0x0a0a22, 0.97);
    pauseBg.fillRoundedRect(PX, PY, PW, PH, 16);
    pauseBg.lineStyle(2, 0x4455cc);
    pauseBg.strokeRoundedRect(PX, PY, PW, PH, 16);
    // Inner accent line
    pauseBg.lineStyle(1, 0x2233aa, 0.5);
    pauseBg.strokeRoundedRect(PX + 4, PY + 4, PW - 8, PH - 8, 13);

    const pauseTitle = this.add.text(GAME_WIDTH / 2, PY + 42, '⏸  PAUSED', {
      fontSize: '34px', color: '#aabbff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(31).setVisible(false);

    const pauseSubtitle = this.add.text(GAME_WIDTH / 2, PY + 88, 'Game is paused — enemies frozen', {
      fontSize: '14px', color: '#556688',
    }).setOrigin(0.5).setDepth(31).setVisible(false);

    // Resume button
    const pauseResumeBg = this.add.graphics().setDepth(31).setVisible(false);
    pauseResumeBg.fillStyle(0x112244);
    pauseResumeBg.fillRoundedRect(PX + 50, PY + 128, PW - 100, 42, 8);
    pauseResumeBg.lineStyle(2, 0x4488ff);
    pauseResumeBg.strokeRoundedRect(PX + 50, PY + 128, PW - 100, 42, 8);

    const pauseResumeText = this.add.text(GAME_WIDTH / 2, PY + 149, '▶  RESUME  [ P ]', {
      fontSize: '20px', color: '#44aaff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(32).setVisible(false).setInteractive();

    // Restart button
    const pauseRestartBg = this.add.graphics().setDepth(31).setVisible(false);
    pauseRestartBg.fillStyle(0x221111);
    pauseRestartBg.fillRoundedRect(PX + 50, PY + 186, PW - 100, 36, 8);
    pauseRestartBg.lineStyle(1.5, 0x885544);
    pauseRestartBg.strokeRoundedRect(PX + 50, PY + 186, PW - 100, 36, 8);

    const pauseRestartText = this.add.text(GAME_WIDTH / 2, PY + 204, '↺  Restart Game', {
      fontSize: '16px', color: '#cc6644',
    }).setOrigin(0.5).setDepth(32).setVisible(false).setInteractive();

    const pauseElements = [
      pauseBg, pauseTitle, pauseSubtitle,
      pauseResumeBg, pauseResumeText,
      pauseRestartBg, pauseRestartText,
    ];

    const showPause = () => pauseElements.forEach(o => o.setVisible(true));
    const hidePause = () => pauseElements.forEach(o => o.setVisible(false));

    pauseResumeText.on('pointerover', () => pauseResumeText.setColor('#88ccff'));
    pauseResumeText.on('pointerout',  () => pauseResumeText.setColor('#44aaff'));
    pauseResumeText.on('pointerdown', () => game.togglePause());

    pauseRestartText.on('pointerover', () => pauseRestartText.setColor('#ff8866'));
    pauseRestartText.on('pointerout',  () => pauseRestartText.setColor('#cc6644'));
    pauseRestartText.on('pointerdown', () => {
      hidePause();
      currentType = 'basic';
      currentCoins = STARTING_COINS;
      hideInfoPanel();
      this.scene.stop();
      this.scene.get('GameScene').scene.restart();
    });

    // P key also toggles pause from UIScene (for resume when overlay is up)
    this.input.keyboard?.on('keydown-P', () => game.togglePause());

    game.events.on('paused',  () => showPause());
    game.events.on('resumed', () => hidePause());

    // ── Game Over overlay ────────────────────────────────────────
    this.gameOverGroup = this.add.group();
    const goBg = this.add.graphics().setDepth(20);
    goBg.fillStyle(0x000000, 0.88);
    goBg.fillRoundedRect(GAME_WIDTH / 2 - 210, GAME_HEIGHT / 2 - 140, 420, 280, 18);
    goBg.lineStyle(2.5, 0xff4444);
    goBg.strokeRoundedRect(GAME_WIDTH / 2 - 210, GAME_HEIGHT / 2 - 140, 420, 280, 18);

    const goTitle = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 105, 'GAME OVER', {
      fontSize: '38px', color: '#ff4444', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);

    const goScore = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 45, 'Score: 0', {
      fontSize: '24px', color: '#ffdd00',
    }).setOrigin(0.5).setDepth(21);

    const goWave = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 5, 'Waves survived: 0', {
      fontSize: '20px', color: '#aaaaff',
    }).setOrigin(0.5).setDepth(21);

    const goBtn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70, '[ PLAY AGAIN ]', {
      fontSize: '24px', color: '#44ff88', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21).setInteractive();

    goBtn.on('pointerover', () => goBtn.setColor('#88ffbb'));
    goBtn.on('pointerout', () => goBtn.setColor('#44ff88'));
    goBtn.on('pointerdown', () => {
      this.goVisible = false;
      currentType = 'basic';
      currentCoins = STARTING_COINS;
      hideInfoPanel();
      [goBg, goTitle, goScore, goWave, goBtn].forEach(o => o.setVisible(false));
      this.scene.stop();
      this.scene.get('GameScene').scene.restart();
    });

    this.gameOverGroup.addMultiple([goBg, goTitle, goScore, goWave, goBtn]);
    this.gameOverGroup.setVisible(false);

    // ── Event listeners ──────────────────────────────────────────
    game.events.on('coins-changed', (c: number) => {
      this.coinsText.setText(`Coins: ${c}`);
      currentCoins = c;
      redrawBorders(c);
      this.infoPanelCoins = c;
      if (this.currentSelectedCat) showInfoPanel(this.currentSelectedCat);
    });

    game.events.on('lives-changed', (l: number) => {
      this.livesText.setText(`Lives: ${l}`);
    });

    game.events.on('score-changed', (s: number) => {
      this.scoreText.setText(`Score: ${s}`);
      goScore.setText(`Score: ${s}`);
    });

    game.events.on('wave-started', (w: number) => {
      this.waveText.setText(`Wave ${w}`);
      this.countdownText.setText(`⚔️  Wave ${w}!`).setColor('#ff8844').setAlpha(1);
      this.tweens.add({ targets: this.countdownText, alpha: 0, delay: 2200, duration: 800 });
    });

    game.events.on('wave-complete', (w: number) => {
      this.countdownText.setText(`✅  Wave ${w} cleared!`).setColor('#44ffaa').setAlpha(1);
      this.tweens.add({ targets: this.countdownText, alpha: 0, delay: 2500, duration: 800 });
    });

    game.events.on('countdown', (secs: number) => {
      if (!this.goVisible && secs > 0 && secs <= 8) {
        this.countdownText.setText(`Next wave in ${secs}s`).setColor('#88aaff').setAlpha(0.85);
      }
    });

    game.events.on('show-msg', (text: string, color: string) => {
      this.showMsg(text, color);
    });

    game.events.on('tower-selected', (cat: CatTower) => {
      showInfoPanel(cat);
    });

    game.events.on('tower-deselected', () => {
      hideInfoPanel();
    });

    game.events.on('game-over', (score: number, wave: number) => {
      goScore.setText(`Score: ${score}`);
      goWave.setText(`Waves survived: ${wave}`);
      this.scoreText.setText(`Score: ${score}`);
      this.goVisible = true;
      this.gameOverGroup.setVisible(true);
      [goBg, goTitle, goScore, goWave, goBtn].forEach(o => o.setVisible(true));
    });
  }

  private showMsg(text: string, color = '#ff4444'): void {
    this.msgText.setText(text).setColor(color).setAlpha(1);
    this.tweens.killTweensOf(this.msgText);
    this.tweens.add({
      targets: this.msgText,
      alpha: 0,
      delay: 1800,
      duration: 600,
    });
  }
}
