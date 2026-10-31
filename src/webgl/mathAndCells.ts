export interface Vec2 {
  x: number;
  y: number;
}

export interface CellSampledLoop {
  centroidX: number;
  centroidY: number;
  /** M * 2 coordinates in metric (X, Y) space for the inner bevel boundary */
  bevelPts: Float32Array;
  /** M * 2 unit outward normal vectors in metric (X, Y) space */
  outNormals: Float32Array;
}

export const PERIMETER_SAMPLES = 48;

export function easeInCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x;
}

export function easeOutBack(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  const c1 = 1.42;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function easeOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - x, 3);
}

export interface SpringState {
  value: number;
  velocity: number;
}

export function stepSpring(
  state: SpringState,
  target: number,
  dt: number,
  k = 170,
  c = 19,
): number {
  // Sub-step for numerical stability on variable frame deltas
  const clampedDt = Math.min(dt, 0.05);
  const steps = clampedDt > 0.018 ? 2 : 1;
  const h = clampedDt / steps;
  for (let i = 0; i < steps; i++) {
    const force = -k * (state.value - target) - c * state.velocity;
    state.velocity += force * h;
    state.value += state.velocity * h;
  }
  return state.value;
}

interface CutRigConfig {
  phaseOffset: number;
  mirrorX: boolean;
}

/**
 * Computes the 5 live-breathing Facet cells (A, B, C, D, E) in normalized [0..1]^2 space.
 * Edge points: top .22, .515, .84; bottom .34, .865.
 * Inner junctions: J0 (.385, .72), J1 (.48, .62), J2 (.716, .49).
 */
export class LiveCutPattern {
  private readonly phaseOffset: number;
  private readonly mirrorX: boolean;

  // Pre-allocated normalized points
  private readonly pts: Vec2[] = Array.from({ length: 12 }, () => ({ x: 0, y: 0 }));
  // 5 polygons of Vec2 references
  public readonly cells: Vec2[][];

  constructor(config: CutRigConfig) {
    this.phaseOffset = config.phaseOffset;
    this.mirrorX = config.mirrorX;

    // Indices:
    // 0: TL, 1: TR, 2: BR, 3: BL
    // 4: tAB, 5: tBC, 6: tCE
    // 7: bAD, 8: bDE
    // 9: J0, 10: J1, 11: J2
    const p = this.pts;
    this.cells = [
      [p[0], p[4], p[9], p[7], p[3]],       // Cell A (Hero)
      [p[4], p[5], p[10], p[9]],            // Cell B
      [p[5], p[6], p[11], p[10]],           // Cell C
      [p[9], p[10], p[11], p[8], p[7]],     // Cell D
      [p[6], p[1], p[2], p[8], p[11]],      // Cell E
    ];
  }

  public update(
    time: number,
    pointerU: number,
    pointerV: number,
    pointerActive: number,
    breathAmount = 1.0,
    transpose = false,
  ): void {
    const ph = this.phaseOffset;
    const t = time;
    const amp = breathAmount;

    // Base points with independent slow sine drift (periods ~10-20s)
    const tAB_x = 0.22 + Math.sin(t * 0.48 + 0.4 + ph) * 0.026 * amp;
    const tBC_x = 0.515 + Math.sin(t * 0.37 + 1.9 + ph) * 0.028 * amp;
    const tCE_x = 0.84 + Math.sin(t * 0.53 + 3.1 + ph) * 0.024 * amp;

    const bAD_x = 0.34 + Math.sin(t * 0.41 + 2.4 + ph) * 0.028 * amp;
    const bDE_x = 0.865 + Math.sin(t * 0.34 + 4.2 + ph) * 0.024 * amp;

    const j0_x = 0.385 + Math.sin(t * 0.44 + 0.9 + ph) * 0.028 * amp;
    const j0_y = 0.72 + Math.cos(t * 0.36 + 1.5 + ph) * 0.044 * amp;

    const j1_x = 0.48 + Math.sin(t * 0.39 + 2.8 + ph) * 0.028 * amp;
    const j1_y = 0.62 + Math.cos(t * 0.46 + 0.3 + ph) * 0.042 * amp;

    const j2_x = 0.716 + Math.sin(t * 0.33 + 4.7 + ph) * 0.028 * amp;
    const j2_y = 0.49 + Math.cos(t * 0.51 + 2.1 + ph) * 0.045 * amp;

    const p = this.pts;
    p[0].x = 0; p[0].y = 0;
    p[1].x = 1; p[1].y = 0;
    p[2].x = 1; p[2].y = 1;
    p[3].x = 0; p[3].y = 1;

    p[4].x = tAB_x; p[4].y = 0;
    p[5].x = tBC_x; p[5].y = 0;
    p[6].x = tCE_x; p[6].y = 0;

    p[7].x = bAD_x; p[7].y = 1;
    p[8].x = bDE_x; p[8].y = 1;

    p[9].x = j0_x; p[9].y = j0_y;
    p[10].x = j1_x; p[10].y = j1_y;
    p[11].x = j2_x; p[11].y = j2_y;

    if (this.mirrorX) {
      for (let i = 4; i < 12; i++) {
        p[i].x = 1 - p[i].x;
      }
      // Re-maintain monotonic order if mirrored by keeping topology mirrored cleanly:
      // Instead of inverting winding, mirrorX simply shifts phase strongly rather than flipping X order
      for (let i = 4; i < 12; i++) {
        p[i].x = 1 - p[i].x; // restore monotonic order, phaseOffset already decorrelates rear seams
      }
    }

    // Cursor push: points within 0.6 of the pointer are pushed away by up to 0.046
    if (pointerActive > 0.001) {
      const pu = transpose ? pointerV : pointerU;
      const pv = transpose ? pointerU : pointerV;

      // Edge X points (indices 4..8): push along X only so they stay on top/bottom border
      for (let i = 4; i <= 8; i++) {
        const dx = p[i].x - pu;
        const dy = p[i].y - pv;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.0001 && dist < 0.6) {
          const falloff = 1 - dist / 0.6;
          const push = 0.045 * falloff * falloff * pointerActive;
          p[i].x += (dx / dist) * push;
        }
      }

      // Inner junctions (indices 9..11): push in 2D
      for (let i = 9; i <= 11; i++) {
        const dx = p[i].x - pu;
        const dy = p[i].y - pv;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.0001 && dist < 0.6) {
          const falloff = 1 - dist / 0.6;
          const push = 0.048 * falloff * falloff * pointerActive;
          p[i].x += (dx / dist) * push;
          p[i].y += (dy / dist) * push;
        }
      }

