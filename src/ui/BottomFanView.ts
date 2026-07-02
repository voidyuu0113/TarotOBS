import { Container, type Texture } from 'pixi.js';
import { CARD_HEIGHT, CARD_WIDTH, type CardModel } from '../card/CardModel';
import { CardView } from '../card/CardView';
import { getCardDisplaySize } from '../card/CardSizing';

export interface HandLayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class BottomFanView {
  readonly root = new Container();
  private readonly cardViews = new Map<string, CardView>();
  private layout = new Map<string, HandLayoutBox>();
  private handCardIds: string[] = [];
  private handBand: HandLayoutBox | null = null;

  constructor() {
    this.root.sortableChildren = true;
  }

  sync(
    cards: CardModel[],
    viewportWidth: number,
    viewportHeight: number,
    getTexture: (assetId: string) => Texture | null,
    isShuffling: boolean,
    animationProgress: number,
    hoveredCardId: string | null,
    insertionIndex: number | null,
  ): void {
    // This view is strictly viewport-space. It renders only the active deck's bottom-area states and must
    // remain visually stable while the world camera pans. Jumpers normally bypass this layer and are
    // auto-placed into world space after shuffle finalization.
    const visibleIds = new Set(cards.map((card) => card.id));
    for (const [id, view] of this.cardViews.entries()) {
      if (visibleIds.has(id)) {
        continue;
      }
      this.root.removeChild(view);
      this.cardViews.delete(id);
    }

    this.layout = new Map();
    const pileCards = cards.filter((card) => card.zone === 'deck');
    const handCards = cards.filter((card) => card.zone === 'hand');
    this.handCardIds = handCards.map((card) => card.id);
    const jumperCards = cards.filter((card) => card.zone === 'jumper');
    const compact = viewportWidth <= 820 || (viewportWidth <= 1024 && viewportHeight <= 600);
    const portrait = viewportHeight > viewportWidth;
    const cardScale = compact ? (portrait ? 0.72 : viewportHeight < 500 ? 0.62 : 0.74) : 1;
    const sizeById = new Map(
      cards.map((card) => {
        const frontTexture = card.frontAssetId ? getTexture(card.frontAssetId) : null;
        const backTexture = card.backAssetId ? getTexture(card.backAssetId) : null;
        const baseSize = getCardDisplaySize(frontTexture, backTexture);
        return [
          card.id,
          {
            ...baseSize,
            width: Math.round(baseSize.width * cardScale),
            height: Math.round(baseSize.height * cardScale),
            radius: Math.max(7, Math.round(baseSize.radius * cardScale)),
          },
        ] as const;
      }),
    );
    const sidePadding = compact ? 12 : 132;
    const averageHandWidth =
      handCards.length > 0
        ? handCards.reduce((sum, card) => sum + (sizeById.get(card.id)?.width ?? CARD_WIDTH), 0) / handCards.length
        : CARD_WIDTH;
    const baseInsertionGap = insertionIndex === null ? 0 : Math.min(averageHandWidth * 0.78, 46);
    const availableWidth = Math.max(averageHandWidth, viewportWidth - sidePadding * 2 - baseInsertionGap);
    const overlap = handCards.length > 1
      ? Math.max(compact ? 2.5 : 10, Math.min(compact ? 28 : 42, (availableWidth - averageHandWidth) / (handCards.length - 1)))
      : 0;
    const insertionGap = insertionIndex === null ? 0 : Math.min(averageHandWidth * 0.78, overlap + 34);
    const handLeftOffsets = Array.from({ length: handCards.length }, (_value, index) => {
      const gapOffset = insertionIndex !== null && index >= insertionIndex ? insertionGap : 0;
      return index * overlap + gapOffset;
    });
    const rowWidth =
      handCards.length > 0
        ? handLeftOffsets.reduce((maxRight, leftOffset, index) => {
            const width = sizeById.get(handCards[index].id)?.width ?? CARD_WIDTH;
            return Math.max(maxRight, leftOffset + width);
          }, 0)
        : 0;
    const fanStartX = Math.max(sidePadding, (viewportWidth - rowWidth) / 2);
    const bottomOffset = compact ? Math.round((CARD_HEIGHT * cardScale) / 2 + (portrait ? 12 : 8)) : 104;
    const fanY = viewportHeight - bottomOffset;
    const pileX = viewportWidth * 0.5;
    const pileY = viewportHeight - bottomOffset;
    this.handBand = {
      x: Math.max(sidePadding, fanStartX - 24),
      y: fanY - 24,
      width: Math.max(CARD_WIDTH + insertionGap, rowWidth + 48),
      height: CARD_HEIGHT * cardScale + (compact ? 28 : 44),
    };

    cards.forEach((card) => {
      let view = this.cardViews.get(card.id);
      if (!view) {
        view = new CardView();
        this.cardViews.set(card.id, view);
        this.root.addChild(view);
      }

      let x = pileX;
      let y = pileY;
      let rotation = 0;
      let zIndex = card.deckIndex;
      const size = sizeById.get(card.id) ?? getCardDisplaySize(null, null);
      if (card.zone === 'hand') {
        // Fan stacks left-to-right, where further-right cards render above earlier cards.
        const index = handCards.findIndex((entry) => entry.id === card.id);
        x = fanStartX + handLeftOffsets[index] + size.width / 2;
        y = hoveredCardId === card.id ? fanY - (compact ? 9 : 14) : fanY;
        zIndex = 1000 + index + (hoveredCardId === card.id ? 500 : 0);
      } else if (card.zone === 'jumper') {
        // Jumpers protrude above the normal bottom deck area and render above regular bottom cards.
        const index = jumperCards.findIndex((entry) => entry.id === card.id);
        x = pileX - 120 * cardScale + index * 120 * cardScale;
        y = pileY - 30 * cardScale - index * 8 * cardScale;
        rotation = card.rotationJitter;
        zIndex = 2000 + index;
      } else {
        const index = pileCards.findIndex((entry) => entry.id === card.id);
        const spread = isShuffling ? Math.sin(animationProgress * Math.PI) * 32 : 0;
        x = pileX + ((index % 2 === 0 ? -1 : 1) * spread * Math.min(index, 6)) / 6;
        y = pileY - Math.min(index, 10) * 1.8;
        rotation = isShuffling ? card.rotationJitter * Math.sin(animationProgress * Math.PI) : 0;
        zIndex = index;
      }

      view.render({ ...card, x, y }, true, card.backAssetId ? getTexture(card.backAssetId) : null, size);
      view.rotation = rotation;
      view.zIndex = zIndex;
      this.layout.set(card.id, {
        x: x - size.width / 2,
        y: y - size.height / 2,
        width: size.width,
        height: size.height,
      });
    });
  }

