import * as THREE from 'three';
import { seededRandom } from './appearance';

/** Procedural canvas textures for floors, so the office needs no downloaded image. */

function canvasTexture(
  size: number,
  draw: (context: CanvasRenderingContext2D, size: number) => void,
  repeat: number,
) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d')!, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function shade(hex: string, amount: number): string {
  const color = new THREE.Color(hex);
  color.offsetHSL(0, 0, amount);
  return `#${color.getHexString()}`;
}

/** Wood planks, one texture tile ≈ 2 m. */
export function woodTexture(base: string): THREE.CanvasTexture {
  return canvasTexture(
    512,
    (context, size) => {
      const random = seededRandom(42);
      const plank = size / 8;
      for (let row = 0; row < 8; row++) {
        let x = -random() * size;
        while (x < size) {
          const length = size * (0.35 + random() * 0.4);
          context.fillStyle = shade(base, (random() - 0.5) * 0.08);
          context.fillRect(x, row * plank, length, plank);
          context.strokeStyle = shade(base, -0.12);
          context.lineWidth = 1.5;
          context.strokeRect(x, row * plank, length, plank);
          for (let grain = 0; grain < 5; grain++) {
            context.strokeStyle = `rgba(0, 0, 0, ${0.03 + random() * 0.04})`;
            context.beginPath();
            const y = row * plank + random() * plank;
            context.moveTo(x, y);
            context.bezierCurveTo(x + length / 3, y + 3, x + (2 * length) / 3, y - 3, x + length, y);
            context.stroke();
          }
          x += length;
        }
      }
    },
    1,
  );
}

/** Low-pile office carpet: fine noise plus faint carpet-tile seams. */
export function carpetTexture(base: string): THREE.CanvasTexture {
  return canvasTexture(
    256,
    (context, size) => {
      const random = seededRandom(7);
      context.fillStyle = base;
      context.fillRect(0, 0, size, size);
      const image = context.getImageData(0, 0, size, size);
      for (let i = 0; i < image.data.length; i += 4) {
        const noise = (random() - 0.5) * 22;
        image.data[i] = Math.max(0, Math.min(255, image.data[i]! + noise));
        image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1]! + noise));
        image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2]! + noise));
      }
      context.putImageData(image, 0, 0);
      context.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      context.lineWidth = 2;
      context.strokeRect(0, 0, size, size);
    },
    1,
  );
}

/** Large light floor tiles for the corridor. */
export function tileTexture(base: string): THREE.CanvasTexture {
  return canvasTexture(
    256,
    (context, size) => {
      const random = seededRandom(3);
      const tile = size / 2;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          context.fillStyle = shade(base, (random() - 0.5) * 0.04);
          context.fillRect(i * tile, j * tile, tile, tile);
        }
      }
      context.strokeStyle = shade(base, -0.15);
      context.lineWidth = 2;
      for (let k = 0; k <= 2; k++) {
        context.beginPath();
        context.moveTo(k * tile, 0);
        context.lineTo(k * tile, size);
        context.moveTo(0, k * tile);
        context.lineTo(size, k * tile);
        context.stroke();
      }
    },
    1,
  );
}

/** Blends a room accent color into a neutral carpet color. */
export function carpetColor(accent: string): string {
  const color = new THREE.Color('#7d7a75').lerp(new THREE.Color(accent), 0.28);
  return `#${color.getHexString()}`;
}

function addNoise(context: CanvasRenderingContext2D, size: number, amount: number, seed: number): void {
  const random = seededRandom(seed);
  const image = context.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const noise = (random() - 0.5) * amount;
    for (let k = 0; k < 3; k++) image.data[i + k] = Math.max(0, Math.min(255, image.data[i + k]! + noise));
  }
  context.putImageData(image, 0, 0);
}

/** Lawn: noise and soft patches. One tile ≈ 8 m. */
export function grassTexture(): THREE.CanvasTexture {
  return canvasTexture(
    256,
    (context, size) => {
      const random = seededRandom(19);
      context.fillStyle = '#7a9a5c';
      context.fillRect(0, 0, size, size);
      for (let i = 0; i < 40; i++) {
        const x = random() * size;
        const y = random() * size;
        const radius = 10 + random() * 40;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        const tone = random() < 0.5 ? '95, 128, 70' : '140, 165, 95';
        gradient.addColorStop(0, `rgba(${tone}, 0.35)`);
        gradient.addColorStop(1, `rgba(${tone}, 0)`);
        context.fillStyle = gradient;
        // Drawn wrapped around the edges so the tile repeats seamlessly.
        for (const dx of [-size, 0, size]) {
          for (const dy of [-size, 0, size]) {
            context.save();
            context.translate(dx, dy);
            context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
            context.restore();
          }
        }
      }
      addNoise(context, size, 26, 5);
    },
    1,
  );
}

