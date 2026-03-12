export interface BoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class BoxSelect {
  startX = 0;
  startY = 0;
  currentX = 0;
  currentY = 0;
  active = false;

  begin(x: number, y: number): void {
    this.startX = x;
    this.startY = y;
    this.currentX = x;
    this.currentY = y;
    this.active = true;
  }

  update(x: number, y: number): void {
    this.currentX = x;
    this.currentY = y;
  }

  getRect(): BoxRect {
    return {
      x: Math.min(this.startX, this.currentX),
      y: Math.min(this.startY, this.currentY),
      width: Math.abs(this.currentX - this.startX),
      height: Math.abs(this.currentY - this.startY),
    };
  }

  reset(): void {
    this.active = false;
  }
}
