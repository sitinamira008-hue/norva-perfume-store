import * as THREE from 'three';

export interface BottleLabelContent {
  kicker: string;
  titleLine1: string;
  titleLine2?: string;
  notesLine: string;
  concentration: string;
  volume: string;
  editionCode: string;
}

export type PlaqueStyleVariant = 'khamrah-square' | 'coolwater-square' | 'wide-rect';

export const DEFAULT_HERO_BOTTLE_LABEL: BottleLabelContent = {
  kicker: 'NORVA · HAUTE PARFUMERIE',
  titleLine1: 'Khamrah',
  titleLine2: 'Qawa',
  notesLine: 'Oud · Smoked Leather · Black Amber · Saffron',
  concentration: 'EXTRAIT DE PARFUM',
  volume: '100 ML',
  editionCode: 'N° 01 · GRASSE',
};

// Shared procedural texture caches — generated once per session for zero-lag bottle switching
let _sharedPebbledCapTex: THREE.DataTexture | null = null;
let _sharedFrostedSilicaTex: THREE.DataTexture | null = null;
let _sharedBrushedMetalTex: THREE.DataTexture | null = null;
const _rearLabelCache = new Map<string, THREE.CanvasTexture>();
const _radialGlowCache = new Map<string, THREE.CanvasTexture>();

function measureTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  trackingPx: number,
): number {
  let totalWidth = 0;
  for (let i = 0; i < text.length; i++) {
    totalWidth += ctx.measureText(text[i]).width;
    if (i < text.length - 1) totalWidth += trackingPx;
  }
  return totalWidth;
}

function drawCenteredTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  trackingPx: number,
): void {
  const totalWidth = measureTrackedText(ctx, text, trackingPx);
  let cursorX = centerX - totalWidth * 0.5;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    ctx.fillText(ch, cursorX, y);
    cursorX += ctx.measureText(ch).width + trackingPx;
  }
}

/**
 * Draws crisp silver/platinum typography onto a transparent canvas sized directly to the 3D matte-black plaque face.
 */