/** Concrete paving slabs (0.5 m), one tile = 2 m. Colors come from the material. */
export function pavingTexture(): THREE.CanvasTexture {
  return canvasTexture(
    256,
    (context, size) => {
      const random = seededRandom(23);
      const slab = size / 4;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          context.fillStyle = shade('#d8d4cc', (random() - 0.5) * 0.06);
          context.fillRect(i * slab, j * slab, slab, slab);
        }
      }
      addNoise(context, size, 14, 29);
      context.strokeStyle = 'rgba(0, 0, 0, 0.18)';
      context.lineWidth = 2;
      for (let k = 0; k <= 4; k++) {
        context.beginPath();
        context.moveTo(k * slab, 0);
        context.lineTo(k * slab, size);
        context.moveTo(0, k * slab);
        context.lineTo(size, k * slab);
        context.stroke();
      }
    },
    1,
  );
}

/** Plain asphalt, one tile = 4 m. */
export function asphaltTexture(): THREE.CanvasTexture {
  return canvasTexture(
    256,
    (context, size) => {
      context.fillStyle = '#4b4d51';
      context.fillRect(0, 0, size, size);
      addNoise(context, size, 30, 31);
    },
    1,
  );
}

/**
 * A 7 m wide road, one tile = 7 m of its length: U across (0 → 1), V along. Edge lines and a dashed
 * center line.
 */
export function roadTexture(): THREE.CanvasTexture {
  return canvasTexture(
    256,
    (context, size) => {
      context.fillStyle = '#46484c';
      context.fillRect(0, 0, size, size);
      addNoise(context, size, 26, 37);
      const meter = size / 7;
      context.fillStyle = 'rgba(235, 235, 228, 0.85)';
      context.fillRect(0.3 * meter, 0, 0.12 * meter, size);
      context.fillRect(size - 0.42 * meter, 0, 0.12 * meter, size);
      context.fillRect(size / 2 - 0.06 * meter, 0, 0.12 * meter, 3 * meter);
    },
    1,
  );
}

export const FACADE_BAYS = 8;
export const FACADE_FLOORS = 8;

/**
 * Facade of the neighboring buildings: FACADE_BAYS × FACADE_FLOORS windows, light walls (tinted by
 * the building color) and, in the emissive map, the windows lit at night.
 */
export function facadeTextures(): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const random = seededRandom(41);
  const lit: boolean[] = Array.from({ length: FACADE_BAYS * FACADE_FLOORS }, () => random() < 0.38);
  const draw = (emissive: boolean) => (context: CanvasRenderingContext2D, size: number) => {
    const cellX = size / FACADE_BAYS;
    const cellY = size / FACADE_FLOORS;
    context.fillStyle = emissive ? '#000000' : '#ece8e1';
    context.fillRect(0, 0, size, size);
    for (let bay = 0; bay < FACADE_BAYS; bay++) {
      for (let floor = 0; floor < FACADE_FLOORS; floor++) {
        const x = bay * cellX + cellX * 0.16;
        const y = floor * cellY + cellY * 0.22;
        const width = cellX * 0.68;
        const height = cellY * 0.56;
        if (emissive) {
          if (!lit[bay * FACADE_FLOORS + floor]) continue;
          context.fillStyle = random() < 0.25 ? '#cfe2ff' : '#ffd79a';
          context.fillRect(x, y, width, height);
        } else {
          const gradient = context.createLinearGradient(x, y, x + width, y + height);
          gradient.addColorStop(0, '#3a4756');
          gradient.addColorStop(1, '#6d7d8f');
          context.fillStyle = gradient;
          context.fillRect(x, y, width, height);
          context.fillStyle = 'rgba(0, 0, 0, 0.25)';
          context.fillRect(x - 2, y + height, width + 4, 3);
        }
      }
    }
  };
  return { map: canvasTexture(512, draw(false), 1), emissive: canvasTexture(512, draw(true), 1) };
}
