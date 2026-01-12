import Phaser from 'phaser';
import Fighter from '../objects/Fighter';
import NetworkManager from '../services/NetworkManager';

export default class FightScene extends Phaser.Scene {
    constructor() {
        super('FightScene');
    }

    init(data) {
        this.player1Texture = data.player1Texture || 'fighter_0';
        this.player2Texture = data.player2Texture || 'fighter_1';
        this.gameMode = data.mode || 'ai';
        this.difficulty = data.difficulty || 'normal';
        this.isGameOver = false;
    }

    create() {
        // Physics world bounds
        this.physics.world.setBounds(0, 0, 1280, 720);

        // Background
        this.add.rectangle(640, 360, 1280, 720, 0x333333); // basic bg

        // Simple ground
        const ground = this.add.rectangle(640, 660, 1280, 120, 0x555555);
        this.physics.add.existing(ground, true);

        // Define Controls
        // P1: Arrows + Z/X
        const cursors = this.input.keyboard.createCursorKeys();
        const p1Keys = {
            up: cursors.up,
            down: cursors.down,
            left: cursors.left,
            right: cursors.right,
            attack1: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.N),
            attack2: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M)
        };

        const p2IsPlayer = this.gameMode === 'local';
        let p2Keys = null;
        if (p2IsPlayer) {
            // P2: WASD + Z/X
            p2Keys = {
                up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
                down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
                left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
                right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
                attack1: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
                attack2: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X)
            };
        }

        // Create Fighters
        let f1IsPlayer = true;
        let p1Input = p1Keys;

        let f2IsPlayer = p2IsPlayer;
        let p2Input = p2Keys;

        if (this.gameMode === 'online') {
            if (this.role === 'client') {
                // I am Player 2 (Right Side)
                // Fighter 1 is HOST (Remote)
                f1IsPlayer = false;
                p1Input = null;

                // Fighter 2 is ME (Local). I use my local p1Keys to drive it.
                f2IsPlayer = true;
                p2Input = p1Keys;
            } else {
                // I am Player 1 (Left Side) - Host
                // Fighter 1 is ME (Local)
                f1IsPlayer = true;
                p1Input = p1Keys;

                // Fighter 2 is CLIENT (Remote)
                f2IsPlayer = false;
                p2Input = null;
            }
        }

        this.fighter1 = new Fighter(this, 300, 400, this.player1Texture, f1IsPlayer, p1Input);
        this.fighter2 = new Fighter(this, 980, 400, this.player2Texture, f2IsPlayer, p2Input);

        // Colliders
        this.physics.add.collider(this.fighter1, ground);
        this.physics.add.collider(this.fighter2, ground);
        this.physics.add.collider(this.fighter1, this.fighter2);

        // Platforms Removed by user request
        this.platforms = this.physics.add.staticGroup(); // Empty group to prevent errors if referenced

        // Camera
        this.cameras.main.setBackgroundColor('#2d2d2d');

        // UI Wrapper
        this.createHUD();

        // Item Spawner (Host Only or Offline)
        const isOnlineClient = (this.gameMode === 'online' && this.role === 'client');
        if (!isOnlineClient) {
            this.time.addEvent({
                delay: 10000,
                callback: () => this.spawnHealItem(),
                loop: true
            });
        }

        // Network Listener for Items
        if (this.gameMode === 'online') {
            NetworkManager.onData((data) => {
                if (data.type === 'INPUT') {
                    // Handled in update loop usually, but ensure we don't overwrite if separate
                } else if (data.type === 'SPAWN_ITEM') {
                    this.spawnHealItem(data.x, data.y, true);
                } else if (data.type === 'ITEM_COLLECTED') {
                    // Opponent collected it
                    this.handleItemCollectionEffect(data.itemId);
                }
            });
        }
    }

    // ... createHUD ... (lines 109-145 skipped in context, assume unchanged)

    // ... update ... (lines 147-210 skipped in context, assume unchanged)

    // ... handleGameOver ... (lines 212-263 skipped in context, assume unchanged)

    spawnHealItem(x, y, fromNetwork = false) {
        if (this.isGameOver) return;

        // If not provided (Host/Local), generate random
        if (x === undefined || y === undefined) {
            x = Phaser.Math.Between(100, 1180);
            y = Phaser.Math.Between(300, 600);
        }

        // If Host in Online Mode, Sync it
        if (this.gameMode === 'online' && !fromNetwork) {
            NetworkManager.send({ type: 'SPAWN_ITEM', x, y });
        }

        // Visual: Green Cross
        const item = this.add.container(x, y);
        item.id = `item_${Date.now()}`; // Simple ID for sync (collision unused right now but good practice)

        const circle = this.add.circle(0, 0, 20, 0xffffff);
        const crossV = this.add.rectangle(0, 0, 10, 30, 0x00ff00);
        const crossH = this.add.rectangle(0, 0, 30, 10, 0x00ff00);
        item.add([circle, crossV, crossH]);

        this.physics.add.existing(item);
        item.body.setAllowGravity(false);

        // Collection Logic
        const tryCollect = (fighter) => {
            if (fighter.health < fighter.maxHealth) {
                // Healed!
                fighter.heal(20);
                this.handleItemCollectionEffect(item.id, item);

                // If Online, tell other player I took it
                if (this.gameMode === 'online') {
                    NetworkManager.send({ type: 'ITEM_COLLECTED', itemId: item.id });
                }
                return true;
            }
            return false;
        };

        // Physics Overlap
        this.physics.add.overlap(this.fighter1, item, () => tryCollect(this.fighter1));
        this.physics.add.overlap(this.fighter2, item, () => tryCollect(this.fighter2));

        // Despawn after 5s
        this.time.delayedCall(5000, () => {
            if (item.scene) {
                this.tweens.add({
                    targets: item,
                    alpha: 0,
                    scale: 0,
                    duration: 500,
                    onComplete: () => item.destroy()
                });
            }
        });

        this.currentItem = item; // Track single item for simple sync
    }

    handleItemCollectionEffect(itemId, itemObj = null) {
        // Find item if not passed
        const item = itemObj || this.currentItem;

        if (item && item.scene) {
            // Floating Text
            const txt = this.add.text(item.x, item.y, '+20 HP', { fontSize: '24px', color: '#00ff00', fontStyle: 'bold' }).setOrigin(0.5);
            this.tweens.add({
                targets: txt,
                y: txt.y - 50,
                alpha: 0,
                duration: 1000,
                onComplete: () => txt.destroy()
            });

            item.destroy();
            this.currentItem = null;
        }
    }

    createHUD() {
        const { width } = this.scale;

        // Player 1 Health Bar
        this.add.text(50, 30, 'PLAYER 1', { fontSize: '20px', fontStyle: 'bold', color: '#fff' });
        this.p1HealthBg = this.add.rectangle(50, 60, 300, 20, 0x333333).setOrigin(0, 0.5);
        this.p1HealthBar = this.add.rectangle(50, 60, 300, 20, 0x00ff00).setOrigin(0, 0.5);

        // Player 2 Health Bar
        this.add.text(width - 350, 30, 'PLAYER 2', { fontSize: '20px', fontStyle: 'bold', color: '#fff' });
        this.p2HealthBg = this.add.rectangle(width - 350, 60, 300, 20, 0x333333).setOrigin(0, 0.5);
        this.p2HealthBar = this.add.rectangle(width - 350, 60, 300, 20, 0x00ff00).setOrigin(0, 0.5);

        // Timer
        this.timerText = this.add.text(width / 2, 50, '99', { fontSize: '48px', fontStyle: 'bold', color: '#ffff00' }).setOrigin(0.5);

        // Mobile Controls Hint
        if (width < 900) {
            this.add.text(width / 2, 100, 'Tap sides to move • Buttons to fight', { fontSize: '16px', color: '#aaa' }).setOrigin(0.5);
        }
    }

    updateHealthHUD() {
        // Update P1
        const p1Pct = Math.max(0, this.fighter1.hp / this.fighter1.maxHp);
        this.p1HealthBar.width = 300 * p1Pct;

        // Update P2
        const p2Pct = Math.max(0, this.fighter2.hp / this.fighter2.maxHp);
        this.p2HealthBar.width = 300 * p2Pct;
    }

    update(time, delta) {
        if (this.isGameOver) return;

        this.fighter1.update(time, delta);
        this.fighter2.update(time, delta);

        // Keep fighters in bounds
        this.fighter1.x = Phaser.Math.Clamp(this.fighter1.x, 20, 1260);
        this.fighter2.x = Phaser.Math.Clamp(this.fighter2.x, 20, 1260);

        this.updateHealthHUD();
        this.checkWinCondition();
    }

    checkWinCondition() {
        if (this.fighter1.hp <= 0) {
            this.handleGameOver('PLAYER 2 WINS!');
        } else if (this.fighter2.hp <= 0) {
            this.handleGameOver('PLAYER 1 WINS!');
        }
    }

    handleGameOver(winnerText) {
        this.isGameOver = true;
        this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.7);
        this.add.text(640, 300, 'GAME OVER', { fontSize: '64px', color: '#ff0000', fontStyle: 'bold' }).setOrigin(0.5);
        this.add.text(640, 400, winnerText, { fontSize: '48px', color: '#ffffff' }).setOrigin(0.5);

        const restartBtn = this.add.text(640, 500, 'TAP TO RESTART', { fontSize: '32px', color: '#ffff00' })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        restartBtn.on('pointerdown', () => {
            // Clean up network if online
            if (this.gameMode === 'online') {
                NetworkManager.cleanUp();
            }
            this.scene.start('ModeSelectionScene');
        });
    }
}
