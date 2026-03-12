export class Camera2D {
  x = 0;
  y = 0;
  zoom = 1;
  readonly minZoom = 0.6;
  readonly maxZoom = 1.8;

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.x) / this.zoom,
      y: (screenY - this.y) / this.zoom,
    };
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.zoom + this.x,
      y: worldY * this.zoom + this.y,
    };
  }

  pan(deltaX: number, deltaY: number): void {
    this.x += deltaX;
    this.y += deltaY;
  }

  zoomAt(screenX: number, screenY: number, zoomFactor: number): void {
    const previousZoom = this.zoom;
    const nextZoom = Math.min(this.maxZoom, Math.max(this.minZoom, previousZoom * zoomFactor));
    if (Math.abs(nextZoom - previousZoom) < 0.0001) {
      return;
    }
    const worldX = (screenX - this.x) / previousZoom;
    const worldY = (screenY - this.y) / previousZoom;
    this.zoom = nextZoom;
    this.x = screenX - worldX * nextZoom;
    this.y = screenY - worldY * nextZoom;
  }
}
