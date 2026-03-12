import type { CardModel } from '../card/CardModel';

export class SelectionManager {
  clear(cards: CardModel[]): void {
    for (const card of cards) {
      card.selected = false;
    }
  }

  setSingle(cards: CardModel[], target: CardModel): void {
    for (const card of cards) {
      card.selected = card.id === target.id;
    }
  }

  selectFromSet(cards: CardModel[], ids: Set<string>): void {
    for (const card of cards) {
      card.selected = ids.has(card.id);
    }
  }

  getSelected(cards: CardModel[]): CardModel[] {
    return cards.filter((card) => card.selected);
  }
}
