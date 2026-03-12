import { Texture } from 'pixi.js';
import type { AssetRecord } from '../deck/DeckTypes';
import { PresetStorage } from '../storage/PresetStorage';

interface TextureRecord {
  texture: Texture;
  refCount: number;
  objectUrl?: string;
}

export class AssetManager {
  // AssetManager is the single owner of live Pixi textures. Other modules should only store asset ids
  // and ask AssetManager to acquire/release/getTexture rather than creating/destroying textures directly.
  private readonly cache = new Map<string, TextureRecord>();

  constructor(private readonly storage: PresetStorage) {}

  async acquireAssets(assetIds: string[]): Promise<void> {
    for (const assetId of assetIds) {
      const existing = this.cache.get(assetId);
      if (existing) {
        existing.refCount += 1;
        continue;
      }
      const blob = await this.storage.getAssetBlob(assetId);
      if (!blob) {
        continue;
      }
      const objectUrl = URL.createObjectURL(blob);
      const image = await this.loadImage(objectUrl);
      const texture = Texture.from(image);
      this.cache.set(assetId, {
        texture,
        refCount: 1,
        objectUrl,
      });
    }
  }

  async warmAssets(assets: AssetRecord[]): Promise<void> {
    await this.acquireAssets(assets.map((asset) => asset.id));
  }

  releaseAssets(assetIds: string[]): void {
    for (const assetId of assetIds) {
      const existing = this.cache.get(assetId);
      if (!existing) {
        continue;
      }
      existing.refCount -= 1;
      if (existing.refCount > 0) {
        continue;
      }
      existing.texture.destroy(true);
      if (existing.objectUrl) {
        URL.revokeObjectURL(existing.objectUrl);
      }
      this.cache.delete(assetId);
    }
  }

  forgetAsset(assetId: string): void {
    // Escape hatch for explicit cleanup only. Normal lifecycle should go through acquire/release ref-counting.
    const existing = this.cache.get(assetId);
    if (!existing) {
      return;
    }
    existing.texture.destroy(true);
    if (existing.objectUrl) {
      URL.revokeObjectURL(existing.objectUrl);
    }
    this.cache.delete(assetId);
  }

  getTexture(assetId: string): Texture | null {
    return this.cache.get(assetId)?.texture ?? null;
  }

  private async loadImage(objectUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load texture asset ${objectUrl}`));
      image.src = objectUrl;
    });
  }
}
