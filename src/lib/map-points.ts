export const MAP_COLORS = ["#80BEFF", "#10A13B", "#FFD500", "#DA1C24"] as const;

export function pointColor(people: number, maximum: number) {
  const relative = maximum > 0 ? Math.max(0, people) / maximum : 0;
  return MAP_COLORS[Math.min(3, Math.max(0, Math.ceil(relative * 4) - 1))];
}

export type ScreenPoint = { x: number; y: number };

// Separate symbols in screen pixels, never the stored geographic coordinates.
// Each input remains an individual point, even when every location is equal.
export function separatePoints(
  points: ScreenPoint[],
  width: number,
  height: number,
  spacing = 28,
): ScreenPoint[] {
  const cells = new Map<string, ScreenPoint[]>();
  const key = (x: number, y: number) => x + "," + y;
  const free = (point: ScreenPoint) => {
    const cx = Math.floor(point.x / spacing),
      cy = Math.floor(point.y / spacing);
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let y = cy - 1; y <= cy + 1; y++)
        if (
          cells
            .get(key(x, y))
            ?.some(
              (other) =>
                Math.hypot(other.x - point.x, other.y - point.y) < spacing,
            )
        )
          return false;
    return true;
  };
  return points.map((original) => {
    let placed = original;
    // Do not pull locations outside the current viewport back onto the map.
    if (
      original.x >= 0 &&
      original.x <= width &&
      original.y >= 0 &&
      original.y <= height &&
      !free(original)
    ) {
      for (
        let attempt = 1;
        attempt < Math.max(500, points.length * 100);
        attempt++
      ) {
        const radius = spacing * Math.sqrt(attempt),
          angle = attempt * 2.399963229728653;
        const candidate = {
          x: original.x + radius * Math.cos(angle),
          y: original.y + radius * Math.sin(angle),
        };
        if (
          candidate.x < 12 ||
          candidate.x > width - 12 ||
          candidate.y < 12 ||
          candidate.y > height - 12 ||
          !free(candidate)
        )
          continue;
        placed = candidate;
        break;
      }
    }
    const cell = key(
      Math.floor(placed.x / spacing),
      Math.floor(placed.y / spacing),
    );
    cells.set(cell, [...(cells.get(cell) ?? []), placed]);
    return placed;
  });
}
