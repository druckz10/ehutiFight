import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Load fighter images
        for (let i = 0; i < 8; i++) {
            this.load.image(`fighter_${i}`, `assets/fighters/fighter_${i}.png`);
        }
    }

    create() {
        // Process textures to remove white backgrounds
        for (let i = 0; i < 8; i++) {
            this.removeWhiteBackground(`fighter_${i}`);
        }

        this.scene.start('MenuScene');
    }

    removeWhiteBackground(key) {
        const texture = this.textures.get(key);
        const image = texture.getSourceImage();

        // Create a canvas to process the image
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(image, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Threshold for "White"
        const threshold = 230;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // If pixel is White-ish
            if (r > threshold && g > threshold && b > threshold) {
                data[i + 3] = 0; // Set Alpha to 0
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // Update the Phaser texture with the new canvas data
        this.textures.remove(key);
        this.textures.addCanvas(key, canvas);
    }
}
