import Phaser from 'phaser';
import { FighterStats } from '../config/FighterStats';

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
    }

    create() {
        const { width, height } = this.scale;

        this.titleText = this.add.text(width / 2, 50, this.getInstructionText(), {
            fontSize: '40px', fontFamily: 'Arial Black', color: '#ffffff', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);

        // --- Info Panel (Right Side) ---
        const panelX = width - 400; // Right side
        this.infoContainer = this.add.container(panelX, 150);

        // Background
        const bg = this.add.rectangle(0, 200, 350, 400, 0x000000, 0.8).setStrokeStyle(2, 0xffffff);
        this.infoContainer.add(bg);

        // Elements
        this.infoName = this.add.text(0, 50, 'Select Fighter', { fontSize: '32px', fontStyle: 'bold', color: '#ffff00' }).setOrigin(0.5);
        this.infoDesc = this.add.text(0, 100, 'Hover or Click to view stats.', { fontSize: '20px', color: '#cccccc', wordWrap: { width: 320 } }).setOrigin(0.5);
        this.infoSpecial = this.add.text(0, 250, '', { fontSize: '18px', color: '#00ff00', wordWrap: { width: 320 } }).setOrigin(0.5);

        // Stat Bars Helper
        this.statBars = [];
        const stats = ['Health', 'Speed', 'Damage'];
        stats.forEach((stat, i) => {
            const y = 320 + (i * 40);
            const label = this.add.text(-150, y, stat, { fontSize: '18px', color: '#fff' }).setOrigin(0, 0.5);
            const barBg = this.add.rectangle(0, y, 200, 10, 0x333333).setOrigin(0, 0.5);
            const barFill = this.add.rectangle(0, y, 0, 10, 0x00ffff).setOrigin(0, 0.5);
            this.infoContainer.add([label, barBg, barFill]);
            this.statBars.push(barFill);
        });

        this.infoContainer.add([this.infoName, this.infoDesc, this.infoSpecial]);


        // --- Fighter Grid (Left Side) ---
        const startX = 150;
        const startY = 150;
        const cols = 3;
        const gap = 160;

        for (let i = 0; i < 8; i++) {
            const x = startX + (i % cols) * gap;
            const y = startY + Math.floor(i / cols) * gap;

            const box = this.add.rectangle(x, y, 140, 140, 0x444444).setInteractive();
            const img = this.add.image(x, y, `fighter_${i}`);

            // Scale and Fit
            const scale = 120 / Math.max(img.width, img.height);
            img.setScale(scale);

            // Interaction
            box.on('pointerover', () => {
                box.setFillStyle(0x666666);
                this.updateInfoPanel(i);
            });
            box.on('pointerout', () => {
                if (this.selectedIndex !== i) { // Keep highlight if selected
                    box.setFillStyle(0x444444);
                }
            });
            box.on('pointerdown', () => {
                this.selectFighter(i, box);
            });
        }

        this.currentSelectionEffect = null;
        this.selectedIndex = -1;
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
        this.infoSpecial.setText(`SPECIAL\n${data.special || '???'}`);

        // Update Bars (Normalize nicely)
        // Health: 100-225
        this.statBars[0].width = 200 * (data.health / 225);
        // Speed: 50-150
        this.statBars[1].width = 200 * (data.speed / 150);
        // Damage (Kick+Jab avg): ~100
        const avgDmg = (data.kick + data.jab) / 2;
        this.statBars[2].width = 200 * (avgDmg / 140);
    }

    selectFighter(index, boxObj) {
        // Confirmation Logic: Click once to select, Click "CONFIRM" button (or double click) to go.
        // Let's stick to: Click -> Sets Selection -> Shows CONFIRM Button.

        this.selectedIndex = index;
        this.updateInfoPanel(index);

        // Highlight visual
        if (this.currentSelectionEffect) this.currentSelectionEffect.destroy();
        this.currentSelectionEffect = this.add.rectangle(boxObj.x, boxObj.y, 140, 140, 0x00ff00, 0).setStrokeStyle(4, 0x00ff00);

        // Show Confirm Button (Creates or reusing)
        if (!this.confirmBtn) {
            const { width, height } = this.scale;
            this.confirmBtn = this.add.container(width - 200, height - 100);
            const btnBg = this.add.rectangle(0, 0, 200, 60, 0x00cc00).setInteractive();
            const btnTxt = this.add.text(0, 0, 'CONFIRM', { fontSize: '28px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
            this.confirmBtn.add([btnBg, btnTxt]);

            btnBg.on('pointerdown', () => this.confirmSelection());
            btnBg.on('pointerover', () => btnBg.setFillStyle(0x00ff00));
            btnBg.on('pointerout', () => btnBg.setFillStyle(0x00cc00));
        }

        this.confirmBtn.setVisible(true);
    }

    confirmSelection() {
        if (this.selectedIndex === -1) return;

        // Same logic as before
        const index = this.selectedIndex;
        let finalSelection = index;
        if (index === 7) finalSelection = Math.floor(Math.random() * 7);

        const selectionKey = `fighter_${finalSelection}`;
        this.confirmBtn.setVisible(false);
        if (this.currentSelectionEffect) {
            this.currentSelectionEffect.destroy();
            this.currentSelectionEffect = null;
        }
        this.selectedIndex = -1;

        if (this.gameMode === 'online') {
            this.p1Selection = selectionKey;
            this.p2Selection = 'fighter_0';
            this.startGame();
            return;
        }

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
