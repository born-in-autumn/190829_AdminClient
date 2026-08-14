import type { Pt } from './media';

type Path = { pts: Pt[]; lens: number[]; total: number };

export type Crack = {
  paths: Path[];
  born: number;
  duration: number;
};

function hypot(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function measure(pts: Pt[]): Path {
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = hypot(pts[i - 1], pts[i]);
    lens.push(d);
    total += d;
  }
  return { pts, lens, total };
}

function clampEdge(prev: Pt, next: Pt, w: number, h: number): Pt {
  let { x, y } = next;
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  if (x < 0 && dx) {
    y = prev.y + (dy * -prev.x) / dx;
    x = 0;
  } else if (x > w && dx) {
    y = prev.y + (dy * (w - prev.x)) / dx;
    x = w;
  }
  if (y < 0 && dy) {
    x = prev.x + (dx * -prev.y) / dy;
    y = 0;
  } else if (y > h && dy) {
    x = prev.x + (dx * (h - prev.y)) / dy;
    y = h;
  }
  return { x: Math.min(w, Math.max(0, x)), y: Math.min(h, Math.max(0, y)) };
}

function walk(start: Pt, angle: number, w: number, h: number, steps: number, step: number): Path {
  const pts: Pt[] = [start];
  let x = start.x;
  let y = start.y;
  let a = angle;
  for (let i = 0; i < steps; i++) {
    a += (Math.random() - 0.5) * 0.55;
    const nx = x + Math.cos(a) * step;
    const ny = y + Math.sin(a) * step;
    const next = clampEdge({ x, y }, { x: nx, y: ny }, w, h);
    pts.push(next);
    if (next.x <= 0 || next.y <= 0 || next.x >= w || next.y >= h) break;
    x = next.x;
    y = next.y;
  }
  return measure(pts);
}

export function spawnCrack(origin: Pt, w: number, h: number, prev: Pt[], intensity: number): Crack {
  const rays = 3 + Math.floor(Math.random() * 3) + (intensity > 0.7 ? 1 : 0);
  const base = Math.random() * Math.PI * 2;
  const paths: Path[] = [];
  const step = 36 + Math.random() * 70;

  for (let i = 0; i < rays; i++) {
    const angle = base + (i * Math.PI * 2) / rays + (Math.random() - 0.5) * 0.45;
    const main = walk(origin, angle, w, h, 7 + Math.floor(Math.random() * 8), step);
    paths.push(main);
    if (main.pts.length > 3 && Math.random() < 0.65) {
      const fork = main.pts[2 + Math.floor(Math.random() * (main.pts.length - 3))];
      paths.push(walk(fork, angle + (Math.random() < 0.5 ? 0.9 : -0.9), w, h, 4, step * 0.55));
    }
  }

  if (prev.length) {
    let nearest = prev[0];
    let best = hypot(origin, nearest);
    for (const p of prev) {
      const d = hypot(origin, p);
      if (d < best) {
        best = d;
        nearest = p;
      }
    }
    if (best < Math.min(w, h) * 0.45) {
      paths.push(walk(origin, Math.atan2(nearest.y - origin.y, nearest.x - origin.x), w, h, 5, best / 5));
    }
  }

  return { paths, born: performance.now(), duration: 280 + intensity * 180 };
}

function strokePartial(
  ctx: CanvasRenderingContext2D,
  path: Path,
  budget: number,
  width: number,
  color: string,
): void {
  if (path.pts.length < 2 || budget <= 0) return;
  ctx.beginPath();
  ctx.moveTo(path.pts[0].x, path.pts[0].y);
  let left = budget;
  for (let i = 1; i < path.pts.length; i++) {
    const seg = path.lens[i - 1];
    const a = path.pts[i - 1];
    const b = path.pts[i];
    if (left >= seg) {
      ctx.lineTo(b.x, b.y);
      left -= seg;
    } else {
      const t = left / seg;
      ctx.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      break;
    }
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function drawCracks(
  ctx: CanvasRenderingContext2D,
  cracks: Crack[],
  now: number,
  w: number,
  h: number,
): void {
  ctx.clearRect(0, 0, w, h);
  for (const crack of cracks) {
    const t = Math.min(1, (now - crack.born) / crack.duration);
    const ease = 1 - (1 - t) ** 3;
    for (const path of crack.paths) {
      const budget = path.total * ease;
      strokePartial(ctx, path, budget, 2.6, 'rgba(255,255,255,0.38)');
      strokePartial(ctx, path, budget, 1.15, 'rgba(28,36,46,0.88)');
    }
  }
}

export function seedsFromCracks(clicks: Pt[], cracks: Crack[], w: number, h: number): Pt[] {
  const seeds = clicks.map((p) => ({ ...p }));
  for (const crack of cracks) {
    const long = crack.paths.reduce((a, b) => (b.total > a.total ? b : a));
    if (long.pts.length >= 3) seeds.push({ ...long.pts[Math.floor(long.pts.length / 2)] });
    if (long.pts.length >= 5) seeds.push({ ...long.pts[long.pts.length - 2] });
  }
  const extras = 8;
  for (let i = 0; i < extras; i++) {
    seeds.push({ x: Math.random() * w, y: Math.random() * h });
  }
  return seeds;
}
