import { Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { CARD_HEIGHT, CARD_WIDTH, type CardModel } from './CardModel';
import type { CardDisplaySize } from './CardSizing';

const backStyle = new TextStyle({
  fill: 0xf8ecd1,
  fontFamily: 'Georgia',
  fontSize: 18,
  fontWeight: 'bold',
});

const faceStyle = new TextStyle({
  fill: 0x1d1a13,
  fontFamily: 'Georgia',
  fontSize: 16,
  align: 'center',
  wordWrap: true,
  wordWrapWidth: CARD_WIDTH - 24,
});

export class CardView extends Container {
  readonly card = new Container();
  private readonly art = new Sprite(Texture.WHITE);
  private readonly artMask = new Graphics();
  private readonly frame = new Graphics();
  private readonly accent = new Graphics();
  private readonly titleText = new Text({ text: '', style: faceStyle });
  private readonly backLabel = new Text({ text: 'TAROT', style: backStyle });

  constructor() {
    super();
    this.eventMode = 'none';
    this.card.pivot.set(CARD_WIDTH / 2, CARD_HEIGHT / 2);
    this.art.width = CARD_WIDTH;
    this.art.height = CARD_HEIGHT;
    this.art.mask = this.artMask;
    this.addChild(this.card);
    this.card.addChild(this.art, this.artMask, this.frame, this.accent, this.titleText, this.backLabel);
    this.titleText.anchor.set(0.5);
    this.titleText.position.set(CARD_WIDTH / 2, CARD_HEIGHT / 2);
    this.backLabel.anchor.set(0.5);
    this.backLabel.position.set(CARD_WIDTH / 2, CARD_HEIGHT / 2);
  }

  render(model: CardModel, forcedBack = false, texture: Texture | null = null, size?: CardDisplaySize): void {
    const showBack = forcedBack || !model.faceUp;
    const width = size?.width ?? CARD_WIDTH;
    const height = size?.height ?? CARD_HEIGHT;
    const radius = size?.radius ?? 12;
    this.position.set(model.x, model.y);
    this.card.pivot.set(width / 2, height / 2);
    this.card.rotation = showBack ? 0 : model.reversed ? Math.PI : 0;
    this.art.texture = texture ?? Texture.WHITE;
    this.art.width = width;
    this.art.height = height;
    this.art.visible = texture !== null;
    this.art.tint = showBack ? 0xffffff : 0xffffff;
    this.titleText.text = model.title;
    this.titleText.style.wordWrapWidth = Math.max(width - 24, 44);
    this.titleText.position.set(width / 2, height / 2);
    this.titleText.visible = !showBack && texture === null;
    this.backLabel.position.set(width / 2, height / 2);
    this.backLabel.visible = showBack && texture === null;

    // Imported art must never exceed the card's rounded silhouette. Both front and back textures are
    // clipped to the same rounded mask so replacement assets stay inside the card frame.
    this.artMask.clear();
    this.artMask.roundRect(0, 0, width, height, radius);
    this.artMask.fill(0xffffff);

    this.frame.clear();
    this.frame.roundRect(0, 0, width, height, radius);
    this.frame.fill({
      color: showBack ? 0x1f3140 : 0xf3e6c7,
      alpha: texture ? 0.12 : 1,
    });
    this.frame.stroke({
      color: model.selected ? 0xf5d06f : 0x261d11,
      width: model.selected ? 4 : 2,
    });

    this.accent.clear();
    if (texture !== null) {
      return;
    }
    if (showBack) {
      this.accent.roundRect(10, 10, width - 20, height - 20, Math.max(8, radius - 3));
      this.accent.stroke({ color: 0xd2b36a, width: 2 });
      this.accent.moveTo(18, 18);
      this.accent.lineTo(width - 18, height - 18);
      this.accent.moveTo(width - 18, 18);
      this.accent.lineTo(18, height - 18);
      this.accent.stroke({ color: 0x98723a, width: 2 });
    } else {
      this.accent.roundRect(8, 8, width - 16, height - 16, Math.max(8, radius - 4));
      this.accent.stroke({ color: 0x8a5d2b, width: 1.5 });
    }
  }
}
