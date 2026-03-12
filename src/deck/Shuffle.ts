import type { CardModel } from '../card/CardModel';

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

export function shuffleOrder<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function shuffleOrientation(cards: CardModel[]): void {
  for (const card of cards) {
    card.reversed = Math.random() >= 0.5;
  }
}
