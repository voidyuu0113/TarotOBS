import type { AssetFolder, AssetRecord, DeckPreset } from '../deck/DeckTypes';

export interface TarotPackAssetEntry {
  asset: AssetRecord;
  path: string;
}

export interface TarotPackManifest {
  kind: 'tarotpack';
  version: 2;
  exportedAt: number;
  preset: DeckPreset;
  folders: AssetFolder[];
  assets: TarotPackAssetEntry[];
}

export interface TarotPackBinaryAssetEntry {
  asset: AssetRecord;
  path: string;
  blob: Blob;
}

export interface TarotPackArchive {
  manifest: TarotPackManifest;
  assets: TarotPackBinaryAssetEntry[];
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(blob);
  });
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toFixedAsciiBytes(value: string, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const encoded = textEncoder.encode(value);
  bytes.set(encoded.subarray(0, length));
  return bytes;
}

function writeOctal(value: number, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const octal = Math.max(0, value).toString(8).padStart(length - 1, '0');
  const encoded = textEncoder.encode(octal);
  bytes.set(encoded.subarray(0, length - 1), 0);
  bytes[length - 1] = 0;
  return bytes;
}

function createTarHeader(path: string, size: number): Uint8Array {
  const header = new Uint8Array(512);
  header.set(toFixedAsciiBytes(path, 100), 0);
  header.set(writeOctal(0o644, 8), 100);
  header.set(writeOctal(0, 8), 108);
  header.set(writeOctal(0, 8), 116);
  header.set(writeOctal(size, 12), 124);
  header.set(writeOctal(Math.floor(Date.now() / 1000), 12), 136);
  header.fill(0x20, 148, 156);
  header[156] = '0'.charCodeAt(0);
  header.set(toFixedAsciiBytes('ustar', 6), 257);
  header.set(toFixedAsciiBytes('00', 2), 263);
  let checksum = 0;
  for (const byte of header) {
    checksum += byte;
  }
  const checksumBytes = writeOctal(checksum, 8);
  checksumBytes[6] = 0;
  checksumBytes[7] = 0x20;
  header.set(checksumBytes, 148);
  return header;
}

function padTarBlock(data: Uint8Array): Uint8Array {
  const paddedLength = Math.ceil(data.length / 512) * 512;
  if (paddedLength === data.length) {
    return data;
  }
  const padded = new Uint8Array(paddedLength);
  padded.set(data);
  return padded;
}

function readTarString(bytes: Uint8Array): string {
  const zeroIndex = bytes.indexOf(0);
  const slice = zeroIndex >= 0 ? bytes.subarray(0, zeroIndex) : bytes;
  return textDecoder.decode(slice).trim();
}

function parseTarArchive(buffer: ArrayBuffer): Map<string, Uint8Array> {
  const bytes = new Uint8Array(buffer);
  const files = new Map<string, Uint8Array>();
  let offset = 0;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    const isEmpty = header.every((byte) => byte === 0);
    if (isEmpty) {
      break;
    }

    const path = readTarString(header.subarray(0, 100));
    if (!path) {
      break;
    }
    const sizeRaw = readTarString(header.subarray(124, 136));
    const size = Number.parseInt(sizeRaw || '0', 8) || 0;
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > bytes.length) {
      throw new Error('Invalid tarotpack archive');
    }
    files.set(path, bytes.slice(dataStart, dataEnd));
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return files;
}

