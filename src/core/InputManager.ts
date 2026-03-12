export interface InputHandlers {
  onMouseDown: (event: MouseEvent) => void;
  onMouseMove: (event: MouseEvent) => void;
  onMouseUp: (event: MouseEvent) => void;
  onWheel: (event: WheelEvent) => void;
}

export class InputManager {
  constructor(private readonly target: HTMLCanvasElement, private readonly handlers: InputHandlers) {}

  attach(): void {
    this.target.addEventListener('mousedown', this.handlers.onMouseDown);
    this.target.addEventListener('wheel', this.handlers.onWheel, { passive: false });
    window.addEventListener('mousemove', this.handlers.onMouseMove);
    window.addEventListener('mouseup', this.handlers.onMouseUp);
    this.target.addEventListener('contextmenu', this.preventContextMenu);
  }

  destroy(): void {
    this.target.removeEventListener('mousedown', this.handlers.onMouseDown);
    this.target.removeEventListener('wheel', this.handlers.onWheel);
    window.removeEventListener('mousemove', this.handlers.onMouseMove);
    window.removeEventListener('mouseup', this.handlers.onMouseUp);
    this.target.removeEventListener('contextmenu', this.preventContextMenu);
  }

  private readonly preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}
