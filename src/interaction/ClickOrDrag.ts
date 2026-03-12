export function hasExceededDragThreshold(startX: number, startY: number, x: number, y: number, threshold: number): boolean {
  const dx = x - startX;
  const dy = y - startY;
  return Math.hypot(dx, dy) >= threshold;
}
