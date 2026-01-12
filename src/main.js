import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import MenuScene from './scenes/MenuScene';
import ModeSelectionScene from './scenes/ModeSelectionScene';
import SelectionScene from './scenes/SelectionScene';
import FightScene from './scenes/FightScene';

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#333333',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 1000 },
            debug: false
        }
    },
    scene: [BootScene, MenuScene, ModeSelectionScene, SelectionScene, FightScene]
};

const game = new Phaser.Game(config);
