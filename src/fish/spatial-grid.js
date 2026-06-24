/**
 * Uniform spatial hash grid for accelerating boids neighbour queries.
 *
 * The aquarium is centred on the origin, so cell coordinates can be negative;
 * we hash signed integer cell coordinates into a Map of buckets. Bucket arrays
 * and the query-result buffer are pooled and reused across frames, so steady
 * state runs without per-frame heap allocation.
 */
export class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize > 0 ? cellSize : 1;
    this.buckets = new Map();
    this.freeBuckets = [];
    this.neighborScratch = [];
  }

  /**
   * Resize cells. No-op when unchanged so callers can invoke it every frame
   * (perceptionRadius is adjustable from the UI).
   */
  setCellSize(cellSize) {
    const next = cellSize > 0 ? cellSize : 1;
    if (next !== this.cellSize) {
      this.cellSize = next;
    }
  }

  clear() {
    for (const bucket of this.buckets.values()) {
      bucket.length = 0;
      this.freeBuckets.push(bucket);
    }
    this.buckets.clear();
  }

  /** Rebuild the grid from an array of items exposing a `.position`. */
  build(items) {
    this.clear();
    for (let i = 0; i < items.length; i += 1) {
      this.insert(i, items[i].position);
    }
  }

  insert(index, position) {
    const key = this.hash(
      this.cellIndex(position.x),
      this.cellIndex(position.y),
      this.cellIndex(position.z),
    );
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = this.freeBuckets.pop() ?? [];
      this.buckets.set(key, bucket);
    }
    bucket.push(index);
  }

  /**
   * Collect indices in the 3x3x3 block of cells around `position` into a
   * reused buffer and return it. The buffer is overwritten on each call, so
   * consume it before querying again.
   */
  queryNeighbors(position) {
    const result = this.neighborScratch;
    result.length = 0;

    const cx = this.cellIndex(position.x);
    const cy = this.cellIndex(position.y);
    const cz = this.cellIndex(position.z);

    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let oz = -1; oz <= 1; oz += 1) {
          const bucket = this.buckets.get(this.hash(cx + ox, cy + oy, cz + oz));
          if (!bucket) continue;
          for (let i = 0; i < bucket.length; i += 1) {
            result.push(bucket[i]);
          }
        }
      }
    }

    return result;
  }

  cellIndex(value) {
    return Math.floor(value / this.cellSize);
  }

  hash(x, y, z) {
    // Pack signed cell coordinates into a single string key. Cell counts stay
    // small (aquarium is a few dozen cells per axis) so collisions are bounded
    // by the +/-512 offset used to keep the components non-negative.
    return ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
  }
}
