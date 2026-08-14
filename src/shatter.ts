import type { Pt } from './media';

export type Poly = Pt[];

function inside(p: Pt, mid: Pt, nx: number, ny: number): boolean {
  return (p.x - mid.x) * nx + (p.y - mid.y) * ny <= 1e-6;
}

function intersect(a: Pt, b: Pt, mid: Pt, nx: number, ny: number): Pt {
  const da = (a.x - mid.x) * nx + (a.y - mid.y) * ny;
  const db = (b.x - mid.x) * nx + (b.y - mid.y) * ny;
  const t = da / (da - db);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function clipHalfPlane(poly: Poly, site: Pt, other: Pt): Poly {
  const mid = { x: (site.x + other.x) / 2, y: (site.y + other.y) / 2 };
  const nx = other.x - site.x;
  const ny = other.y - site.y;
  const out: Poly = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const curIn = inside(cur, mid, nx, ny);
    const prevIn = inside(prev, mid, nx, ny);
    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur, mid, nx, ny));
      out.push(cur);
    } else if (prevIn) {
      out.push(intersect(prev, cur, mid, nx, ny));
    }
  }
  return out;
}

export function pointInPoly(p: Pt, poly: Poly): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const mid = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (mid) hit = !hit;
  }
  return hit;
}

function dedupe(sites: Pt[], minDist: number): Pt[] {
  const out: Pt[] = [];
  for (const s of sites) {
    if (out.every((o) => Math.hypot(s.x - o.x, s.y - o.y) >= minDist)) out.push(s);
  }
  return out;
}

export function voronoiCells(sites: Pt[], w: number, h: number): Poly[] {
  const unique = dedupe(sites, Math.max(28, Math.min(w, h) * 0.04));
  const bounds: Poly = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  return unique
    .map((site) => {
      let cell = bounds;
      for (const other of unique) {
        if (other === site) continue;
        cell = clipHalfPlane(cell, site, other);
        if (cell.length < 3) break;
      }
      return cell;
    })
    .filter((cell) => cell.length >= 3);
}

function centroid(poly: Poly): Pt {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

export function explode(opts: {
  sites: Pt[];
  width: number;
  height: number;
  texture: string;
  host: HTMLElement;
  epicenter: Pt;
  onDone: () => void;
}): void {
  const cells = voronoiCells(opts.sites, opts.width, opts.height);
  let left = cells.length;
  if (!left) {
    opts.onDone();
    return;
  }

  for (const cell of cells) {
    const el = document.createElement('div');
    el.className = 'shard';
    el.style.clipPath = `polygon(${cell.map((p) => `${p.x}px ${p.y}px`).join(',')})`;
    el.style.backgroundImage = `url(${opts.texture})`;
    const c = centroid(cell);
    const dist = Math.hypot(c.x - opts.epicenter.x, c.y - opts.epicenter.y);
    const ang = Math.atan2(c.y - opts.epicenter.y, c.x - opts.epicenter.x);
    const kick = 180 + dist * 0.35;
    const dx = Math.cos(ang) * kick + (Math.random() - 0.5) * 80;
    const dy = Math.sin(ang) * kick * 0.35 + 520 + Math.random() * 420;
    const rot = (Math.random() - 0.5) * 160;
    opts.host.append(el);
    const anim = el.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0.12 },
      ],
      {
        duration: 1050 + Math.random() * 380,
        delay: Math.min(220, dist * 0.35),
        easing: 'cubic-bezier(0.33, 0, 0.72, 0.28)',
        fill: 'forwards',
      },
    );
    anim.onfinish = () => {
      el.remove();
      left -= 1;
      if (!left) opts.onDone();
    };
  }
}
