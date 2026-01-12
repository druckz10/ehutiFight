import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    create() {
        const { width, height } = this.scale;

        this.add.text(width / 2, height / 3, 'EHUTI FIGHT', {
            fontSize: '64px',
            fontFamily: 'Arial Black',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        const startText = this.add.text(width / 2, height / 2, 'TAP TO START', {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#00ff00'
        }).setOrigin(0.5);

        // Flash effect for start text
        this.tweens.add({
            targets: startText,
            alpha: 0,
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        this.input.on('pointerdown', () => {
            this.scene.start('ModeSelectionScene');
        });

        // Also allow spacebar
        this.input.keyboard.on('keydown-SPACE', () => {
            this.scene.start('ModeSelectionScene');
        });
    }
}
