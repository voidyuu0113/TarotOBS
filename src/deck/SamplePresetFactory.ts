import { createEmptyAssignments } from '../tarot/TarotTemplate';
import type { AssetRecord, DeckPreset } from './DeckTypes';
import { t } from '../i18n';
import { BUILTIN_WAITE_FOLDER_ID } from '../storage/PresetStorage';

const bundledCardUrls = import.meta.glob('../../default-cards/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const MAJOR_FILENAMES = [
  '00-TheFool.png',
  '01-TheMagician.png',
  '02-TheHighPriestess.png',
  '03-TheEmpress.png',
  '04-TheEmperor.png',
  '05-TheHierophant.png',
  '06-TheLovers.png',
  '07-TheChariot.png',
  '08-Strength.png',
  '09-TheHermit.png',
  '10-WheelOfFortune.png',
  '11-Justice.png',
  '12-TheHangedMan.png',
  '13-Death.png',
  '14-Temperance.png',
  '15-TheDevil.png',
  '16-TheTower.png',
  '17-TheStar.png',
  '18-TheMoon.png',
  '19-TheSun.png',
  '20-Judgement.png',
  '21-TheWorld.png',
] as const;

const MAJOR_TEMPLATE_IDS = [
  'major_fool',
  'major_magician',
  'major_high_priestess',
  'major_empress',
  'major_emperor',
  'major_hierophant',
  'major_lovers',
  'major_chariot',
  'major_strength',
  'major_hermit',
  'major_wheel_of_fortune',
  'major_justice',
  'major_hanged_man',
  'major_death',
  'major_temperance',
  'major_devil',
  'major_tower',
  'major_star',
  'major_moon',
  'major_sun',
  'major_judgement',
  'major_world',
] as const;

const SUIT_FILE_PREFIX: Record<'wands' | 'cups' | 'swords' | 'pentacles', string> = {
  wands: 'Wands',
  cups: 'Cups',
  swords: 'Swords',
  pentacles: 'Pentacles',
};

const RANK_TEMPLATE_SUFFIX = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'page', 'knight', 'queen', 'king'] as const;

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to serialize canvas'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

async function fetchBundledBlob(filename: string): Promise<Blob | null> {
  const url = bundledCardUrls[`../../default-cards/${filename}`];
  if (!url) {
    return null;
  }
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  return response.blob();
}

function createBuiltinFrontAssetId(templateCardId: string): string {
  return `builtin-front-${templateCardId}`;
}

export function getBuiltinDefaultBackAssetId(): string {
  return 'default-back-asset';
}

export function isBuiltinAssetId(assetId: string): boolean {
  return assetId === getBuiltinDefaultBackAssetId() || assetId.startsWith('builtin-front-');
}

export function createBuiltinDefaultAssignments(): Record<string, string | null> {
  const assignments = createEmptyAssignments();

  MAJOR_TEMPLATE_IDS.forEach((templateCardId) => {
    assignments[templateCardId] = createBuiltinFrontAssetId(templateCardId);
  });

  (Object.keys(SUIT_FILE_PREFIX) as Array<keyof typeof SUIT_FILE_PREFIX>).forEach((suit) => {
    RANK_TEMPLATE_SUFFIX.forEach((rank) => {
      const templateCardId = `minor-${suit}-${rank}`;
      assignments[templateCardId] = createBuiltinFrontAssetId(templateCardId);
    });
  });

  return assignments;
}

function drawBackCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 440;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Missing canvas 2D context');
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#122235');
  gradient.addColorStop(1, '#284b54');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#d6b36e';
  ctx.lineWidth = 18;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);
  ctx.fillStyle = '#f4e8c6';
  ctx.textAlign = 'center';
  ctx.font = 'bold 58px Georgia';
  ctx.fillText('TAROT', canvas.width / 2, canvas.height / 2);
  return canvas;
}

export async function createSamplePresetBundle(): Promise<{
  preset: DeckPreset;
  assets: Array<{ asset: AssetRecord; blob: Blob }>;
}> {
  const defaultBack = await createDefaultBackAssetBundle();
  const frontAssets = await createBuiltinDefaultFrontAssets();

  const preset: DeckPreset = {
    id: createId('preset'),
    name: t('preset.sampleName'),
    baseMode: 'full78',
    backAssetId: defaultBack.asset.id,
    assignments: createBuiltinDefaultAssignments(),
    extraCards: [],
    updatedAt: Date.now(),
  };

  return {
    preset,
    assets: [defaultBack, ...frontAssets],
  };
}

export async function createDefaultBackAssetBundle(): Promise<{ asset: AssetRecord; blob: Blob }> {
  const bundledBlob = await fetchBundledBlob('CardBacks.png');
  if (bundledBlob) {
    return {
      asset: {
        id: getBuiltinDefaultBackAssetId(),
        filename: 'CardBacks.png',
        label: 'Default Back',
        kind: 'back',
        folderId: BUILTIN_WAITE_FOLDER_ID,
      },
      blob: bundledBlob,
    };
  }

  return {
    asset: {
      id: getBuiltinDefaultBackAssetId(),
      filename: 'default-back.png',
      label: 'Default Back',
      kind: 'back',
      folderId: BUILTIN_WAITE_FOLDER_ID,
    },
    blob: await canvasToBlob(drawBackCanvas()),
  };
}

export async function createBuiltinDefaultFrontAssets(): Promise<Array<{ asset: AssetRecord; blob: Blob }>> {
  const assets: Array<{ asset: AssetRecord; blob: Blob }> = [];

  for (let index = 0; index < MAJOR_TEMPLATE_IDS.length; index += 1) {
    const templateCardId = MAJOR_TEMPLATE_IDS[index];
    const filename = MAJOR_FILENAMES[index];
    const blob = await fetchBundledBlob(filename);
    if (!blob) {
      continue;
    }
    assets.push({
      asset: {
        id: createBuiltinFrontAssetId(templateCardId),
        filename,
        label: filename.replace(/\.[^.]+$/, ''),
        kind: 'front',
        folderId: BUILTIN_WAITE_FOLDER_ID,
      },
      blob,
    });
  }

  for (const suit of Object.keys(SUIT_FILE_PREFIX) as Array<keyof typeof SUIT_FILE_PREFIX>) {
    for (let rankIndex = 0; rankIndex < RANK_TEMPLATE_SUFFIX.length; rankIndex += 1) {
      const rank = RANK_TEMPLATE_SUFFIX[rankIndex];
      const templateCardId = `minor-${suit}-${rank}`;
      const filename = `${SUIT_FILE_PREFIX[suit]}${String(rankIndex + 1).padStart(2, '0')}.png`;
      const blob = await fetchBundledBlob(filename);
      if (!blob) {
        continue;
      }
      assets.push({
        asset: {
          id: createBuiltinFrontAssetId(templateCardId),
          filename,
          label: filename.replace(/\.[^.]+$/, ''),
          kind: 'front',
          folderId: BUILTIN_WAITE_FOLDER_ID,
        },
        blob,
      });
    }
  }

  return assets;
}