  getCardAt(screenX: number, screenY: number, cards: CardModel[]): CardModel | null {
    // Bottom-area hit testing is intentionally limited to hand/jumper cards. Deck pile is not directly draggable
    // until cards have resolved into hand/jumper presentation.
    const bottomInteractable = cards.filter((card) => card.zone === 'hand' || card.zone === 'jumper');
    for (let index = bottomInteractable.length - 1; index >= 0; index -= 1) {
      const card = bottomInteractable[index];
      const box = this.layout.get(card.id);
      if (!box) {
        continue;
      }
      const inside = screenX >= box.x && screenX <= box.x + box.width && screenY >= box.y && screenY <= box.y + box.height;
      if (inside) {
        return card;
      }
    }
    return null;
  }

  getInsertionIndex(screenX: number, cards: CardModel[]): number {
    const handCards = cards.filter((card) => card.zone === 'hand');
    if (handCards.length === 0) {
      return 0;
    }

    const centers = handCards
      .map((card) => {
        const box = this.layout.get(card.id);
        if (!box) {
          return null;
        }
        return box.x + box.width / 2;
      })
      .filter((value): value is number => value !== null);

    if (centers.length === 0) {
      return 0;
    }
    if (screenX <= centers[0]) {
      return 0;
    }
    for (let index = 0; index < centers.length - 1; index += 1) {
      const midpoint = (centers[index] + centers[index + 1]) / 2;
      if (screenX < midpoint) {
        return index + 1;
      }
    }
    return centers.length;
  }

  isInsideHandBand(screenX: number, screenY: number): boolean {
    const band = this.getHandBandRect();
    if (!band) {
      return false;
    }
    if (this.layout.size === 0) {
      return screenX >= band.x && screenX <= band.x + band.width && screenY >= band.y && screenY <= band.y + band.height;
    }
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (const id of this.handCardIds) {
      const box = this.layout.get(id);
      if (!box) {
        continue;
      }
      left = Math.min(left, box.x - 28);
      right = Math.max(right, box.x + box.width + 28);
      top = Math.min(top, box.y - 24);
      bottom = Math.max(bottom, box.y + box.height + 28);
    }
    if (!Number.isFinite(left)) {
      return screenX >= band.x && screenX <= band.x + band.width && screenY >= band.y && screenY <= band.y + band.height;
    }
    return screenX >= left && screenX <= right && screenY >= top && screenY <= bottom;
  }

  getHandBandRect(): HandLayoutBox | null {
    return this.handBand ? { ...this.handBand } : null;
  }
}
