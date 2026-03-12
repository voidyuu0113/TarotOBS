import { PresetStorage } from '../storage/PresetStorage';

export interface AssetPreviewData {
  url: string;
  aspectRatio: number;
}

export class AssetPreviewManager {
  private readonly urls = new Map<string, string>();
  private readonly dimensions = new Map<string, number>();

  constructor(private readonly storage: PresetStorage) {}

  async getObjectUrl(assetId: string | null): Promise<string | null> {
    if (!assetId) {
      return null;
    }
    const existing = this.urls.get(assetId);
    if (existing) {
      return existing;
    }
    const blob = await this.storage.getAssetBlob(assetId);
    if (!blob) {
      return null;
    }
    const url = URL.createObjectURL(blob);
    this.urls.set(assetId, url);
    return url;
  }

  async getPreviewData(assetId: string | null): Promise<AssetPreviewData | null> {
    if (!assetId) {
      return null;
    }
    const url = await this.getObjectUrl(assetId);
    if (!url) {
      return null;
    }
    const existingAspectRatio = this.dimensions.get(assetId);
    if (existingAspectRatio) {
      return {
        url,
        aspectRatio: existingAspectRatio,
      };
    }
    const aspectRatio = await this.loadAspectRatio(url);
    this.dimensions.set(assetId, aspectRatio);
    return {
      url,
      aspectRatio,
    };
  }

  clear(): void {
    for (const url of this.urls.values()) {
      URL.revokeObjectURL(url);
    }
    this.urls.clear();
    this.dimensions.clear();
  }

  private async loadAspectRatio(url: string): Promise<number> {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 96 / 156);
      image.onerror = () => resolve(96 / 156);
      image.src = url;
    });
  }
}