export function drawPlaqueTypographyToCanvas(
  canvas: HTMLCanvasElement,
  content: BottleLabelContent,
  variant: PlaqueStyleVariant = 'wide-rect',
): void {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, W, H);

  const centerX = W * 0.5;
  const upperLine = content.titleLine1.trim().toUpperCase();
  const scriptLine = content.titleLine2?.trim() ?? '';
  const isGucciFlora =
    upperLine === 'GUCCI' || scriptLine.toLowerCase() === 'flora';

  const inset = Math.round(Math.min(W, H) * 0.025);
  const cornerR =
    variant === 'khamrah-square'
      ? Math.round(H * 0.13)
      : variant === 'coolwater-square'
        ? Math.round(H * 0.15)
        : Math.round(H * 0.21);

  ctx.save();
  ctx.strokeStyle = 'rgba(235, 236, 242, 0.13)';
  ctx.lineWidth = Math.max(2, W * 0.0026);
  ctx.beginPath();
  ctx.roundRect(inset, inset, W - inset * 2, H - inset * 2, cornerR);
  ctx.stroke();
  ctx.restore();

  const silverGrad = ctx.createLinearGradient(0, H * 0.16, 0, H * 0.86);
  silverGrad.addColorStop(0, '#f7f7fa');
  silverGrad.addColorStop(0.48, '#e2e3e9');
  silverGrad.addColorStop(1, '#b8bbc4');

  if (variant === 'khamrah-square') {
    const k = W / 1024;
    ctx.save();
    ctx.fillStyle = silverGrad;
    ctx.textBaseline = 'alphabetic';
    const fontSize = Math.round((upperLine.length >= 7 ? 176 : 196) * k);
    const tracking = 10 * k;
    ctx.font = `400 ${fontSize}px "Cormorant Garamond", Georgia, serif`;

    const rawW = measureTrackedText(ctx, upperLine, tracking);
    const maxAllowedW = W * 0.82;
    const scaleX = Math.min(0.84, maxAllowedW / Math.max(1, rawW));
    const scaleY = 1.24;

    ctx.translate(centerX, H * 0.48);
    ctx.scale(scaleX, scaleY);
    drawCenteredTrackedText(ctx, upperLine, 0, 0, tracking);
    ctx.restore();

    if (scriptLine) {
      ctx.save();
      ctx.fillStyle = '#e7e8ee';
      ctx.font = `400 ${Math.round(184 * k)}px "Alex Brush", "Cormorant Garamond", cursive`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(scriptLine, centerX, H * 0.77);
      ctx.restore();
    }
    return;
  }

  if (variant === 'coolwater-square') {
    const k = W / 1024;
    ctx.save();
    ctx.fillStyle = silverGrad;
    ctx.textBaseline = 'alphabetic';
    const fontSize = Math.round((upperLine.length <= 4 ? 210 : 168) * k);
    ctx.font = `400 ${fontSize}px "Cormorant Garamond", Georgia, serif`;

    const tracking = (upperLine.length <= 4 ? 14 : 8) * k;
    const rawW = measureTrackedText(ctx, upperLine, tracking);
    const scaleX = Math.min(0.86, (W * 0.78) / Math.max(1, rawW));
    const scaleY = 1.22;

    ctx.translate(centerX, H * 0.48);
    ctx.scale(scaleX, scaleY);
    drawCenteredTrackedText(ctx, upperLine, 0, 0, tracking);
    ctx.restore();

    if (scriptLine) {
      ctx.save();
      ctx.fillStyle = '#e6e8ef';
      ctx.font = `400 ${Math.round(192 * k)}px "Alex Brush", "Cormorant Garamond", cursive`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(scriptLine, centerX, H * 0.79);
      ctx.restore();
    }
    return;
  }

  // 'wide-rect' variant for 9PM Rebel, Jadora Parfum, and Gucci Flora
  const k = W / 1280;
  ctx.save();
  ctx.fillStyle = silverGrad;
  ctx.textBaseline = 'alphabetic';

  const isShortCode = upperLine.length <= 4;
  const baseFontSize = Math.round((isGucciFlora ? 168 : isShortCode ? 204 : 182) * k);
  const tracking = (isGucciFlora ? 34 : isShortCode ? 18 : 12) * k;

  ctx.font = `400 ${baseFontSize}px "Cormorant Garamond", Georgia, serif`;
  const rawW = measureTrackedText(ctx, upperLine, tracking);
  const maxW = W * 0.82;
  const scaleX = rawW > maxW ? maxW / rawW : 1;
  const scaleY = isShortCode ? 1.12 : 1.06;

  const upperY = scriptLine ? (isGucciFlora ? H * 0.45 : H * 0.49) : H * 0.60;
  ctx.translate(centerX, upperY);
  ctx.scale(scaleX, scaleY);
  drawCenteredTrackedText(ctx, upperLine, 0, 0, tracking);
  ctx.restore();

  if (scriptLine) {
    ctx.save();
    ctx.fillStyle = '#e6e7ed';
    const scriptSize = Math.round((isGucciFlora ? 172 : 178) * k);
    ctx.font = `400 ${scriptSize}px "Alex Brush", "Cormorant Garamond", cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const scriptY = isGucciFlora ? H * 0.79 : H * 0.82;
    ctx.fillText(scriptLine, centerX, scriptY);

    if (isGucciFlora) {
      ctx.strokeStyle = 'rgba(228, 230, 238, 0.88)';
      ctx.lineWidth = 5.5 * k;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(centerX - W * 0.16, H * 0.875);
      ctx.quadraticCurveTo(centerX + W * 0.01, H * 0.815, centerX + W * 0.165, H * 0.80);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function createPlaqueTypographyTexture(
  maxAnisotropy: number,
  content: BottleLabelContent,
  variant: PlaqueStyleVariant,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  if (variant === 'khamrah-square' || variant === 'coolwater-square') {
    canvas.width = 768;
    canvas.height = 768;
  } else {
    canvas.width = 1024;
    canvas.height = 576;
  }

  drawPlaqueTypographyToCanvas(canvas, content, variant);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(() => {
      drawPlaqueTypographyToCanvas(canvas, content, variant);
      texture.needsUpdate = true;
    });
  }

  return texture;
}

export function drawBottleLabelToCanvas(
  canvas: HTMLCanvasElement,
  content: BottleLabelContent,
): void {
  drawPlaqueTypographyToCanvas(canvas, content, 'wide-rect');
}

/**
 * Generates (and caches) subtle rear glass flacon engraving (visible during 360° orbit).
 */
export function createRearBottleLabelTexture(
  maxAnisotropy: number,
  volume = '100 ML',
): THREE.CanvasTexture {
  const cached = _rearLabelCache.get(volume);
  if (cached) {
    cached.anisotropy = Math.max(cached.anisotropy, maxAnisotropy);
    return cached;
  }

  const W = 512;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);

  const cx = W * 0.5;
  ctx.fillStyle = 'rgba(232, 232, 238, 0.28)';
  ctx.font = '500 22px "Plus Jakarta Sans", -apple-system, sans-serif';
  drawCenteredTrackedText(ctx, `NORVA · ${volume}`, cx, H * 0.78, 4.2);

  ctx.fillStyle = 'rgba(214, 190, 150, 0.22)';
  ctx.font = '400 16px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HAUTE PARFUMERIE · EXTRAIT', cx, H * 0.85);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.userData = { shared: true };
  texture.needsUpdate = true;
  _rearLabelCache.set(volume, texture);
  return texture;
}

/**
 * Ultra-fast DataTexture generator for Cool Water's pebbled matte-black cap (< 0.8ms, cached globally).
 */
export function createPebbledCapTexture(): THREE.DataTexture {
  if (_sharedPebbledCapTex) return _sharedPebbledCapTex;

  const size = 256;
  const data = new Uint8Array(size * size * 4);

  // Fast cellular stipple grid in pure typed-array math (zero Canvas2D path overhead)
  for (let y = 0; y < size; y++) {
    const cy = y * 0.22;
    const iy = Math.floor(cy);
    const fy = cy - iy;
    for (let x = 0; x < size; x++) {
      const cx = x * 0.22;
      const ix = Math.floor(cx);
      const fx = cx - ix;

      let minDist = 8.0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const gx = (ix + ox) & 63;
          const gy = (iy + oy) & 63;
          const h1 = Math.sin(gx * 127.1 + gy * 311.7) * 43758.5453;
          const h2 = Math.sin(gx * 269.5 + gy * 183.3) * 43758.5453;
          const px = ox + (h1 - Math.floor(h1)) - fx;
          const py = oy + (h2 - Math.floor(h2)) - fy;
          const d = px * px + py * py;
          if (d < minDist) minDist = d;
        }
      }

      const dome = Math.max(0, 1 - Math.sqrt(minDist) * 1.35);
      const v = Math.min(245, Math.max(85, Math.round(108 + dome * 118)));
      const idx = (y * size + x) * 4;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.userData = { shared: true };
  tex.needsUpdate = true;
  _sharedPebbledCapTex = tex;
  return tex;
}

/**
 * Ultra-fast cached DataTexture for acid-etched frosted silica bottles.
 */
export function createFrostedSilicaTexture(): THREE.DataTexture {
  if (_sharedFrostedSilicaTex) return _sharedFrostedSilicaTex;

  const size = 128;
  const data = new Uint8Array(size * size * 4);
  let seed = 9071;
  for (let i = 0; i < size * size; i++) {
    seed = (seed * 16807) % 2147483647;
    const n = 165 + Math.floor(((seed - 1) / 2147483646) * 65);
    const idx = i * 4;
    data[idx] = n;
    data[idx + 1] = n;
    data[idx + 2] = n;
    data[idx + 3] = 255;
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.userData = { shared: true };
  tex.needsUpdate = true;
  _sharedFrostedSilicaTex = tex;
  return tex;
}

/**
 * Ultra-fast cached DataTexture for vertical brushed metallic grain.
 */
export function createBrushedMetalTexture(): THREE.DataTexture {
  if (_sharedBrushedMetalTex) return _sharedBrushedMetalTex;

  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const colVals = new Uint8Array(size);
  let seed = 4409;
  for (let x = 0; x < size; x++) {
    seed = (seed * 16807) % 2147483647;
    colVals[x] = 116 + Math.floor(((seed - 1) / 2147483646) * 56);
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const v = colVals[x];
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.userData = { shared: true };
  tex.needsUpdate = true;
  _sharedBrushedMetalTex = tex;
  return tex;
}

export function createRadialGlowTexture(
  innerRgba: string,
  midRgba: string,
  outerStop = 0.45,
): THREE.CanvasTexture {
  const key = `${innerRgba}|${midRgba}|${outerStop}`;
  const cached = _radialGlowCache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size * 0.5;
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0, innerRgba);
  g.addColorStop(outerStop, midRgba);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData = { shared: true };
  tex.needsUpdate = true;
  _radialGlowCache.set(key, tex);
  return tex;
}
