import type { CardModel, DeckInstance, DeckMode, DeckPreset, SpawnDeckMode } from './DeckTypes';
import { getTemplateById, getTemplatesForMode } from '../tarot/TarotTemplate';
import { shuffleOrder, shuffleOrientation } from './Shuffle';
import { t } from '../i18n';

const BASE_JUMPER_CHANCE = 0.05;
const JUMPER_CHANCE_INCREMENT = 0.05;

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export class DeckManager {
  // Only one deck instance is "active" for the bottom viewport area at a time.
  // Table cards can simultaneously belong to many deck instances.
  private presets: DeckPreset[] = [];
  private instances: DeckInstance[] = [];
  private activeInstanceId: string | null = null;
  private nextInstanceOrder = 0;

  loadPresets(presets: DeckPreset[]): void {
    this.presets = [...presets];
  }

  getPresets(): DeckPreset[] {
    return [...this.presets];
  }

  upsertPreset(preset: DeckPreset): void {
    const existing = this.presets.some((entry) => entry.id === preset.id);
    this.presets = existing ? this.presets.map((entry) => (entry.id === preset.id ? preset : entry)) : [...this.presets, preset];
    this.presets.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  syncInstancesFromPreset(presetId: string): void {
    const preset = this.getPresetOrThrow(presetId);
    const extraCardsById = new Map(preset.extraCards.map((card) => [card.id, card] as const));

    for (const instance of this.instances) {
      if (instance.presetId !== presetId) {
        continue;
      }

      instance.label = `${preset.name} ${this.instances.filter((entry) => entry.presetId === presetId).findIndex((entry) => entry.id === instance.id) + 1}`;
      instance.cards = instance.cards.filter((card) => card.identity !== 'custom' || !card.customCardId || extraCardsById.has(card.customCardId));

      for (const card of instance.cards) {
        card.backAssetId = preset.backAssetId;
        if (card.identity === 'template' && card.templateCardId) {
          card.frontAssetId = preset.assignments[card.templateCardId] ?? null;
          card.title = this.getTemplateName(card.templateCardId);
          continue;
        }
        if (card.identity === 'custom' && card.customCardId) {
          const extraCard = extraCardsById.get(card.customCardId);
          if (!extraCard) {
            continue;
          }
          card.frontAssetId = extraCard.frontAssetId;
          card.title = extraCard.name || card.title;
        }
      }
      instance.cards.forEach((card, index) => {
        card.deckIndex = index;
      });
    }
  }

  updatePresetBackAsset(presetId: string, backAssetId: string | null): void {
    this.presets = this.presets.map((preset) =>
      preset.id === presetId
        ? {
            ...preset,
            backAssetId,
            updatedAt: Date.now(),
          }
        : preset,
    );

    for (const instance of this.instances) {
      if (instance.presetId !== presetId) {
        continue;
      }
      for (const card of instance.cards) {
        card.backAssetId = backAssetId;
      }
    }
  }

  removePreset(presetId: string): DeckInstance[] {
    const removedInstances = this.instances.filter((instance) => instance.presetId === presetId);
    this.instances = this.instances.filter((instance) => instance.presetId !== presetId);
    this.presets = this.presets.filter((preset) => preset.id !== presetId);
    if (removedInstances.some((instance) => instance.id === this.activeInstanceId)) {
      this.activeInstanceId = this.instances[0]?.id ?? null;
    }
    return removedInstances;
  }

  createInstance(presetId: string, mode: DeckMode, jumperEnabled: boolean): DeckInstance {
    const preset = this.getPresetOrThrow(presetId);
    const templateMode = mode === 'fullPreset' ? preset.baseMode : mode;
    const templates = getTemplatesForMode(templateMode);
    const templateCards: CardModel[] = templates.map((template, index) => ({
      id: createId('card'),
      deckInstanceId: '',
      presetId,
      identity: 'template',
      templateCardId: template.templateCardId,
      customCardId: null,
      title: t(template.nameKey),
      frontAssetId: preset.assignments[template.templateCardId] ?? null,
      backAssetId: preset.backAssetId,
      faceUp: false,
      reversed: false,
      zone: 'deck',
      x: 0,
      y: 0,
      selected: false,
      deckIndex: index,
      instanceOrder: this.nextInstanceOrder,
      rotationJitter: 0,
      pendingAutoPlace: false,
    }));

    const customCards: CardModel[] =
      mode === 'fullPreset'
        ? [...preset.extraCards]
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((extraCard, index) => ({
              id: createId('card'),
              deckInstanceId: '',
              presetId,
              identity: 'custom' as const,
              templateCardId: null,
              customCardId: extraCard.id,
              title: extraCard.name || `Custom Card ${index + 1}`,
              frontAssetId: extraCard.frontAssetId,
              backAssetId: preset.backAssetId,
              faceUp: false,
              reversed: false,
              zone: 'deck' as const,
              x: 0,
              y: 0,
              selected: false,
              deckIndex: templates.length + index,
              instanceOrder: this.nextInstanceOrder,
              rotationJitter: 0,
              pendingAutoPlace: false,
            }))
        : [];

    const cards: CardModel[] = [...templateCards, ...customCards];

    const instance: DeckInstance = {
      id: createId('deck'),
      presetId,
      label: `${preset.name} ${this.instances.filter((entry) => entry.presetId === presetId).length + 1}`,
      order: this.nextInstanceOrder,
      pileX: -560 + (this.nextInstanceOrder % 4) * 180,
      pileY: -240 + Math.floor(this.nextInstanceOrder / 4) * 220,
      mode,
      flowState: 'pile',
      cards,
      jumperEnabled,
      jumperChance: BASE_JUMPER_CHANCE,
      lastShuffleAt: null,
      animation: null,
    };

    for (const card of cards) {
      card.deckInstanceId = instance.id;
    }

    this.instances = [...this.instances, instance];
    this.nextInstanceOrder += 1;
    return instance;
  }

  removeInstance(instanceId: string): DeckInstance | null {
    const instance = this.instances.find((entry) => entry.id === instanceId) ?? null;
    if (!instance) {
      return null;
    }
    this.instances = this.instances.filter((entry) => entry.id !== instanceId);
    if (this.activeInstanceId === instanceId) {
      this.activeInstanceId = null;
    }
    return instance;
  }

  getInstances(): DeckInstance[] {
    return [...this.instances];
  }

  setActiveInstance(instanceId: string): void {
    if (this.instances.some((instance) => instance.id === instanceId)) {
      this.activeInstanceId = instanceId;
    }
  }

  getActiveInstance(): DeckInstance | null {
    return this.instances.find((instance) => instance.id === this.activeInstanceId) ?? null;
  }

  stackInstanceToTablePile(instanceId: string, x: number, y: number): void {
    const instance = this.getInstanceOrThrow(instanceId);
    const bottomCards = instance.cards.filter((card) => card.zone !== 'table').sort((a, b) => a.deckIndex - b.deckIndex);
    const tableCards = instance.cards.filter((card) => card.zone === 'table').sort((a, b) => a.deckIndex - b.deckIndex);
    bottomCards.forEach((card, index) => {
      card.zone = 'deck';
      card.faceUp = false;
      card.selected = false;
      card.pendingAutoPlace = false;
      card.rotationJitter = 0;
      card.x = 0;
      card.y = 0;
      card.deckIndex = index;
    });
    tableCards.forEach((card, index) => {
      card.deckIndex = bottomCards.length + index;
    });
    instance.cards.splice(0, instance.cards.length, ...bottomCards, ...tableCards);
    instance.flowState = 'pile';
    instance.animation = null;
    instance.pileX = x;
    instance.pileY = y;
    if (this.activeInstanceId === instanceId) {
      this.activeInstanceId = null;
    }
  }

  getTablePiles(): Array<{ instanceId: string; x: number; y: number; count: number; backAssetId: string | null; label: string }> {
    return this.instances
      .filter((instance) => instance.id !== this.activeInstanceId)
      .map((instance) => ({
        instanceId: instance.id,
        x: instance.pileX,
        y: instance.pileY,
        count: instance.cards.filter((card) => card.zone !== 'table').length,
        backAssetId: instance.cards.find((card) => card.backAssetId)?.backAssetId ?? null,
        label: instance.label,
      }))
      .filter((pile) => pile.count > 0);
  }

  setPilePosition(instanceId: string, x: number, y: number): void {
    const instance = this.instances.find((entry) => entry.id === instanceId);
    if (!instance || this.activeInstanceId === instanceId) {
      return;
    }
    instance.pileX = x;
    instance.pileY = y;
  }

  setJumperEnabled(instanceId: string, enabled: boolean): void {
    const instance = this.instances.find((entry) => entry.id === instanceId);
    if (!instance) {
      return;
    }
    instance.jumperEnabled = enabled;
  }

  beginShuffle(instanceId: string, now: number): void {
    const instance = this.getInstanceOrThrow(instanceId);
    // Only bottom-area cards re-enter the shuffle flow. Cards already on the table remain on the table.
    const bottomCards = instance.cards.filter((card) => card.zone !== 'table');
    const tableCards = instance.cards.filter((card) => card.zone === 'table').sort((a, b) => a.deckIndex - b.deckIndex);
    shuffleOrientation(bottomCards);
    const ordered = shuffleOrder(bottomCards);
    ordered.forEach((card, index) => {
      card.deckIndex = index;
      card.zone = 'deck';
      card.faceUp = false;
      card.selected = false;
      card.pendingAutoPlace = false;
      card.x = 0;
      card.y = 0;
      card.rotationJitter = (Math.random() - 0.5) * 0.25;
      card.instanceOrder = instance.order;
    });

    let jumperCount = 0;
    if (instance.jumperEnabled) {
      // Jumper rule: start at 5%, add 5% after each miss, reset to base after a trigger.
      const triggered = Math.random() < instance.jumperChance;
      if (triggered) {
        jumperCount = Math.min(ordered.length, 1 + Math.floor(Math.random() * 3));
        instance.jumperChance = BASE_JUMPER_CHANCE;
      } else {
        instance.jumperChance = Math.min(instance.jumperChance + JUMPER_CHANCE_INCREMENT, 1);
      }
    }

    const tableOffset = ordered.length;
    tableCards.forEach((card, index) => {
      card.deckIndex = tableOffset + index;
    });
    instance.cards.splice(0, instance.cards.length, ...ordered, ...tableCards);
    instance.flowState = 'shuffling';
    instance.lastShuffleAt = now;
    instance.animation = {
      startAt: now,
      durationMs: 550,
      jumperCount,
      jumpersLaunched: false,
      jumperLaunchAt: now + 180,
    };
  }

  spreadInstance(instanceId: string): void {
    const instance = this.getInstanceOrThrow(instanceId);
    if (instance.animation) {
      return;
    }
    instance.flowState = 'fan';
    let nextBottomIndex = 0;
    let nextTableIndex = instance.cards.filter((card) => card.zone !== 'table').length;

    instance.cards.forEach((card) => {
      if (card.zone === 'table') {
        card.deckIndex = nextTableIndex;
        nextTableIndex += 1;
        return;
      }

      card.zone = 'hand';
      card.rotationJitter = 0;
      card.pendingAutoPlace = false;
      card.deckIndex = nextBottomIndex;
      nextBottomIndex += 1;
    });
  }

  finalizeShuffle(instanceId: string): void {
    const instance = this.getInstanceOrThrow(instanceId);
    instance.animation = null;
    instance.flowState = 'pile';
    let nextBottomIndex = 0;
    let nextTableIndex = instance.cards.filter((card) => card.zone !== 'table').length;

    instance.cards.forEach((card) => {
      if (card.zone === 'table') {
        card.deckIndex = nextTableIndex;
        nextTableIndex += 1;
        if (card.pendingAutoPlace) {
          card.faceUp = false;
        }
        return;
      }

      card.zone = 'deck';
      card.rotationJitter = 0;
      card.pendingAutoPlace = false;
      card.deckIndex = nextBottomIndex;
      nextBottomIndex += 1;
    });
  }

  getAllCards(): CardModel[] {
    return this.instances.flatMap((instance) => instance.cards);
  }

  getAllTableCards(): CardModel[] {
    return this.getAllCards().filter((card) => card.zone === 'table');
  }

  getBottomCards(instanceId: string | null): CardModel[] {
    if (!instanceId) {
      return [];
    }
    const instance = this.instances.find((entry) => entry.id === instanceId);
    if (!instance) {
      return [];
    }
    // Bottom area only renders the active deck's viewport-space states. In the current flow,
    // jumpers normally bypass this area and auto-eject to the table, but `jumper` remains as a
    // compatibility state for older data / transitional UI logic.
    return instance.cards
      .filter((card) => card.zone === 'deck' || card.zone === 'hand' || card.zone === 'jumper')
      .sort((a, b) => a.deckIndex - b.deckIndex);
  }

  returnCardsToDeck(cards: CardModel[]): void {
    // Return-to-deck always targets each card's originating deck instance, not merely the active deck.
    const ids = new Set(cards.map((card) => card.id));
    for (const card of this.getAllCards()) {
      if (!ids.has(card.id)) {
        continue;
      }
      card.zone = 'hand';
      card.faceUp = false;
      card.selected = false;
      card.x = 0;
      card.y = 0;
      card.pendingAutoPlace = false;
    }
    for (const instance of this.instances) {
      const bottomCards = instance.cards.filter((card) => card.zone !== 'table').sort((a, b) => a.deckIndex - b.deckIndex);
      const tableCards = instance.cards.filter((card) => card.zone === 'table').sort((a, b) => a.deckIndex - b.deckIndex);
      instance.cards.splice(0, instance.cards.length, ...bottomCards, ...tableCards);
      instance.cards.forEach((card, index) => {
        card.deckIndex = index;
      });
    }
  }

  insertCardsIntoHand(instanceId: string, cards: CardModel[], insertionIndex: number): void {
    const instance = this.getInstanceOrThrow(instanceId);
    const ids = new Set(cards.map((card) => card.id));
    const returningCards = [...instance.cards]
      .filter((card) => ids.has(card.id))
      .sort((a, b) => a.deckIndex - b.deckIndex);
    if (returningCards.length === 0) {
      return;
    }

    const returnZone = instance.flowState === 'pile' ? 'deck' : 'hand';
    returningCards.forEach((card) => {
      card.zone = returnZone;
      card.faceUp = false;
      card.selected = false;
      card.pendingAutoPlace = false;
      card.x = 0;
      card.y = 0;
      card.rotationJitter = 0;
    });

    const handCards = instance.cards
      .filter((card) => !ids.has(card.id) && card.zone !== 'table')
      .sort((a, b) => a.deckIndex - b.deckIndex);
    const tableCards = instance.cards
      .filter((card) => !ids.has(card.id) && card.zone === 'table')
      .sort((a, b) => a.deckIndex - b.deckIndex);
    const safeIndex = Math.max(0, Math.min(insertionIndex, handCards.length));
    const reorderedBottom = [...handCards.slice(0, safeIndex), ...returningCards, ...handCards.slice(safeIndex)];

    instance.cards.splice(0, instance.cards.length, ...reorderedBottom, ...tableCards);
    instance.cards.forEach((card, index) => {
      card.deckIndex = index;
    });
  }

  clearSelection(): void {
    for (const card of this.getAllCards()) {
      card.selected = false;
    }
  }

  tick(now: number): boolean {
    let changed = false;
    for (const instance of this.instances) {
      if (!instance.animation) {
        continue;
      }
      if (!instance.animation.jumpersLaunched && instance.animation.jumperCount > 0 && now >= instance.animation.jumperLaunchAt) {
        this.launchJumpers(instance);
        changed = true;
      }
      if (now >= instance.animation.startAt + instance.animation.durationMs) {
        this.finalizeShuffle(instance.id);
        changed = true;
      }
    }
    return changed;
  }

  getPresetAssetIds(presetId: string): string[] {
    // Presets reference shared assets by id; the asset library is global and not owned by a single preset.
    const preset = this.getPresetOrThrow(presetId);
    const ids = new Set<string>();
    if (preset.backAssetId) {
      ids.add(preset.backAssetId);
    }
    Object.values(preset.assignments).forEach((assetId) => {
      if (assetId) {
        ids.add(assetId);
      }
    });
    preset.extraCards.forEach((card) => {
      if (card.frontAssetId) {
        ids.add(card.frontAssetId);
      }
    });
    return [...ids];
  }

  getPresetCompletion(presetId: string, mode: DeckMode): { assigned: number; total: number } {
    const preset = this.getPresetOrThrow(presetId);
    const templates = getTemplatesForMode(mode === 'fullPreset' ? preset.baseMode : mode);
    const assigned = templates.filter((template) => preset.assignments[template.templateCardId]).length;
    return { assigned, total: templates.length };
  }

  getAllowedSpawnModes(presetId: string): SpawnDeckMode[] {
    const preset = this.getPresetOrThrow(presetId);
    if (preset.baseMode === 'major22') {
      return ['major22'];
    }
    if (preset.extraCards.length > 0) {
      return ['major22', 'full78', 'fullPreset'];
    }
    return ['major22', 'full78'];
  }

  getPreset(presetId: string): DeckPreset | undefined {
    return this.presets.find((preset) => preset.id === presetId);
  }

  getTemplateName(templateCardId: string): string {
    const template = getTemplateById(templateCardId);
    return template ? t(template.nameKey) : templateCardId;
  }

  refreshLocalizedTitles(): void {
    for (const card of this.getAllCards()) {
      card.title = card.identity === 'template' && card.templateCardId ? this.getTemplateName(card.templateCardId) : card.title;
    }
  }

  clearAssetReference(assetId: string, fallbackBackAssetId: string): DeckPreset[] {
    const changedPresets: DeckPreset[] = [];
    this.presets = this.presets.map((preset) => {
      let changed = false;
      const assignments = { ...preset.assignments };
      for (const [templateCardId, assignedAssetId] of Object.entries(assignments)) {
        if (assignedAssetId === assetId) {
          assignments[templateCardId] = null;
          changed = true;
        }
      }

      const extraCards = preset.extraCards.map((card) => {
        if (card.frontAssetId !== assetId) {
          return card;
        }
        changed = true;
        return {
          ...card,
          frontAssetId: null,
        };
      });

      const backAssetId = preset.backAssetId === assetId ? fallbackBackAssetId : preset.backAssetId;
      if (backAssetId !== preset.backAssetId) {
        changed = true;
      }

      if (!changed) {
        return preset;
      }

      const nextPreset = {
        ...preset,
        assignments,
        extraCards,
        backAssetId,
        updatedAt: Date.now(),
      };
      changedPresets.push(nextPreset);
      return nextPreset;
    });

    for (const card of this.getAllCards()) {
      if (card.frontAssetId === assetId) {
        card.frontAssetId = null;
      }
      if (card.backAssetId === assetId) {
        card.backAssetId = fallbackBackAssetId;
      }
    }

    return changedPresets;
  }

  private getPresetOrThrow(presetId: string): DeckPreset {
    const preset = this.getPreset(presetId);
    if (!preset) {
      throw new Error(`Missing preset ${presetId}`);
    }
    return preset;
  }

  private getInstanceOrThrow(instanceId: string): DeckInstance {
    const instance = this.instances.find((entry) => entry.id === instanceId);
    if (!instance) {
      throw new Error(`Missing deck instance ${instanceId}`);
    }
    return instance;
  }

  private launchJumpers(instance: DeckInstance): void {
    if (!instance.animation || instance.animation.jumpersLaunched || instance.animation.jumperCount <= 0) {
      return;
    }

    const bottomCards = instance.cards
      .filter((card) => card.zone === 'deck' || card.zone === 'hand' || card.zone === 'jumper')
      .sort((a, b) => a.deckIndex - b.deckIndex);
    const jumpers = bottomCards.slice(0, instance.animation.jumperCount);
    jumpers.forEach((card) => {
      // Jumpers eject during shuffle, not after the fan has already opened.
      card.zone = 'table';
      card.rotationJitter = (Math.random() - 0.5) * 0.5;
      card.pendingAutoPlace = true;
      card.faceUp = false;
      card.selected = false;
    });
    instance.animation.jumpersLaunched = true;
  }
}
