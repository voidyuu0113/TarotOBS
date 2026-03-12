import type { Texture } from 'pixi.js';
import { CARD_HEIGHT, CARD_WIDTH } from './CardModel';

export interface CardDisplaySize {
  width: number;
  height: number;
  radius: number;
  aspectRatio: number;
}

const DEFAULT_ASPECT_RATIO = CARD_WIDTH / CARD_HEIGHT;
const MIN_ASPECT_RATIO = 0.55;
const MAX_ASPECT_RATIO = 0.9;

function normalizeAspectRatio(value: number | null | undefined): number {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_ASPECT_RATIO;
  }
  return Math.max(MIN_ASPECT_RATIO, Math.min(MAX_ASPECT_RATIO, value));
}

export function getCardAspectRatio(frontTexture: Texture | null, backTexture: Texture | null): number {
  const frontRatio = frontTexture ? frontTexture.width / frontTexture.height : null;
  const backRatio = backTexture ? backTexture.width / backTexture.height : null;
  return normalizeAspectRatio(frontRatio ?? backRatio ?? DEFAULT_ASPECT_RATIO);
}

export function getCardDisplaySize(frontTexture: Texture | null, backTexture: Texture | null): CardDisplaySize {
  const aspectRatio = getCardAspectRatio(frontTexture, backTexture);
  const height = CARD_HEIGHT;
  const width = Math.round(height * aspectRatio);
  return {
    width,
    height,
    radius: Math.max(10, Math.round(Math.min(width, height) * 0.08)),
    aspectRatio,
  };
}

