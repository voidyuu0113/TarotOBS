export interface PinchGesture {
  centerX: number;
  centerY: number;
  deltaX: number;
  deltaY: number;
  scaleFactor: number;
}

export interface InputHandlers {
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  onWheel: (event: WheelEvent) => void;
  onGestureStart: () => void;
  onPinch: (gesture: PinchGesture) => void;
  onGestureEnd: () => void;
}

interface TouchPoint {
  x: number;
  y: number;
}

interface GestureSnapshot extends TouchPoint {
  distance: number;
}

export class InputManager {
  private readonly touches = new Map<number, TouchPoint>();
  private gestureSnapshot: GestureSnapshot | null = null;
  private suppressTouchUntilClear = false;

  constructor(private readonly target: HTMLCanvasElement, private readonly handlers: InputHandlers) {}

  attach(): void {
    this.target.addEventListener('pointerdown', this.onPointerDown);
    this.target.addEventListener('wheel', this.handlers.onWheel, { passive: false });
    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    this.target.addEventListener('contextmenu', this.preventContextMenu);
  }

  destroy(): void {
    this.target.removeEventListener('pointerdown', this.onPointerDown);
    this.target.removeEventListener('wheel', this.handlers.onWheel);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.target.removeEventListener('contextmenu', this.preventContextMenu);
    this.touches.clear();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') {
      this.handlers.onPointerDown(event);
      return;
    }

    event.preventDefault();
    this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.target.setPointerCapture?.(event.pointerId);
    if (this.touches.size === 1 && !this.suppressTouchUntilClear) {
      this.handlers.onPointerDown(event);
      return;
    }
    if (this.touches.size === 2) {
      this.suppressTouchUntilClear = true;
      this.handlers.onGestureStart();
      this.gestureSnapshot = this.getGestureSnapshot();
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') {
      this.handlers.onPointerMove(event);
      return;
    }
    if (!this.touches.has(event.pointerId)) {
      return;
    }

    event.preventDefault();
    this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.touches.size >= 2) {
      const next = this.getGestureSnapshot();
      const previous = this.gestureSnapshot ?? next;
      if (next && previous) {
        this.handlers.onPinch({
          centerX: next.x,
          centerY: next.y,
          deltaX: next.x - previous.x,
          deltaY: next.y - previous.y,
          scaleFactor: previous.distance > 0 ? next.distance / previous.distance : 1,
        });
        this.gestureSnapshot = next;
      }
      return;
    }
    if (!this.suppressTouchUntilClear) {
      this.handlers.onPointerMove(event);
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') {
      this.handlers.onPointerUp(event);
      return;
    }
    if (!this.touches.has(event.pointerId)) {
      return;
    }

    event.preventDefault();
    const wasGesture = this.suppressTouchUntilClear;
    this.touches.delete(event.pointerId);
    if (!wasGesture) {
      this.handlers.onPointerUp(event);
    } else if (this.touches.size < 2 && this.gestureSnapshot) {
      this.gestureSnapshot = null;
      this.handlers.onGestureEnd();
    }
    if (this.touches.size === 0) {
      this.suppressTouchUntilClear = false;
    }
  };

  private getGestureSnapshot(): GestureSnapshot | null {
    const points = Array.from(this.touches.values());
    if (points.length < 2) {
      return null;
    }
    const [a, b] = points;
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance: Math.hypot(b.x - a.x, b.y - a.y),
    };
  }

  private readonly preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}
