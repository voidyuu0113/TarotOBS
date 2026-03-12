import type { CardModel } from '../card/CardModel';

export interface DragAnchor {
  cardId: string;
  startX: number;
  startY: number;
}

export class DragController {
  anchors: DragAnchor[] = [];

  begin(cards: CardModel[]): void {
    this.anchors = cards.map((card) => ({
      cardId: card.id,
      startX: card.x,
      startY: card.y,
    }));
  }

  getAnchor(card: CardModel): DragAnchor | undefined {
    return this.anchors.find((anchor) => anchor.cardId === card.id);
  }

  reset(): void {
    this.anchors = [];
  }
}
