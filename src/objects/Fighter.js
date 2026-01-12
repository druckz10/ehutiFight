import Phaser from 'phaser';
import { FighterStats } from '../config/FighterStats';

export default class Fighter extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture, isPlayer, keys = null) {
        super(scene, x, y, texture);

        this.scene = scene;
        this.isPlayer = isPlayer;

        // Add to scene and physics
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true);
        this.setBounce(0.0);
        this.setDragX(1000); // Friction

        // Scale down if image is huge
        this.setDisplaySize(150, 150 * (this.height / this.width));
        this.body.setSize(this.width * 0.6, this.height * 0.9);
        this.body.setOffset(this.width * 0.2, this.height * 0.1);

        // Stats Integration
        const stats = FighterStats[texture] || FighterStats['fighter_0'];
        this.textureKey = texture; // Store for special ID

        // Base API Stats (Stored as base for buffs)
        this.baseMoveSpeed = 300 * (stats.speed / 100);
        this.baseJumpForce = -700 * (stats.jump / 100);
        this.baseJabDamage = 5 * (stats.jab / 100);
        this.baseKickDamage = 10 * (stats.kick / 100);
        this.baseRangeMultiplier = stats.range / 100;

        // Active Stats
        this.moveSpeed = this.baseMoveSpeed;
        this.jumpForce = this.baseJumpForce;
        this.jabDamage = this.baseJabDamage;
        this.kickDamage = this.baseKickDamage;
        this.rangeMultiplier = this.baseRangeMultiplier;

        this.maxHealth = stats.health;
        this.health = this.maxHealth;
        this.tempShield = 0; // Shield HP for specials

        this.isAttacking = false;
        this.ignoreDefense = false; // For piercing strikes

        // Combo & Special System
        this.specialMeter = 0;
        this.comboBuffer = [];
        this.lastComboTime = 0;
        this.comboTimeout = 1000;

        // Block System
        this.blockMeter = 100;
        this.isBlocking = false;
        this.shieldSprite = null;

        // Input keys (if player)
        if (this.isPlayer) {
            if (keys) {
                this.keys = keys;
            } else {
                const cursors = scene.input.keyboard.createCursorKeys();
                this.keys = {
                    up: cursors.up,
                    down: cursors.down,
                    left: cursors.left,
                    right: cursors.right,
                    attack1: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
                    attack2: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X)
                };
            }
        }
    }

    update(time) {
        // Block Regen
        if (!this.isBlocking && this.blockMeter < 100) {
            this.blockMeter += 0.5;
        }

        // Passive Health Regen (Slow)
        if (this.health < this.maxHealth && this.health > 0) {
            // Approx 0.05 HP per frame @ 60fps = 3 HP/sec
            this.health += 0.03;
        }

        // Shield Visual Update
        if (this.shieldSprite) {
            this.shieldSprite.x = this.x + (this.flipX ? -40 : 40);
            this.shieldSprite.y = this.y;
            if (!this.isBlocking) {
                this.shieldSprite.destroy();
                this.shieldSprite = null;
            }
        }

        if (this.isPlayer) {
            this.handleInput(time);
        } else {
            this.handleAI(time);
        }
    }

    activateSpecial() {
        if (this.specialMeter < 100) return;
        this.specialMeter = 0;

        this.showPopup("SPECIAL!");

        // Visual: Purple Tint
        this.setTint(0xff00ff);

        const id = this.textureKey;
        let duration = 5000; // Default

        switch (id) {
            case 'fighter_0': // Balanced: Heal 10% + Speed 20%
                this.heal(this.maxHealth * 0.10);
                this.applyBuff('moveSpeed', 1.2, 5000);
                duration = 5000;
                break;
            case 'fighter_1': // Ranged: Jab +25%, Range +25%
                this.applyBuff('jabDamage', 1.25, 6000);
                this.applyBuff('rangeMultiplier', 1.25, 6000);
                duration = 6000;
                break;
            case 'fighter_2': // Fast Melee: Kick +40%, Jump +30%
                this.applyBuff('kickDamage', 1.4, 5000);
                this.applyBuff('jumpForce', 1.3, 5000);
                duration = 5000;
                break;
            case 'fighter_3': // Tank: 25% Guard Shield
                this.tempShield = this.maxHealth * 0.25;
                // Note: Regular shield logic uses green, but special activation uses purple.
                // We'll trust the requested purple overrides everything for now.
                duration = 5000;
                this.scene.time.delayedCall(5000, () => {
                    this.tempShield = 0;
                });
                break;
            case 'fighter_4': // Glass: Speed +50%, Jump +50%
                this.applyBuff('moveSpeed', 1.5, 6000);
                this.applyBuff('jumpForce', 1.5, 6000);
                duration = 6000;
                break;
            case 'fighter_5': // Kick Focused: Kick +50%, Speed +10%
                this.applyBuff('kickDamage', 1.5, 5000);
                this.applyBuff('moveSpeed', 1.1, 5000);
                duration = 5000;
                break;
            case 'fighter_6': // Rushdown: Piercing Strike
                this.ignoreDefense = true;
                this.scene.time.delayedCall(100, () => this.kick()); // Auto kick
                this.scene.time.delayedCall(1000, () => this.ignoreDefense = false);
                duration = 1000;
                break;
            default:
                this.applyBuff('moveSpeed', 1.2, 5000);
                break;
        }

        // Clear Tint after duration
        this.scene.time.delayedCall(duration, () => {
            if (this.health > 0) this.clearTint();
        });
    }

    applyBuff(prop, multiplier, duration) {
        const basePropMap = {
            'moveSpeed': 'baseMoveSpeed',
            'jumpForce': 'baseJumpForce',
            'jabDamage': 'baseJabDamage',
            'kickDamage': 'baseKickDamage',
            'rangeMultiplier': 'baseRangeMultiplier'
        };

        const baseVal = this[basePropMap[prop]];
        if (baseVal === undefined) return;

        this[prop] = baseVal * multiplier;

        // Timer to reset
        this.scene.time.delayedCall(duration, () => {
            this[prop] = baseVal;
        });
    }

    heal(amount) {
        this.health += amount;
        if (this.health > this.maxHealth) this.health = this.maxHealth;
    }

    handleInput(time) {
        if (!this.body) return;
        if (this.isAttacking) return;

        this.setVelocityX(0);

        if (time - this.lastComboTime > this.comboTimeout) {
            this.comboBuffer = [];
        }

        // Combine Keys + External (Touch)
        const ext = this.externalInput || { up: false, down: false, left: false, right: false, attack1: false, attack2: false };

        if (this.keys.left.isDown || ext.left) {
            this.setVelocityX(-this.moveSpeed);
            this.setFlipX(true);
        } else if (this.keys.right.isDown || ext.right) {
            this.setVelocityX(this.moveSpeed);
            this.setFlipX(false);
        }

        if ((this.keys.up.isDown || ext.up) && this.body.touching.down) {
            this.setVelocityY(this.jumpForce);
        }

        if (this.keys.down.isDown || ext.down) {
            this.block();
        } else {
            if (this.isBlocking) this.isBlocking = false;

            // Attack Check
            // Keys use JustDown. Touch uses raw state, but we need to ensure it doesn't spam.
            // Simple approach: if ext.attack1 is true, trigger. The 'jab' function sets isAttacking=true immediately so it prevents spamming anyway.
            if (Phaser.Input.Keyboard.JustDown(this.keys.attack1) || ext.attack1) {
                this.jab(time);
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.attack2) || ext.attack2) {
                this.kick(time);
            }
        }
    }

    handleAI(time) {
        if (!this.body || this.isAttacking) return;

        if (!this.nextActionTime) this.nextActionTime = 0;
        if (time < this.nextActionTime) return;

        const opponent = (this.scene.fighter1 === this) ? this.scene.fighter2 : this.scene.fighter1;
        if (!opponent) return;

        const dist = Phaser.Math.Distance.Between(this.x, this.y, opponent.x, opponent.y);

        let reactionTime = 1000;
        let aggression = 0.3;

        const difficulty = this.scene.difficulty || 'normal';
        if (difficulty === 'hard') { reactionTime = 400; aggression = 0.8; }
        else if (difficulty === 'normal') { reactionTime = 700; aggression = 0.5; }

        this.nextActionTime = time + reactionTime;
        this.setVelocityX(0);

        if (dist < 150) {
            if (Math.random() < aggression) {
                if (Math.random() < 0.5) this.jab(time);
                else this.kick(time);
            } else {
                if (Math.random() < 0.5) {
                    this.block();
                    this.scene.time.delayedCall(500, () => {
                        this.isBlocking = false;
                    });
                } else {
                    const dir = this.x < opponent.x ? -1 : 1;
                    this.setVelocityX(dir * -this.moveSpeed);
                }
            }
        } else {
            if (Math.random() < 0.8) {
                const dir = this.x < opponent.x ? 1 : -1;
                this.setVelocityX(dir * this.moveSpeed);
                this.setFlipX(dir === -1);
            }
        }
    }

    block() {
        if (!this.isBlocking && this.blockMeter < 10) return;
        if (this.blockMeter <= 0) {
            this.isBlocking = false;
            return;
        }

        this.isBlocking = true;
        this.setVelocityX(0);
        this.blockMeter -= 0.5;

        if (!this.shieldSprite) {
            this.shieldSprite = this.scene.add.rectangle(this.x + (this.flipX ? -40 : 40), this.y, 10, 100, 0x0000ff, 0.5);
        }
    }

    addToCombo(action, time) {
        this.lastComboTime = time;
        this.comboBuffer.push(action);
        if (this.comboBuffer.length > 3) this.comboBuffer.shift();

        // Combo 1: Jab-Jab-Kick
        if (this.comboBuffer.length === 3 &&
            this.comboBuffer[0] === 'jab' &&
            this.comboBuffer[1] === 'jab' &&
            this.comboBuffer[2] === 'kick') {

            this.fillSpecialMeter(100);
            this.comboBuffer = [];
        }
        // Combo 2: Kick-Kick-Jab
        else if (this.comboBuffer.length === 3 &&
            this.comboBuffer[0] === 'kick' &&
            this.comboBuffer[1] === 'kick' &&
            this.comboBuffer[2] === 'jab') {

            this.fillSpecialMeter(100);
            this.comboBuffer = [];
        }
    }

    fillSpecialMeter(amount) {
        if (this.specialMeter >= 100) return;

        this.specialMeter += amount;
        if (this.specialMeter >= 100) {
            this.specialMeter = 100;
            this.activateSpecial();
        }
    }

    showPopup(text) {
        const popup = this.scene.add.text(this.x, this.y - 100, text, {
            fontSize: '32px', color: '#ffff00', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);

        this.scene.tweens.add({
            targets: popup,
            y: this.y - 150,
            alpha: 0,
            duration: 1000,
            onComplete: () => popup.destroy()
        });
    }

    jab(time) {
        if (this.isAttacking) return;
        this.isAttacking = true;

        // Attack Speed Scaling
        const speedMult = this.moveSpeed / 300; // baseMoveSpeed is 300 @ 100 stats
        // faster speed = shorter duration
        // Base duration 100ms. If speed is 150%, duration should be ~66ms.
        const duration = 100 / speedMult;

        this.scene.tweens.add({
            targets: this,
            x: this.x + (this.flipX ? -30 : 30),
            duration: duration,
            yoyo: true,
            onComplete: () => { this.isAttacking = false; }
        });

        this.createHitbox(this.jabDamage, 'jab');
    }

    kick(time) {
        if (this.isAttacking) return;
        this.isAttacking = true;

        const speedMult = this.moveSpeed / 300;
        const duration = 150 / speedMult;

        this.scene.tweens.add({
            targets: this,
            angle: this.flipX ? 15 : -15,
            duration: duration,
            yoyo: true,
            onComplete: () => {
                this.angle = 0;
                this.isAttacking = false;
            }
        });

        this.createHitbox(this.kickDamage, 'kick');
    }

    createHitbox(damage, type) {
        const baseOffset = 60;
        const offsetX = (this.flipX ? -baseOffset : baseOffset) * this.rangeMultiplier;

        const hitbox = this.scene.add.rectangle(this.x + offsetX, this.y, 80 * this.rangeMultiplier, 80, 0xff0000, 0.5);
        this.scene.physics.add.existing(hitbox);

        const opponent = this.scene.fighter1 === this ? this.scene.fighter2 : this.scene.fighter1;

        if (opponent) {
            this.scene.physics.overlap(hitbox, opponent, () => {
                // ADDED: Combo only on HIT
                this.addToCombo(type, this.scene.time.now);

                if (opponent.isBlocking && !this.ignoreDefense) {
                    opponent.blockMeter -= 5;
                } else {
                    opponent.takeDamage(damage);
                    this.fillSpecialMeter(10);
                }
            });
        }

        this.scene.time.delayedCall(100, () => {
            hitbox.destroy();
        });
    }

    takeDamage(amount) {
        // Shield absorb
        if (this.tempShield > 0) {
            this.tempShield -= amount;
            if (this.tempShield < 0) {
                this.health += this.tempShield; // Shield breaks, bleed through
                this.tempShield = 0;
            }
        } else {
            this.health -= amount;
        }

        if (this.health < 0) this.health = 0;

        this.comboBuffer = [];

        this.setTint(0xff0000);
        this.scene.time.delayedCall(100, () => {
            this.clearTint();
        });

        this.setVelocityX(this.flipX ? 200 : -200);
        this.setVelocityY(-200);
    }
}
