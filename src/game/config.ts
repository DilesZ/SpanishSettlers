// Config Phaser — skill: game-setup-and-config + scale-and-responsive.
// AUTO renderer, pixelArt para look retro-nítido, Scale.RESIZE para Vercel/responsive.
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0d1f16',
    pixelArt: true,
    roundPixels: true,
    fps: { target: 60 },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: parent.clientWidth || 1280,
      height: parent.clientHeight || 720,
    },
    scene: [BootScene, GameScene],
  };
}
