import Phaser from 'phaser';
import { FighterStats } from '../config/FighterStats';
import NetworkManager from '../services/NetworkManager';

export default class SelectionScene extends Phaser.Scene {
    constructor() {
        super('SelectionScene');
    }

    init(data) {
        this.gameMode = data.mode || 'ai'; // 'ai', 'local', 'online'
        this.difficulty = data.difficulty || 'normal';
        this.role = data.role || 'host'; // 'host' or 'client' for online
        this.p1Selection = null;
        this.p2Selection = null;

        // Clear any stale network listeners from previous sessions
        // This prevents old "GAME_START" events from firing if we are now offline
        if (this.gameMode !== 'online') {
            if (NetworkManager && NetworkManager.onData) NetworkManager.onData(null);
        }
    }

    create() {
        const { width, height } = this.scale;
        const isMobile = width < 900;

        let titleText = 'PLAYER 1: CHOOSE';
        if (this.gameMode === 'online') titleText = 'YOUR FIGHTER';

        // Compact Title for Mobile
        this.titleText = this.add.text(width / 2, isMobile ? 40 : 50, this.getInstructionText(), {
            fontSize: isMobile ? '32px' : '40px',
            fontFamily: 'Arial Black',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // --- Layout Variables ---
        let gridX, gridY, gridScale, gridCols, gridGap;
        let infoX, infoY, infoScale;

        if (isMobile) {
            // Mobile: Grid Top, Info Bottom
            gridX = width / 2 - 250;
            gridY = 100;
            gridCols = 4; // 2 rows of 4
            gridGap = 130;
            gridScale = 0.8;

            infoX = width / 2;
            infoY = height - 150;
            infoScale = 0.8;
        } else {
            // Desktop: Grid Left, Info Right
            gridX = 150;
            gridY = 150;
            gridCols = 3;
            gridGap = 160;
            gridScale = 1.0;

            infoX = width - 300;
            infoY = 250;
            infoScale = 1.0;
        }

        // --- Info Panel ---
        this.infoContainer = this.add.container(infoX, infoY);
        this.infoContainer.setScale(infoScale);

        const infoBgW = 350;
        const infoBgH = isMobile ? 250 : 400;

        // Background
        const bg = this.add.rectangle(0, 0, infoBgW, infoBgH, 0x000000, 0.8).setStrokeStyle(2, 0xffffff);
        this.infoContainer.add(bg);

        // Info Elements (Adjusted relative to container center 0,0)
        const txtY = isMobile ? -80 : -150;
        this.infoName = this.add.text(0, txtY, 'Select Fighter', { fontSize: '32px', fontStyle: 'bold', color: '#ffff00' }).setOrigin(0.5);
        this.infoDesc = this.add.text(0, txtY + 40, 'Tap to view stats.', { fontSize: '18px', color: '#cccccc', wordWrap: { width: 320 } }).setOrigin(0.5);

        // Stat Bars - Extended
        this.statBars = [];
        const stats = ['Health', 'Speed', 'Damage', 'Jump', 'Range'];

        // Compact spacing for mobile/desktop
        const startY = isMobile ? -50 : 50; // Adjusted startY to fit within infoBgH
        const spacing = isMobile ? 25 : 35;

        stats.forEach((stat, i) => {
            const barY = startY + (i * spacing);
            const label = this.add.text(-150, barY, stat, { fontSize: '16px', color: '#fff' }).setOrigin(0, 0.5);
            const barBg = this.add.rectangle(0, barY, 180, 8, 0x333333).setOrigin(0, 0.5);
            const barFill = this.add.rectangle(0, barY, 0, 8, 0x00ffff).setOrigin(0, 0.5);
            this.infoContainer.add([label, barBg, barFill]);
            this.statBars.push(barFill);
        });

        const specialY = startY + (stats.length * spacing) + (isMobile ? 20 : 30); // Adjusted specialY
        this.infoSpecial = this.add.text(0, specialY, '', { fontSize: '16px', color: '#00ff00', align: 'center', wordWrap: { width: 320 } }).setOrigin(0.5);
        this.infoContainer.add([this.infoName, this.infoDesc, this.infoSpecial]);


        // --- Fighter Grid ---
        for (let i = 0; i < 8; i++) {
            // Calculate grid pos
            const r = Math.floor(i / gridCols);
            const c = (i % gridCols);

            const x = (isMobile ? (width / 2 - (gridGap * 1.5) + c * gridGap) : (gridX + c * gridGap));
            const y = gridY + r * gridGap;

            const boxSize = 140 * gridScale;

            const box = this.add.rectangle(x, y, boxSize, boxSize, 0x444444).setInteractive();
            const img = this.add.image(x, y, `fighter_${i}`);

            const fitScale = (120 / Math.max(img.width, img.height)) * gridScale;
            img.setScale(fitScale);

            // Interaction
            box.on('pointerover', () => {
                box.setFillStyle(0x666666);
                this.updateInfoPanel(i);
            });
            box.on('pointerout', () => {
                if (this.selectedIndex !== i) box.setFillStyle(0x444444);
            });
            box.on('pointerdown', () => this.selectFighter(i, box, boxSize));
        }

        // --- Confirm Button (Pre-create to ensure existence) ---
        // Position: Bottom Right on Desktop, Bottom Center on Mobile
        const btnX = isMobile ? width / 2 : width - 200;
        const btnY = height - 120; // Safe zone

        this.confirmBtn = this.add.container(btnX, btnY).setDepth(200);

        const btnBg = this.add.rectangle(0, 0, 260, 80, 0x00cc00)
            .setInteractive({ useHandCursor: true })
            .setStrokeStyle(4, 0xffffff);

        const btnTxt = this.add.text(0, 0, 'CONFIRM', { fontSize: '36px', fontStyle: 'bold', color: '#ffffff' })
            .setOrigin(0.5);

        this.confirmBtn.add([btnBg, btnTxt]);

        // Interaction
        const onConfirm = () => {
            this.tweens.add({
                targets: this.confirmBtn,
                scaleX: 0.9, scaleY: 0.9,
                duration: 50,
                yoyo: true,
                onComplete: () => this.confirmSelection()
            });
        };

        // Use pointerdown for immediate feedback
        btnBg.on('pointerdown', onConfirm);

        // Pulse Effect
        this.tweens.add({
            targets: this.confirmBtn,
            scaleX: 1.05, scaleY: 1.05,
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        this.confirmBtn.setVisible(false); // Hidden by default
        this.currentSelectionEffect = null;
        this.selectedIndex = -1;

        // ONLINE HANDLER
        if (this.gameMode === 'online') {
            this.opponentSelection = null;
            this.mySelection = null;
            this.hasConfirmed = false;

            NetworkManager.onData((data) => {
                if (data.type === 'CHARACTER_SELECTED') {
                    // Sent by Client to Host, or Host to Client (if we want to sync visuals later)
                    // For now: Host receives Client's choice
                    if (this.role === 'host') {
                        this.opponentSelection = data.selection;
                        console.log("Opponent selected:", this.opponentSelection);
                        this.checkStartGame();
                    }
                } else if (data.type === 'GAME_START') {
                    // Sent by Host to Client
                    if (this.role === 'client') {
                        this.p1Selection = data.p1;
                        this.p2Selection = data.p2;
                        this.scene.start('FightScene', {
                            player1Texture: this.p1Selection,
                            player2Texture: this.p2Selection,
                            mode: 'online',
                            role: 'client'
                        });
                    }
                }
            });
        }
    }

    getInstructionText() {
        if (this.gameMode === 'online') return 'CHOOSE YOUR FIGHTER';
        if (!this.p1Selection) return 'PLAYER 1 SELECTION';
        return 'PLAYER 2 SELECTION';
    }

    updateInfoPanel(index) {
        const key = `fighter_${index}`;
        const data = FighterStats[key] || FighterStats['fighter_0'];

        this.infoName.setText(data.name || 'Unknown');
        this.infoDesc.setText(data.desc || '');
        this.infoSpecial.setText(`SPECIAL: ${data.special || '???'}`);

        // Update Bars (Max Width 180)
        // Health: Max 225
        this.statBars[0].width = 180 * (data.health / 225);
        // Speed: Max 150
        this.statBars[1].width = 180 * (data.speed / 150);
        // Damage: Max 150 (Kick/Jab)
        const avgDmg = (data.kick + data.jab) / 2;
        this.statBars[2].width = 180 * (avgDmg / 150);
        // Jump: Max 150
        this.statBars[3].width = 180 * (data.jump / 150);
        // Range: Max 150
        this.statBars[4].width = 180 * (data.range / 150);
    }

    selectFighter(index, boxObj, size) {
        this.selectedIndex = index;
        this.updateInfoPanel(index);

        if (this.currentSelectionEffect) this.currentSelectionEffect.destroy();
        this.currentSelectionEffect = this.add.rectangle(boxObj.x, boxObj.y, size, size, 0x00ff00, 0).setStrokeStyle(4, 0x00ff00);

        this.confirmBtn.setVisible(true);
    }

    confirmSelection() {
        if (this.selectedIndex === -1) return;

        const index = this.selectedIndex;
        let finalSelection = index;
        if (index === 7) finalSelection = Math.floor(Math.random() * 7);
        const selectionKey = `fighter_${finalSelection}`;

        // Disable UI
        this.confirmBtn.setVisible(false);
        if (this.currentSelectionEffect) {
            this.currentSelectionEffect.destroy();
            this.currentSelectionEffect = null;
        }
        this.selectedIndex = -1;

        // --- ONLINE LOGIC ---
        if (this.gameMode === 'online') {
            this.hasConfirmed = true;
            this.mySelection = selectionKey;

            this.infoName.setText("WAITING...");
            this.infoDesc.setText("Waiting for opponent...");

            if (this.role === 'host') {
                // Host Logic: Store my choice, check if ready
                this.p1Selection = this.mySelection; // Host is P1
                this.checkStartGame();
            } else {
                // Client Logic: Send choice to Host
                NetworkManager.send({ type: 'CHARACTER_SELECTED', selection: this.mySelection });
            }
            return;
        }

        // --- LOCAL/OFFLINE LOGIC ---
        if (!this.p1Selection) {
            this.p1Selection = selectionKey;
            if (this.gameMode === 'ai') {
                const aiIndex = Math.floor(Math.random() * 7);
                this.p2Selection = `fighter_${aiIndex}`;
                this.startGame();
            } else {
                this.titleText.setText('PLAYER 2 SELECTION');
            }
        } else {
            this.p2Selection = selectionKey;
            this.startGame();
        }
    }

    checkStartGame() {
        // Only Host runs this
        if (this.role === 'host' && this.hasConfirmed && this.opponentSelection) {
            this.p2Selection = this.opponentSelection; // Client is P2

            // Tell Client to Start
            NetworkManager.send({
                type: 'GAME_START',
                p1: this.p1Selection,
                p2: this.p2Selection
            });

            // Start Level
            this.startGame();
        }
    }

    startGame() {
        this.scene.start('FightScene', {
            player1Texture: this.p1Selection,
            player2Texture: this.p2Selection,
            mode: this.gameMode,
            difficulty: this.difficulty,
            role: this.role
        });
    }
}
