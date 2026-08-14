import './style.css';
import { spawnCrack, drawCracks, seedsFromCracks, type Crack } from './cracks';
import { crackSound, createAudio, paintPixels, sizeCanvas, snapshotTexture, startCamera } from './media';
import type { Pt } from './media';
import { explode } from './shatter';

const CLICKS_TO_BREAK = 10;

const video = document.querySelector<HTMLVideoElement>('#cam')!;
const pixelCanvas = document.querySelector<HTMLCanvasElement>('#pixels')!;
const crackCanvas = document.querySelector<HTMLCanvasElement>('#cracks')!;
const glass = document.querySelector<HTMLElement>('#glass')!;
const shards = document.querySelector<HTMLElement>('#shards')!;
const gate = document.querySelector<HTMLElement>('#gate')!;
const startBtn = document.querySelector<HTMLButtonElement>('#start')!;

let w = innerWidth;
let h = innerHeight;
let pixelCtx = sizeCanvas(pixelCanvas, w, h);
let crackCtx = sizeCanvas(crackCanvas, w, h);
let audio: AudioContext | null = null;
let cracks: Crack[] = [];
let clicks: Pt[] = [];
let phase: 'gate' | 'play' | 'boom' | 'done' = 'gate';
let frozen = false;

function layout(): void {
  w = innerWidth;
  h = innerHeight;
  pixelCtx = sizeCanvas(pixelCanvas, w, h);
  crackCtx = sizeCanvas(crackCanvas, w, h);
}

function intensity(): number {
  return Math.min(1, clicks.length / CLICKS_TO_BREAK);
}

function loop(now: number): void {
  if (!frozen) paintPixels(pixelCtx, video, w, h);
  if (phase === 'play' || phase === 'boom') drawCracks(crackCtx, cracks, now, w, h);
  requestAnimationFrame(loop);
}

function shatter(): void {
  phase = 'boom';
  frozen = true;
  paintPixels(pixelCtx, video, w, h);
  const last = clicks[clicks.length - 1] ?? { x: w / 2, y: h / 2 };
  const texture = snapshotTexture(pixelCanvas, crackCanvas, w, h);
  glass.hidden = true;
  crackCanvas.hidden = true;
  explode({
    sites: seedsFromCracks(clicks, cracks, w, h),
    width: w,
    height: h,
    texture,
    host: shards,
    epicenter: last,
    onDone: () => {
      phase = 'done';
    },
  });
}

function onPointer(ev: PointerEvent): void {
  if (phase !== 'play') return;
  const origin = { x: ev.clientX, y: ev.clientY };
  clicks.push(origin);
  const last = clicks.length >= CLICKS_TO_BREAK;
  cracks.push(spawnCrack(origin, w, h, clicks.slice(0, -1), intensity()));
  if (audio) {
    void audio.resume();
    crackSound(audio, last);
  }
  if (last) {
    phase = 'boom';
    window.setTimeout(shatter, cracks[cracks.length - 1].duration + 80);
  }
}

async function begin(): Promise<void> {
  audio = createAudio();
  void audio.resume();
  await startCamera(video);
  gate.hidden = true;
  glass.hidden = false;
  crackCanvas.hidden = false;
  phase = 'play';
}

startBtn.addEventListener('click', () => void begin());
crackCanvas.addEventListener('pointerdown', onPointer);
window.addEventListener('resize', () => {
  // ponytail: resize drops in-flight cracks (coords are viewport-absolute). Reload if you care.
  if (phase === 'play') {
    cracks = [];
    clicks = [];
  }
  layout();
});

requestAnimationFrame(loop);
