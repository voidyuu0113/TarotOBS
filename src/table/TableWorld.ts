import { Container, Graphics, Text, TextStyle, type Texture } from 'pixi.js';
import type { CardModel } from '../card/CardModel';
import { CardView } from '../card/CardView';
import { getCardDisplaySize } from '../card/CardSizing';
import { Camera2D } from './Camera2D';

interface DeckPileRender {
  instanceId: string;
  x: number;
  y: number;
  count: number;
  backAssetId: string | null;
  label: string;
  rotation?: number;
}

const pileLabelStyle = new TextStyle({
  fill: 0xf8ecd1,
  fontFamily: 'Georgia',
  fontSize: 14,
  fontWeight: 'bold',
});

const pileCountStyle = new TextStyle({
  fill: 0x1f1a12,
  fontFamily: 'Georgia',
  fontSize: 13,
  fontWeight: 'bold',
});

export class TableWorld {
  readonly root = new Container();
  readonly pilesLayer = new Container();
  readonly cardsLayer = new Container();
  private readonly felt = new Graphics();
  private readonly cardViews = new Map<string, CardView>();
  private readonly pileViews = new Map<string, Container>();
  private readonly pileHitBoxes = new Map<string, { x: number; y: number; width: number; height: number }>();

  constructor(private readonly camera: Camera2D) {
    this.root.sortableChildren = true;
    this.pilesLayer.sortableChildren = true;
    this.cardsLayer.sortableChildren = true;
    this.root.addChild(this.felt, this.pilesLayer, this.cardsLayer);
    this.redrawFelt();
  }

  setFeltVisible(visible: boolean): void {
    this.felt.visible = visible;
  }

  redrawFelt(): void {
    this.felt.clear();
    this.felt.roundRect(-2200, -1600, 4400, 3200, 32);
    this.felt.fill({ color: 0x214736, alpha: 0.88 });
    this.felt.stroke({ color: 0xbca56a, alpha: 0.45, width: 4 });
  }

  sync(cards: CardModel[], piles: DeckPileRender[], getTexture: (assetId: string) => Texture | null, draggingIds = new Set<string>()): void {
    this.syncPiles(piles, getTexture);

    const visibleIds = new Set(cards.map((card) => card.id));
    for (const [id, view] of this.cardViews.entries()) {
      if (visibleIds.has(id)) {
        continue;
      }
      this.cardsLayer.removeChild(view);
      this.cardViews.delete(id);
    }

    cards.forEach((card, index) => {
      let view = this.cardViews.get(card.id);
      if (!view) {
        view = new CardView();
        this.cardViews.set(card.id, view);
        this.cardsLayer.addChild(view);
      }
      const frontTexture = card.frontAssetId ? getTexture(card.frontAssetId) : null;
      const backTexture = card.backAssetId ? getTexture(card.backAssetId) : null;
      const assetId = card.faceUp ? card.frontAssetId : card.backAssetId;
      view.render(card, false, assetId ? getTexture(assetId) : null, getCardDisplaySize(frontTexture, backTexture));
      // Table cards are world-space only. zIndex stays deterministic: base order by instance/order,
      // then selected cards above normal cards, then dragged cards above everything else.
      const baseIndex = card.instanceOrder * 1000 + index;
      view.zIndex = draggingIds.has(card.id) ? 300000 + baseIndex : card.selected ? 200000 + baseIndex : baseIndex;
    });

    // Camera pan applies only to world-space rendering.
    this.root.position.set(this.camera.x, this.camera.y);
    this.root.scale.set(this.camera.zoom);
  }

  getDeckPileAt(screenX: number, screenY: number): string | null {
    const world = this.camera.screenToWorld(screenX, screenY);
    for (const [instanceId, box] of this.pileHitBoxes.entries()) {
      const inside = world.x >= box.x && world.x <= box.x + box.width && world.y >= box.y && world.y <= box.y + box.height;
      if (inside) {
        return instanceId;
      }
    }
    return null;
  }

  private syncPiles(piles: DeckPileRender[], getTexture: (assetId: string) => Texture | null): void {
    const visibleIds = new Set(piles.map((pile) => pile.instanceId));
    for (const [id, view] of this.pileViews.entries()) {
      if (visibleIds.has(id)) {
        continue;
      }
      this.pilesLayer.removeChild(view);
      this.pileViews.delete(id);
      this.pileHitBoxes.delete(id);
    }

    piles.forEach((pile, index) => {
      let view = this.pileViews.get(pile.instanceId);
      let baseCard: CardView;
      let shadowA: Graphics;
      let shadowB: Graphics;
      let countBadge: Graphics;
      let countText: Text;
      let pileLabel: Text;
      if (!view) {
        view = new Container();
        shadowA = new Graphics();
        shadowB = new Graphics();
        baseCard = new CardView();
        countBadge = new Graphics();
        countText = new Text({ text: '', style: pileCountStyle });
        countText.anchor.set(0.5);
        pileLabel = new Text({ text: '', style: pileLabelStyle });
        pileLabel.anchor.set(0.5, 0);
        view.addChild(shadowA, shadowB, baseCard, countBadge, countText, pileLabel);
        this.pileViews.set(pile.instanceId, view);
        this.pilesLayer.addChild(view);
      } else {
        shadowA = view.children[0] as Graphics;
        shadowB = view.children[1] as Graphics;
        baseCard = view.children[2] as CardView;
        countBadge = view.children[3] as Graphics;
        countText = view.children[4] as Text;
        pileLabel = view.children[5] as Text;
      }

      const backTexture = pile.backAssetId ? getTexture(pile.backAssetId) : null;
      const size = getCardDisplaySize(null, backTexture);
      shadowA.clear();
      shadowA.roundRect(-size.width / 2 + 8, -size.height / 2 + 8, size.width, size.height, size.radius);
      shadowA.fill({ color: 0x1f1a12, alpha: 0.45 });
      shadowB.clear();
      shadowB.roundRect(-size.width / 2 + 4, -size.height / 2 + 4, size.width, size.height, size.radius);
      shadowB.fill({ color: 0x443224, alpha: 0.55 });
      countBadge.clear();
      countBadge.roundRect(size.width / 2 - 34, -size.height / 2 - 18, 30, 24, 10);
      countBadge.fill({ color: 0xf3d892, alpha: 0.96 });
      countBadge.stroke({ color: 0x4f3a1d, width: 1.5 });
      countText.text = String(pile.count);
      countText.position.set(size.width / 2 - 19, -size.height / 2 - 6);
      pileLabel.text = pile.label;
      pileLabel.position.set(0, size.height / 2 + 10);

      baseCard.render(
        {
          id: `pile-${pile.instanceId}`,
          deckInstanceId: pile.instanceId,
          presetId: '',
          identity: 'custom',
          templateCardId: null,
          customCardId: null,
          title: '',
          frontAssetId: null,
          backAssetId: pile.backAssetId,
          faceUp: false,
          reversed: false,
          zone: 'deck',
          x: 0,
          y: 0,
          selected: false,
          deckIndex: 0,
          instanceOrder: index,
          rotationJitter: 0,
          pendingAutoPlace: false,
        },
        true,
        backTexture,
        size,
      );

      view.position.set(pile.x, pile.y);
      view.rotation = pile.rotation ?? 0;
      view.zIndex = 100 + index;
      this.pileHitBoxes.set(pile.instanceId, {
        x: pile.x - size.width / 2,
        y: pile.y - size.height / 2,
        width: size.width,
        height: size.height,
      });
    });
  }
}
