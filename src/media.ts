export type Pt = { x: number; y: number };

const PIXEL_COLS = 56;

export function sizeCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export async function startCamera(video: HTMLVideoElement): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    return true;
  } catch {
    return false;
  }
}

const off = document.createElement('canvas');
const offCtx = off.getContext('2d')!;

function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  dw: number,
  dh: number,
): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.max(dw / vw, dh / vh);
  const sw = dw / scale;
  const sh = dh / scale;
  ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, dw, dh);
}

export function paintPixels(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number,
): void {
  if (video.readyState < 2) return;
  const cols = PIXEL_COLS;
  const rows = Math.max(1, Math.round(cols * (h / w)));
  off.width = cols;
  off.height = rows;
  drawCover(offCtx, video, cols, rows);
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(off, 0, 0, w, h);
  ctx.restore();
}

export function createAudio(): AudioContext {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new Ctor();
}

export function crackSound(ctx: AudioContext, heavy = false): void {
  const now = ctx.currentTime;
  const dur = (heavy ? 0.16 : 0.09) + Math.random() * 0.05;
  const n = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = (heavy ? 500 : 900) + Math.random() * 2200;
  filter.Q.value = heavy ? 0.5 : 0.85;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(heavy ? 0.55 : 0.38, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + dur);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(now);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1800 + Math.random() * 900, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);
  const snap = ctx.createGain();
  snap.gain.setValueAtTime(heavy ? 0.18 : 0.1, now);
  snap.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
  osc.connect(snap).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.06);
}

export function snapshotTexture(
  pixelCanvas: HTMLCanvasElement,
  crackCanvas: HTMLCanvasElement,
  w: number,
  h: number,
): string {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.filter = 'blur(14px)';
  ctx.drawImage(pixelCanvas, 0, 0, w, h);
  ctx.filter = 'none';
  ctx.fillStyle = 'rgba(210, 228, 245, 0.42)';
  ctx.fillRect(0, 0, w, h);
  const glare = ctx.createLinearGradient(0, 0, w, h);
  glare.addColorStop(0, 'rgba(255,255,255,0.22)');
  glare.addColorStop(0.4, 'transparent');
  ctx.fillStyle = glare;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(crackCanvas, 0, 0, w, h);
  return c.toDataURL('image/png');
}
