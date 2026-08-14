import assert from 'node:assert/strict';
import { clipHalfPlane, pointInPoly, voronoiCells } from './shatter.ts';

const w = 200;
const h = 100;
const sites = [
  { x: 40, y: 40 },
  { x: 160, y: 40 },
  { x: 100, y: 80 },
];

const cells = voronoiCells(sites, w, h);
assert.equal(cells.length, 3);
for (let i = 0; i < sites.length; i++) {
  assert.ok(cells[i].length >= 3, `cell ${i} too small`);
  assert.ok(pointInPoly(sites[i], cells[i]), `site ${i} outside its cell`);
}

const mid = { x: 100, y: 40 };
const left = clipHalfPlane(
  [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 100 },
    { x: 0, y: 100 },
  ],
  { x: 40, y: 40 },
  { x: 160, y: 40 },
);
assert.ok(pointInPoly({ x: 20, y: 40 }, left));
assert.ok(!pointInPoly({ x: 180, y: 40 }, left));
assert.ok(Math.max(...left.map((p) => p.x)) <= mid.x + 1e-6);

let bad = 0;
for (let i = 0; i < 300; i++) {
  const p = { x: 1 + Math.random() * (w - 2), y: 1 + Math.random() * (h - 2) };
  const hits = cells.filter((c) => pointInPoly(p, c)).length;
  if (hits !== 1) bad += 1;
}
assert.ok(bad < 12, `voronoi coverage misses=${bad}`);
console.log('ok');
