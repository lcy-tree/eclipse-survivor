// 空间哈希网格：将 O(n²) 的近邻搜索优化为 O(n)
// 使用固定大小的网格单元，将实体分配到桶中，查询时只需检查相邻单元

class SpatialGrid {
  constructor(cellSize = 200) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  _key(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  insert(entity) {
    const key = this._key(entity.x, entity.y);
    let bucket = this.cells.get(key);
    if (!bucket) {
      bucket = [];
      this.cells.set(key, bucket);
    }
    bucket.push(entity);
  }

  insertAll(entities) {
    for (const entity of entities) {
      this.insert(entity);
    }
  }

  // 查询某个位置周围 radius 内的所有实体
  query(x, y, radius = 0) {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);
    const results = [];
    const seen = new Set();

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = `${cx},${cy}`;
        const bucket = this.cells.get(key);
        if (!bucket) continue;
        for (const entity of bucket) {
          // 用对象引用去重（实体可能同时在多个边界桶中，但这里每个实体只在一个桶里）
          if (seen.has(entity)) continue;
          seen.add(entity);
          if (radius <= 0 || Math.hypot(entity.x - x, entity.y - y) <= radius) {
            results.push(entity);
          }
        }
      }
    }
    return results;
  }

  // 找到离 (x, y) 最近的实体，可选 radius 限制
  findNearest(x, y, radius = Infinity) {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);
    let best = null;
    let bestD = radius;
    const seen = new Set();

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = `${cx},${cy}`;
        const bucket = this.cells.get(key);
        if (!bucket) continue;
        for (const entity of bucket) {
          if (seen.has(entity)) continue;
          seen.add(entity);
          const d = Math.hypot(entity.x - x, entity.y - y);
          if (d < bestD) {
            bestD = d;
            best = entity;
          }
        }
      }
    }
    return best;
  }

  // 查找 radius 内的最近 N 个实体（用于群体效果）
  queryNearest(x, y, radius, limit = Infinity) {
    const nearby = this.query(x, y, radius);
    nearby.sort((a, b) => {
      const da = Math.hypot(a.x - x, a.y - y);
      const db = Math.hypot(b.x - x, b.y - y);
      return da - db;
    });
    return nearby.slice(0, limit);
  }

  // 统计所有实体数量
  get size() {
    let count = 0;
    for (const bucket of this.cells.values()) count += bucket.length;
    return count;
  }
}

module.exports = { SpatialGrid };
