import type { DeckMode, MinorSuit, TarotTemplateCard } from '../deck/DeckTypes';

const MAJOR_ARCANA = [
  'fool',
  'magician',
  'high_priestess',
  'empress',
  'emperor',
  'hierophant',
  'lovers',
  'chariot',
  'strength',
  'hermit',
  'wheel_of_fortune',
  'justice',
  'hanged_man',
  'death',
  'temperance',
  'devil',
  'tower',
  'star',
  'moon',
  'sun',
  'judgement',
  'world',
] as const;

const SUITS: ReadonlyArray<{ suit: MinorSuit; label: string }> = [
  { suit: 'wands', label: 'Wands' },
  { suit: 'cups', label: 'Cups' },
  { suit: 'swords', label: 'Swords' },
  { suit: 'pentacles', label: 'Pentacles' },
];

const RANKS = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King'] as const;

const templates: TarotTemplateCard[] = [
  ...MAJOR_ARCANA.map((name, index) => ({
    templateCardId: `major_${name}`,
    nameKey: `tarot.major.${name}`,
    orderIndex: index,
    arcana: 'major' as const,
    suit: null,
    rank: null,
  })),
  ...SUITS.flatMap((entry, suitIndex) =>
    RANKS.map((rank, rankIndex) => ({
      templateCardId: `minor-${entry.suit}-${rank.toLowerCase()}`,
      nameKey: `tarot.minor.${entry.suit}.${rank.toLowerCase()}`,
      orderIndex: 22 + suitIndex * RANKS.length + rankIndex,
      arcana: 'minor' as const,
      suit: entry.suit,
      rank,
    })),
  ),
];

export const TAROT_TEMPLATES: readonly TarotTemplateCard[] = templates;
export const MAJOR_ARCANA_TEMPLATES: readonly TarotTemplateCard[] = templates.filter((card) => card.arcana === 'major');

export function getTemplatesForMode(mode: DeckMode): readonly TarotTemplateCard[] {
  // Built-in tarot templates are the source of truth for card identity. Presets only assign assets onto them.
  return mode === 'major22' ? MAJOR_ARCANA_TEMPLATES : TAROT_TEMPLATES;
}

export function createEmptyAssignments(): Record<string, string | null> {
  // Unassigned slots are explicit and must remain explicit so callers can choose a visible fallback face.
  return Object.fromEntries(TAROT_TEMPLATES.map((card) => [card.templateCardId, null]));
}

export function getTemplateById(templateCardId: string): TarotTemplateCard | undefined {
  return TAROT_TEMPLATES.find((card) => card.templateCardId === templateCardId);
}
