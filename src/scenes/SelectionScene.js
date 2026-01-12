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

        // Stat Bars
        this.statBars = [];
        const stats = ['Health', 'Speed', 'Damage'];
        stats.forEach((stat, i) => {
            const barY = isMobile ? (10 + i * 30) : (50 + i * 40);
            const label = this.add.text(-150, barY, stat, { fontSize: '18px', color: '#fff' }).setOrigin(0, 0.5);
            const barBg = this.add.rectangle(0, barY, 200, 10, 0x333333).setOrigin(0, 0.5);
            const barFill = this.add.rectangle(0, barY, 0, 10, 0x00ffff).setOrigin(0, 0.5);
            this.infoContainer.add([label, barBg, barFill]);
            this.statBars.push(barFill);
        });

        this.infoSpecial = this.add.text(0, isMobile ? 100 : 150, '', { fontSize: '16px', color: '#00ff00', align: 'center', wordWrap: { width: 320 } }).setOrigin(0.5);
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

    selectFighter(index, boxObj, size) {
        this.selectedIndex = index;
        this.updateInfoPanel(index);

        if (this.currentSelectionEffect) this.currentSelectionEffect.destroy();
        this.currentSelectionEffect = this.add.rectangle(boxObj.x, boxObj.y, size, size, 0x00ff00, 0).setStrokeStyle(4, 0x00ff00);

        // --- Confirm Button (Always Visible ON TOP) ---
        // Ensure it's reachable on mobile
        const { width, height } = this.scale;

        if (!this.confirmBtn) {
            // Position: Bottom Right on Desktop, Bottom Center on Mobile
            const btnX = width < 900 ? width / 2 : width - 200;
            const btnY = height - 60;

            this.confirmBtn = this.add.container(btnX, btnY).setDepth(100); // High Depth!
            const btnBg = this.add.rectangle(0, 0, 200, 60, 0x00cc00).setInteractive();
            const btnTxt = this.add.text(0, 0, 'CONFIRM', { fontSize: '28px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
            this.confirmBtn.add([btnBg, btnTxt]);

            btnBg.on('pointerdown', () => {
                console.log("Confirm Clicked");
                this.confirmSelection();
            });
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