      // Enforce safe ordering so cells stay strictly convex
      p[4].x = clamp(p[4].x, 0.13, 0.34);
      p[5].x = clamp(p[5].x, p[4].x + 0.14, 0.66);
      p[6].x = clamp(p[6].x, p[5].x + 0.14, 0.91);

      p[7].x = clamp(p[7].x, 0.18, 0.56);
      p[8].x = clamp(p[8].x, p[7].x + 0.22, 0.93);

      p[9].x = clamp(p[9].x, 0.25, 0.46);
      p[9].y = clamp(p[9].y, 0.58, 0.84);

      p[10].x = clamp(p[10].x, p[9].x + 0.06, 0.61);
      p[10].y = clamp(p[10].y, 0.48, 0.74);

      p[11].x = clamp(p[11].x, p[10].x + 0.11, 0.83);
      p[11].y = clamp(p[11].y, 0.34, 0.64);
    }

    if (transpose) {
      for (let i = 0; i < 12; i++) {
        const tmp = p[i].x;
        p[i].x = p[i].y;
        p[i].y = tmp;
      }
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

// Reusable scratch buffers for zero-GC polygon inset & rounding
const _scaledX = new Float64Array(8);
const _scaledY = new Float64Array(8);
const _insetX = new Float64Array(8);
const _insetY = new Float64Array(8);
const _roundX = new Float64Array(64);
const _roundY = new Float64Array(64);
const _roundNX = new Float64Array(64);
const _roundNY = new Float64Array(64);
const _cumLen = new Float64Array(65);

/**
 * Insets a convex 2D cell polygon in metric space by `totalInset = halfGap + bevelSize`,
 * rounds its corners by `cornerRadius`, and samples `PERIMETER_SAMPLES` uniform points
 * along with smooth outward 2D edge normals.
 */
export function buildSampledCellLoop(
  cell: Vec2[],
  widthMetric: number,
  heightMetric: number,
  totalInset: number,
  cornerRadius: number,
  out: CellSampledLoop,
): void {
  const n = cell.length;
  for (let i = 0; i < n; i++) {
    _scaledX[i] = cell[i].x * widthMetric;
    _scaledY[i] = cell[i].y * heightMetric;
  }

  // Compute signed area to determine winding
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area2 += _scaledX[i] * _scaledY[j] - _scaledX[j] * _scaledY[i];
  }
  const windSign = area2 >= 0 ? 1 : -1;

  // Offset each edge inward by totalInset and intersect adjacent edges
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;

    // Edge 1: prev -> i
    let dx1 = _scaledX[i] - _scaledX[prev];
    let dy1 = _scaledY[i] - _scaledY[prev];
    const len1 = Math.hypot(dx1, dy1) || 1;
    dx1 /= len1;
    dy1 /= len1;
    const nx1 = -dy1 * windSign;
    const ny1 = dx1 * windSign;

    // Edge 2: i -> next
    let dx2 = _scaledX[next] - _scaledX[i];
    let dy2 = _scaledY[next] - _scaledY[i];
    const len2 = Math.hypot(dx2, dy2) || 1;
    dx2 /= len2;
    dy2 /= len2;
    const nx2 = -dy2 * windSign;
    const ny2 = dx2 * windSign;

    const p1x = _scaledX[i] + nx1 * totalInset;
    const p1y = _scaledY[i] + ny1 * totalInset;
    const p2x = _scaledX[i] + nx2 * totalInset;
    const p2y = _scaledY[i] + ny2 * totalInset;

    const denom = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(denom) < 1e-4) {
      _insetX[i] = 0.5 * (p1x + p2x);
      _insetY[i] = 0.5 * (p1y + p2y);
    } else {
      const t = ((p2x - p1x) * dy2 - (p2y - p1y) * dx2) / denom;
      const clampedT = clamp(t, -len1 * 0.45, len1 * 0.45);
      _insetX[i] = p1x + dx1 * clampedT;
      _insetY[i] = p1y + dy1 * clampedT;
    }
  }

  // Round corners with 5 arc points per corner
  const arcSteps = 5;
  let rCount = 0;

  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;

    const vx1 = _insetX[prev] - _insetX[i];
    const vy1 = _insetY[prev] - _insetY[i];
    const l1 = Math.hypot(vx1, vy1) || 1;
    const ux1 = vx1 / l1;
    const uy1 = vy1 / l1;

    const vx2 = _insetX[next] - _insetX[i];
    const vy2 = _insetY[next] - _insetY[i];
    const l2 = Math.hypot(vx2, vy2) || 1;
    const ux2 = vx2 / l2;
    const uy2 = vy2 / l2;

    // Interior half-angle
    const dot = clamp(ux1 * ux2 + uy1 * uy2, -0.98, 0.98);
    const halfAngle = 0.5 * Math.acos(dot);
    const tanHalf = Math.tan(halfAngle) || 1;

    const maxTrim = Math.min(l1 * 0.36, l2 * 0.36);
    const desiredTrim = cornerRadius / tanHalf;
    const trim = Math.min(desiredTrim, maxTrim);
    const actualRadius = trim * tanHalf;

    // Start & end tangent points on edges
    const sx = _insetX[i] + ux1 * trim;
    const sy = _insetY[i] + uy1 * trim;
    const ex = _insetX[i] + ux2 * trim;
    const ey = _insetY[i] + uy2 * trim;

    // Bisector inward toward arc center
    let bx = ux1 + ux2;
    let by = uy1 + uy2;
    const bl = Math.hypot(bx, by) || 1;
    bx /= bl;
    by /= bl;

    const sinHalf = Math.sin(halfAngle) || 1;
    const centerDist = actualRadius / sinHalf;
    const cx = _insetX[i] + bx * centerDist;
    const cy = _insetY[i] + by * centerDist;

    const a0 = Math.atan2(sy - cy, sx - cx);
    let a1 = Math.atan2(ey - cy, ex - cx);

    // Ensure short sweep matching polygon winding
    let sweep = a1 - a0;
    while (sweep > Math.PI) sweep -= Math.PI * 2;
    while (sweep < -Math.PI) sweep += Math.PI * 2;

    for (let s = 0; s < arcSteps; s++) {
      const frac = s / (arcSteps - 1);
      const ang = a0 + sweep * frac;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      _roundX[rCount] = cx + cosA * actualRadius;
      _roundY[rCount] = cy + sinA * actualRadius;
      _roundNX[rCount] = cosA;
      _roundNY[rCount] = sinA;
      rCount++;
    }
  }

  // Cumulative perimeter arc length
  _cumLen[0] = 0;
  for (let i = 0; i < rCount; i++) {
    const j = (i + 1) % rCount;
    const seg = Math.hypot(_roundX[j] - _roundX[i], _roundY[j] - _roundY[i]);
    _cumLen[i + 1] = _cumLen[i] + seg;
  }
  const totalPerim = _cumLen[rCount] || 1;

  // Resample uniformly at PERIMETER_SAMPLES points and compute centroid
  let sumX = 0;
  let sumY = 0;
  let segIdx = 0;

  for (let s = 0; s < PERIMETER_SAMPLES; s++) {
    const targetDist = (s / PERIMETER_SAMPLES) * totalPerim;
    while (segIdx < rCount - 1 && _cumLen[segIdx + 1] < targetDist) {
      segIdx++;
    }
    const segLen = _cumLen[segIdx + 1] - _cumLen[segIdx] || 1e-6;
    const localT = clamp((targetDist - _cumLen[segIdx]) / segLen, 0, 1);
    const nextIdx = (segIdx + 1) % rCount;

    const px = _roundX[segIdx] + (_roundX[nextIdx] - _roundX[segIdx]) * localT;
    const py = _roundY[segIdx] + (_roundY[nextIdx] - _roundY[segIdx]) * localT;

    let nx = _roundNX[segIdx] + (_roundNX[nextIdx] - _roundNX[segIdx]) * localT;
    let ny = _roundNY[segIdx] + (_roundNY[nextIdx] - _roundNY[segIdx]) * localT;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;

    out.bevelPts[s * 2] = px;
    out.bevelPts[s * 2 + 1] = py;
    out.outNormals[s * 2] = nx;
    out.outNormals[s * 2 + 1] = ny;

    sumX += px;
    sumY += py;
  }

  out.centroidX = sumX / PERIMETER_SAMPLES;
  out.centroidY = sumY / PERIMETER_SAMPLES;
}
