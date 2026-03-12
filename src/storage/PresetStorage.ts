import { createEmptyAssignments } from '../tarot/TarotTemplate';
import type { AssetFolder, AssetRecord, DeckPreset, ExtraCardDefinition, PresetBaseMode } from '../deck/DeckTypes';

interface LegacyPresetRecord {
  id: string;
  name: string;
  fronts?: Array<{ assetId: string; filename: string; label: string }>;
  backAssetId?: string;
  backFilename?: string;
}

interface StoredPresetRecord {
  id: string;
  name: string;
  baseMode?: PresetBaseMode;
  backAssetId: string | null;
  assignments: Record<string, string | null>;
  extraCards: ExtraCardDefinition[];
  updatedAt: number;
}

interface StoredAssetRecord extends AssetRecord {
  blob: Blob;
}

interface LegacyAssetRecord {
  id?: string;
  filename?: string;
  label?: string;
  name?: string;
  kind?: 'front' | 'back';
  folderId?: string | null;
  blob?: Blob;
}

const DB_NAME = 'tarot-overlay-db';
const DB_VERSION = 3;
const PRESET_STORE = 'presets';
const ASSET_STORE = 'assets';
const FOLDER_STORE = 'folders';

export const ROOT_FOLDER_ID = 'root-folder';
export const BUILTIN_WAITE_FOLDER_ID = 'builtin-waite-folder';

export class PresetStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  async getPresets(): Promise<DeckPreset[]> {
    const db = await this.getDb();
    const records = await this.getAll<StoredPresetRecord | LegacyPresetRecord>(db, PRESET_STORE);
    return records.map((record) => this.normalizePreset(record)).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  async savePreset(preset: DeckPreset): Promise<void> {
    const db = await this.getDb();
    await this.runTransaction(db, [PRESET_STORE], 'readwrite', (tx) => {
      tx.objectStore(PRESET_STORE).put(preset satisfies StoredPresetRecord);
    });
  }

  async deletePreset(presetId: string): Promise<void> {
    const db = await this.getDb();
    await this.runTransaction(db, [PRESET_STORE], 'readwrite', (tx) => {
      tx.objectStore(PRESET_STORE).delete(presetId);
    });
  }

  async getAssets(): Promise<AssetRecord[]> {
    const db = await this.getDb();
    const records = await this.getAll<StoredAssetRecord | LegacyAssetRecord>(db, ASSET_STORE);
    return records
      .map((record) => this.normalizeAsset(record))
      .sort((a, b) => {
        const labelA = a.label || a.filename || a.id || 'Asset';
        const labelB = b.label || b.filename || b.id || 'Asset';
        return labelA.localeCompare(labelB, undefined, { numeric: true });
      });
  }

  async getFolders(): Promise<AssetFolder[]> {
    const db = await this.getDb();
    const folders = await this.getAll<AssetFolder>(db, FOLDER_STORE);
    if (folders.length === 0) {
      return [this.createRootFolder()];
    }
    return folders.sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  async saveFolder(folder: AssetFolder): Promise<void> {
    const db = await this.getDb();
    await this.runTransaction(db, [FOLDER_STORE], 'readwrite', (tx) => {
      tx.objectStore(FOLDER_STORE).put(folder);
    });
  }

  async saveAssets(assets: Array<{ asset: AssetRecord; blob: Blob }>): Promise<void> {
    const db = await this.getDb();
    await this.runTransaction(db, [ASSET_STORE], 'readwrite', (tx) => {
      const store = tx.objectStore(ASSET_STORE);
      for (const entry of assets) {
        store.put({
          ...entry.asset,
          blob: entry.blob,
        } satisfies StoredAssetRecord);
      }
    });
  }

  async deleteAsset(assetId: string): Promise<void> {
    const db = await this.getDb();
    await this.runTransaction(db, [ASSET_STORE], 'readwrite', (tx) => {
      tx.objectStore(ASSET_STORE).delete(assetId);
    });
  }

  async getAssetBlob(assetId: string): Promise<Blob | null> {
    const db = await this.getDb();
    const record = await this.getOne<StoredAssetRecord>(db, ASSET_STORE, assetId);
    return record?.blob ?? null;
  }

  private normalizePreset(record: StoredPresetRecord | LegacyPresetRecord): DeckPreset {
    if ('assignments' in record) {
      return {
        id: record.id,
        name: record.name,
        baseMode: record.baseMode === 'major22' ? 'major22' : 'full78',
        backAssetId: record.backAssetId,
        assignments: {
          ...createEmptyAssignments(),
          ...record.assignments,
        },
        extraCards: Array.isArray(record.extraCards) ? record.extraCards : [],
        updatedAt: record.updatedAt,
      };
    }

    return {
      id: record.id,
      name: record.name,
      baseMode: 'full78',
      backAssetId: record.backAssetId ?? null,
      assignments: createEmptyAssignments(),
      extraCards: [],
      updatedAt: Date.now(),
    };
  }

  private normalizeAsset(record: StoredAssetRecord | LegacyAssetRecord): AssetRecord {
    const id = typeof record.id === 'string' && record.id.trim() ? record.id : `legacy-asset-${crypto.randomUUID()}`;
    const filename = this.normalizeString(record.filename);
    const legacyName = 'name' in record ? this.normalizeString(record.name) : null;
    const label =
      this.normalizeString(record.label) ??
      legacyName ??
      filename ??
      id ??
      'Unnamed Asset';
    return {
      id,
      filename: filename ?? id,
      label,
      kind: record.kind === 'back' ? 'back' : 'front',
      folderId: typeof record.folderId === 'string' && record.folderId.trim() ? record.folderId : ROOT_FOLDER_ID,
    };
  }

  private normalizeString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(PRESET_STORE)) {
            db.createObjectStore(PRESET_STORE, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(ASSET_STORE)) {
            db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(FOLDER_STORE)) {
            db.createObjectStore(FOLDER_STORE, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
      });
    }
    return this.dbPromise;
  }

  private createRootFolder(): AssetFolder {
    return {
      id: ROOT_FOLDER_ID,
      name: 'All Assets',
      orderIndex: 0,
    };
  }

  private async getAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as T[]);
    });
  }

  private async getOne<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as T | undefined);
    });
  }

  private async runTransaction(
    db: IDBDatabase,
    storeNames: string[],
    mode: IDBTransactionMode,
    callback: (tx: IDBTransaction) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();
      callback(tx);
    });
  }
}
