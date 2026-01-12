import Phaser from 'phaser';
import NetworkManager from '../services/NetworkManager';

export default class ModeSelectionScene extends Phaser.Scene {
    constructor() {
        super('ModeSelectionScene');
    }

    create() {
        const { width, height } = this.scale;

        this.add.text(width / 2, 100, 'SELECT MODE', {
            fontSize: '48px',
            fontFamily: 'Arial Black',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Buttons
        this.createButton(width / 2, 250, 'OFFLINE', () => {
            this.showOfflineOptions();
        });

        this.createButton(width / 2, 400, 'ONLINE', () => {
            this.showOnlineOptions();
        });
    }

    createButton(x, y, text, callback) {
        const bg = this.add.rectangle(x, y, 400, 80, 0x444444).setInteractive();
        const label = this.add.text(x, y, text, { fontSize: '32px', color: '#fff' }).setOrigin(0.5);

        bg.on('pointerover', () => bg.setFillStyle(0x666666));
        bg.on('pointerout', () => bg.setFillStyle(0x444444));
        bg.on('pointerdown', callback);

        return { bg, label };
    }

    showOfflineOptions() {
        // Clear current buttons (simple way: restart scene with state or just hide/destroy)
        // For MVP, simple clear:
        this.children.removeAll();

        const { width, height } = this.scale;

        this.add.text(width / 2, 100, 'OFFLINE MODE', {
            fontSize: '48px',
            fontFamily: 'Arial Black',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.createButton(width / 2, 250, 'VS AI', () => {
            this.showDifficultyOptions();
        });

        this.createButton(width / 2, 400, 'LOCAL 2 PLAYER', () => {
            this.scene.start('SelectionScene', { mode: 'local', difficulty: null });
        });

        this.createButton(width / 2, 550, 'BACK', () => {
            this.scene.restart();
        });
    }

    showOnlineOptions() {
        this.children.removeAll();
        const { width, height } = this.scale;

        this.add.text(width / 2, 80, 'ONLINE MODE', {
            fontSize: '48px', fontFamily: 'Arial Black', color: '#ffffff', stroke: '#000', strokeThickness: 6
        }).setOrigin(0.5);

        // Host Button
        this.createButton(width / 2, 200, 'HOST GAME', () => {
            this.children.removeAll();
            this.add.text(width / 2, 100, 'HOSTING...', { fontSize: '32px', color: '#fff' }).setOrigin(0.5);

            const statusText = this.add.text(width / 2, 200, 'Generating Code...', { fontSize: '24px', color: '#ffff00' }).setOrigin(0.5);

            NetworkManager.initialize();
            NetworkManager.hostGame(() => {
                // On Connected
                this.scene.start('SelectionScene', { mode: 'online', role: 'host' });
            });

            // Poll for ID
            const checkId = setInterval(() => {
                if (NetworkManager.myId) {
                    // Strip the prefix for display
                    const displayCode = NetworkManager.myId.replace('EHUTI-', '');
                    statusText.setText(`YOUR CODE: ${displayCode}`);

                    this.add.text(width / 2, 300, 'Share this code with a friend.', { fontSize: '20px', color: '#aaa' }).setOrigin(0.5);
                    this.add.text(width / 2, 350, 'Waiting for opponent...', { fontSize: '20px', animate: true, color: '#00ff00' }).setOrigin(0.5);
                    clearInterval(checkId);
                }
            }, 500);
        });

        // Join Button
        this.createButton(width / 2, 350, 'JOIN GAME', () => {
            const rawInput = window.prompt("Enter Host Code (e.g. A1B2):");
            if (rawInput) {
                // Sanitize: Uppercase and trim
                const hostId = rawInput.trim().toUpperCase();

                this.children.removeAll();
                const status = this.add.text(width / 2, 300, `CONNECTING TO ${hostId}...`, { fontSize: '32px', color: '#ffff00' }).setOrigin(0.5);
                const errorText = this.add.text(width / 2, 400, '', { fontSize: '24px', color: '#ff0000' }).setOrigin(0.5);

                NetworkManager.initialize();

                // Give it a moment to init own ID before joining
                setTimeout(() => {
                    NetworkManager.joinGame(hostId,
                        () => {
                            // Success
                            this.scene.start('SelectionScene', { mode: 'online', role: 'client' });
                        },
                        (errorMsg) => {
                            // Error Callback
                            status.setText("CONNECTION FAILED");
                            errorText.setText(errorMsg + "\nTap BACK to try again.");

                            // Add Back Button dynamically
                            this.createButton(width / 2, 550, 'BACK', () => this.scene.restart());
                        }
                    );
                }, 1000);
            }
        });

        // Back
        this.createButton(width / 2, 500, 'BACK', () => {
            this.scene.restart();
        });
    }

    showDifficultyOptions() {
        this.children.removeAll();
        const { width, height } = this.scale;

        this.add.text(width / 2, 100, 'SELECT DIFFICULTY', {
            fontSize: '48px',
            fontFamily: 'Arial Black',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        const difficulties = ['EASY', 'NORMAL', 'HARD'];
        difficulties.forEach((diff, index) => {
            this.createButton(width / 2, 250 + (index * 120), diff, () => {
                this.scene.start('SelectionScene', { mode: 'ai', difficulty: diff.toLowerCase() });
            });
        });
    }
}
