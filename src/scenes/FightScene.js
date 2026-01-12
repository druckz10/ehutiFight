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
        this.fighter1 = new Fighter(this, 300, 400, this.player1Texture, true, p1Keys);
        this.fighter2 = new Fighter(this, 980, 400, this.player2Texture, p2IsPlayer, p2Keys);

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

        // Item Spawner (Every 10s)
        this.time.addEvent({
            delay: 10000,
            callback: () => this.spawnHealItem(),
            loop: true
        });
    }

    createHUD() {
        // Health Bar P1
        this.add.text(50, 50, 'P1', { fontSize: '32px', color: '#fff' });
        this.hp1Bg = this.add.rectangle(200, 65, 300, 30, 0x000000).setOrigin(0, 0.5);
        this.hp1Bar = this.add.rectangle(200, 65, 300, 30, 0x00ff00).setOrigin(0, 0.5);

        // Health Bar P2
        this.add.text(1230, 50, 'P2', { fontSize: '32px', color: '#fff' }).setOrigin(1, 0);
        this.hp2Bg = this.add.rectangle(1080, 65, 300, 30, 0x000000).setOrigin(1, 0.5);
        this.hp2Bar = this.add.rectangle(1080, 65, 300, 30, 0x00ff00).setOrigin(1, 0.5);

        // Special Meter P1
        this.sp1Bar = this.add.rectangle(200, 100, 300, 15, 0x00ffff).setOrigin(0, 0.5);
        this.sp1Bar.scaleX = 0;
        this.add.rectangle(200, 100, 300, 15, 0xffffff).setOrigin(0, 0.5).setStrokeStyle(2, 0xffffff).setFillStyle(0, 0);

        // Special Meter P2
        this.sp2Bar = this.add.rectangle(1080, 100, 300, 15, 0x00ffff).setOrigin(1, 0.5);
        this.sp2Bar.scaleX = 0;
        this.add.rectangle(1080, 100, 300, 15, 0xffffff).setOrigin(1, 0.5).setStrokeStyle(2, 0xffffff).setFillStyle(0, 0);

        // Timer
        this.timerText = this.add.text(640, 50, '99', { fontSize: '48px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        this.timeLeft = 99;
        this.timerEvent = this.time.addEvent({
            delay: 1000,
            callback: () => {
                if (this.isGameOver) return;
                this.timeLeft--;
                this.timerText.setText(this.timeLeft);
                if (this.timeLeft <= 0) {
                    this.handleGameOver('Time Over');
                }
            },
            loop: true
        });
    }

    update(time) {
        if (this.isGameOver) return;

        // --- TOUCH INPUT MAPPING (P1 Only) ---
        if (window.touchState && this.fighter1 && this.fighter1.isPlayer) {
            // We hack directly into the fighter's keys or override velocity here?
            // Cleaner: Update the "virtual keys" if they exist, or create a merged input object.
            // But Fighter.js reads this.keys.left.isDown directly.

            // Let's monkey-patch the P1 keys for this frame if touch is active
            // This is a bit dirty but effective without rewriting Fighter.js input handling
            const keys = this.fighter1.keys;

            // Helper to merge: (Physical OR Touch)
            const merge = (keyObj, touchProp) => {
                // If we haven't backed up the original 'isDown' getter, do it? 
                // No, Phaser keys update internal state. We can force it.
                // Actually, let's just use a custom Check in Fighter.js? 
                // OR: We update the Fighter to accept an "externalInput" object override.

                // Let's try simpler: directly modify key state if touch is true. 
                // Does NOT work well because Phaser resets keys on update.

                // ALTERNATIVE: We pass window.touchState to Fighter.update?
            };

            // BEST APPROACH: Modify Fighter.js to look at a global or scene-level input override.
            // But I cannot modify Fighter.js in this step easily without errors.
            // So I will set a new property "externalInput" on fighter1 in THIS loop
            this.fighter1.externalInput = window.touchState;
        }

        this.fighter1.update(time);
        this.fighter2.update(time);

        // ONLINE UPDATE
        if (this.gameMode === 'online') {
            const myFighter = (this.role === 'host') ? this.fighter1 : this.fighter2;
            const myKeys = myFighter.keys;

            // Check specific touch override if P1
            const touch = (this.role === 'host') ? (window.touchState || {}) : {};

            const currentInput = {
                up: myKeys.up.isDown || touch.up,
                down: myKeys.down.isDown || touch.down,
                left: myKeys.left.isDown || touch.left,
                right: myKeys.right.isDown || touch.right,
                attack1Press: Phaser.Input.Keyboard.JustDown(myKeys.attack1) || touch.attack1,
                attack2Press: Phaser.Input.Keyboard.JustDown(myKeys.attack2) || touch.attack2
            };

            NetworkManager.send({ type: 'INPUT', input: currentInput });
        }

        // Update Health Bars
        this.hp1Bar.width = 300 * (this.fighter1.health / this.fighter1.maxHealth);
        this.hp2Bar.width = 300 * (this.fighter2.health / this.fighter2.maxHealth);

        // Update Special Bars
        this.sp1Bar.scaleX = (this.fighter1.specialMeter / 100);
        this.sp2Bar.scaleX = (this.fighter2.specialMeter / 100);

        if (this.fighter1.health <= 0) {
            if (this.gameMode === 'ai') {
                this.handleGameOver('YOU LOSE');
            } else {
                this.handleGameOver('PLAYER 2 WINS!');
            }
        } else if (this.fighter2.health <= 0) {
            if (this.gameMode === 'ai') {
                this.handleGameOver('YOU WIN');
            } else {
                this.handleGameOver('PLAYER 1 WINS!');
            }
        }
    }

    handleGameOver(resultText) {
        this.isGameOver = true;
        this.physics.pause();
        this.timerEvent.remove();

        const { width, height } = this.scale;

        // Victory Text
        this.add.text(width / 2, height / 2, resultText, {
            fontSize: '64px',
            fontFamily: 'Arial Black',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        // Buttons Group
        const createBtn = (x, y, text, callback) => {
            const bg = this.add.rectangle(x, y, 300, 60, 0x444444).setInteractive();
            const label = this.add.text(x, y, text, { fontSize: '24px', color: '#fff' }).setOrigin(0.5);

            bg.on('pointerover', () => bg.setFillStyle(0x666666));
            bg.on('pointerout', () => bg.setFillStyle(0x444444));
            bg.on('pointerdown', callback);
        };

        const currentData = {
            player1Texture: this.player1Texture,
            player2Texture: this.player2Texture,
            mode: this.gameMode,
            difficulty: this.difficulty
        };

        // Play Again
        createBtn(width / 2, height / 2 + 100, 'PLAY AGAIN', () => {
            this.scene.restart(currentData);
        });

        // Switch Characters
        createBtn(width / 2, height / 2 + 180, 'SWITCH CHARACTERS', () => {
            this.scene.start('SelectionScene', {
                mode: this.gameMode,
                difficulty: this.difficulty,
                role: (this.gameMode === 'online' && this.role) ? this.role : 'host'
            });
        });

        // Back to Menu
        createBtn(width / 2, height / 2 + 260, 'MAIN MENU', () => {
            this.scene.start('ModeSelectionScene');
        });
    }

    spawnHealItem() {
        if (this.isGameOver) return;

        const x = Phaser.Math.Between(100, 1180);
        const y = Phaser.Math.Between(300, 600); // Air and ground range

        // Visual: Green Cross
        const item = this.add.container(x, y);
        const circle = this.add.circle(0, 0, 20, 0xffffff);
        const crossV = this.add.rectangle(0, 0, 10, 30, 0x00ff00);
        const crossH = this.add.rectangle(0, 0, 30, 10, 0x00ff00);
        item.add([circle, crossV, crossH]);

        this.physics.add.existing(item);
        item.body.setAllowGravity(false); // Float in air

        // Collection
        const collect = (fighter) => {
            if (fighter.health < fighter.maxHealth) {
                fighter.heal(20); // Heal 20 HP

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
                return true;
            }
            return false;
        };

        this.physics.add.overlap(this.fighter1, item, () => collect(this.fighter1));
        this.physics.add.overlap(this.fighter2, item, () => collect(this.fighter2));

        // Despawn after 5s
        this.time.delayedCall(5000, () => {
            if (item.scene) { // Check if still exists
                this.tweens.add({
                    targets: item,
                    alpha: 0,
                    scale: 0,
                    duration: 500,
                    onComplete: () => item.destroy()
                });
            }
        });
    }
}