function createJsonBlob(payload: unknown): Blob {
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

function sanitizePathSegment(value: string, fallback: string): string {
  const sanitized = value
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return sanitized || fallback;
}

function getAssetExtension(filename: string): string {
  const match = /\.[^.]+$/.exec(filename);
  return match ? match[0].toLowerCase() : '.bin';
}

export function createTarotPackFilename(deckName: string): string {
  return `${sanitizePathSegment(deckName, 'deck')}.tarotpack`;
}

export function createTarotPackShareText(filename: string, packDataUrl: string): string {
  const payload = JSON.stringify({ filename, packDataUrl });
  const html = `<!doctype html><meta charset="utf-8"><title>${filename}</title><script id="tarotpack-data" type="application/json">${payload.replace(/</g, '\\u003c')}</script><body style="font-family:Georgia,serif;padding:24px;background:#111;color:#f4e7c8"><p>Tarot pack ready.</p><p><a id="download" href="#" style="color:#f4e7c8">Download ${filename}</a></p><script>const payload=JSON.parse(document.getElementById('tarotpack-data').textContent);const link=document.getElementById('download');link.href=payload.packDataUrl;link.download=payload.filename;setTimeout(()=>link.click(),50);</script></body>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

export function createTarotPackAssetPath(asset: AssetRecord, index: number): string {
  const baseName = sanitizePathSegment(asset.filename.replace(/\.[^.]+$/, ''), asset.id || `asset-${index + 1}`);
  return `assets/${String(index + 1).padStart(3, '0')}-${baseName}${getAssetExtension(asset.filename)}`;
}

export async function createTarotPackBlob(archive: TarotPackArchive): Promise<Blob> {
  const entries: BlobPart[] = [];
  const manifestBlob = createJsonBlob(archive.manifest);
  const manifestBytes = new Uint8Array(await manifestBlob.arrayBuffer());
  entries.push(toArrayBuffer(createTarHeader('manifest.json', manifestBytes.length)), toArrayBuffer(padTarBlock(manifestBytes)));

  for (const asset of archive.assets) {
    const assetBytes = new Uint8Array(await asset.blob.arrayBuffer());
    entries.push(toArrayBuffer(createTarHeader(asset.path, assetBytes.length)), toArrayBuffer(padTarBlock(assetBytes)));
  }

  entries.push(new ArrayBuffer(1024));
  return new Blob(entries, { type: 'application/x-tar' });
}

export async function downloadBlob(filename: string, blob: Blob): Promise<void> {
  const url = await blobToDataUrl(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
  }, 60_000);
}

export async function saveBlobFile(filename: string, blob: Blob): Promise<void> {
  const supportsFilePicker = typeof window !== 'undefined' && 'showSaveFilePicker' in window;
  if (!supportsFilePicker) {
    await downloadBlob(filename, blob);
    return;
  }

  const handle = await (window as any).showSaveFilePicker({
    suggestedName: filename,
    types: [
      {
        description: 'Tarot Pack',
        accept: {
          'application/x-tar': ['.tarotpack'],
        },
      },
    ],
  });
  const writable = await handle.createWritable();
  await writable.write(await blob.arrayBuffer());
  await writable.close();
}

export async function parseTarotPackFile(file: File): Promise<TarotPackArchive | null> {
  try {
    return await parseTarotPackBlob(file);
  } catch {
    return null;
  }
}

export async function parseTarotPackDataUrl(dataUrl: string): Promise<TarotPackArchive | null> {
  try {
    if (dataUrl.startsWith('data:text/html')) {
      const response = await fetch(dataUrl);
      const html = await response.text();
      const match = html.match(/<script id="tarotpack-data" type="application\/json">([\s\S]*?)<\/script>/i);
      if (!match) {
        return null;
      }
      const payload = JSON.parse(match[1]) as { filename?: string; packDataUrl?: string };
      if (!payload.packDataUrl) {
        return null;
      }
      return await parseTarotPackDataUrl(payload.packDataUrl);
    }
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return await parseTarotPackBlob(blob);
  } catch {
    return null;
  }
}

async function parseTarotPackBlob(blob: Blob): Promise<TarotPackArchive | null> {
  try {
    const bytes = await blob.arrayBuffer();
    const entries = parseTarArchive(bytes);
    const manifestBytes = entries.get('manifest.json');
    if (!manifestBytes) {
      return null;
    }

    const manifest = JSON.parse(textDecoder.decode(manifestBytes)) as TarotPackManifest;
    if (manifest.kind !== 'tarotpack' || manifest.version !== 2 || !manifest.preset || !Array.isArray(manifest.assets)) {
      return null;
    }

    const assets: TarotPackBinaryAssetEntry[] = manifest.assets.map((entry) => {
      const assetBytes = entries.get(entry.path);
      if (!assetBytes) {
        throw new Error(`Missing asset file: ${entry.path}`);
      }
      return {
        asset: { ...entry.asset },
        path: entry.path,
        blob: new Blob([toArrayBuffer(assetBytes)]),
      };
    });

    return {
      manifest,
      assets,
    };
  } catch {
    return null;
  }
}
