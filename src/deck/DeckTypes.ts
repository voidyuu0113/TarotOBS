export type ArcanaType = 'major' | 'minor';
export type MinorSuit = 'wands' | 'cups' | 'swords' | 'pentacles';
export type PresetBaseMode = 'major22' | 'full78';
export type SpawnDeckMode = 'major22' | 'full78' | 'fullPreset';
export type DeckMode = SpawnDeckMode;
export type CardZone = 'deck' | 'hand' | 'jumper' | 'table';
export type DeckFlowState = 'pile' | 'shuffling' | 'fan';

export interface TarotTemplateCard {
  templateCardId: string;
  nameKey: string;
  orderIndex: number;
  arcana: ArcanaType;
  suit: MinorSuit | null;
  rank: string | null;
}

export interface AssetRecord {
  id: string;
  filename: string;
  label: string;
  kind: 'front' | 'back';
  folderId: string | null;
}

export interface AssetFolder {
  id: string;
  name: string;
  orderIndex: number;
}

export interface ExtraCardDefinition {
  id: string;
  name: string;
  frontAssetId: string | null;
  orderIndex: number;
}

export interface DeckPreset {
  id: string;
  name: string;
  baseMode: PresetBaseMode;
  backAssetId: string | null;
  assignments: Record<string, string | null>;
  extraCards: ExtraCardDefinition[];
  updatedAt: number;
}

export interface CardModel {
  id: string;
  deckInstanceId: string;
  presetId: string;
  identity: 'template' | 'custom';
  templateCardId: string | null;
  customCardId: string | null;
  title: string;
  frontAssetId: string | null;
  backAssetId: string | null;
  faceUp: boolean;
  reversed: boolean;
  zone: CardZone;
  x: number;
  y: number;
  selected: boolean;
  deckIndex: number;
  instanceOrder: number;
  rotationJitter: number;
  pendingAutoPlace: boolean;
}

export interface ShuffleAnimationState {
  startAt: number;
  durationMs: number;
  jumperCount: number;
  jumpersLaunched: boolean;
  jumperLaunchAt: number;
}

export interface DeckInstance {
  id: string;
  presetId: string;
  label: string;
  order: number;
  pileX: number;
  pileY: number;
  mode: DeckMode;
  flowState: DeckFlowState;
  cards: CardModel[];
  jumperEnabled: boolean;
  jumperChance: number;
  lastShuffleAt: number | null;
  animation: ShuffleAnimationState | null;
}
