import * as THREE from 'three';
import {
  BottleLabelContent,
  PlaqueStyleVariant,
  createBrushedMetalTexture,
  createFrostedSilicaTexture,
  createPebbledCapTexture,
  createPlaqueTypographyTexture,
  createRearBottleLabelTexture,
} from './labelTexture';
import { SpringState } from './mathAndCells';

export type BottleArchetypeId =
  | 'amber'     // 01 · Khamrah Qawa — Frosted Amber Cylinder + 4-Ribbed Glossy Black Cap
  | 'cobalt'    // 02 · Cool Water — Frosted Cobalt-to-Seafoam Rectangular Block + Pebbled Cap
  | 'noir'      // 03 · 9mM Rebel — Matte-Black Upper + Smoked-Glass Lower Monolith + Glossy Cap
  | 'champagne' // 04 · Jadora — Optical Golden Crystal Rectangular Flacon + Brushed Bronze Cap
  | 'obsidian'  // 05 · Gucci Flora — Optical Amethyst Crystal Rectangular Flacon + Slate-Indigo Cap
  | 'violet'
  | 'emerald';

export interface BottleInspectablePart {
  id: string;
  group: THREE.Group;
  restPos: THREE.Vector3;
  explodeOffset: THREE.Vector3;
  explodeRot: THREE.Euler;
  hoverOffset: THREE.Vector3;
  raycastMeshes: THREE.Mesh[];
  liftSpring: SpringState;
  tipXSpring: SpringState;
  tipYSpring: SpringState;
}

export interface BespokeBottleSharedUniforms {
  uTime: { value: number };
  uTiltVel: { value: THREE.Vector2 };
  uCursorWorld: { value: THREE.Vector3 };
  uCursorStrength: { value: number };
  uLayoutScale: { value: number };
}

export interface BespokeBottleBuildOptions {
  archetype: BottleArchetypeId;
  scale: number;
  label: BottleLabelContent;
  maxAnisotropy: number;
  isSoftwareGl: boolean;
  isMobileDevice: boolean;
  sharedUniforms: BespokeBottleSharedUniforms;
}

export interface BespokeBottleAssembly {
  rootGroup: THREE.Group;
  parts: BottleInspectablePart[];
  raycastTargets: THREE.Mesh[];
  labelCanvasTex: THREE.CanvasTexture;
  plaqueVariant: PlaqueStyleVariant;
  footprintRadius: number;
  bottomY: number;
  topY: number;
  dispose: () => void;
}

interface DisposableTracker {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
  textures: Set<THREE.Texture>;
  geo: <T extends THREE.BufferGeometry>(g: T) => T;
  mat: <T extends THREE.Material>(m: T) => T;
  tex: <T extends THREE.Texture>(t: T) => T;
  disposeAll: () => void;
}

function createDisposableTracker(): DisposableTracker {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  return {
    geometries,
    materials,
    textures,
    geo<T extends THREE.BufferGeometry>(g: T): T {
      geometries.add(g);
      return g;
    },
    mat<T extends THREE.Material>(m: T): T {
      materials.add(m);
      return m;
    },
    tex<T extends THREE.Texture>(t: T): T {
      textures.add(t);
      return t;
    },
    disposeAll() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => {
        if (!t.userData?.shared) {
          t.dispose();
        }
      });
      geometries.clear();
      materials.clear();
      textures.clear();
    },
  };
}

function createRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const cr = Math.max(0.01, Math.min(r, hw * 0.48, hh * 0.48));
  const s = new THREE.Shape();
  s.moveTo(-hw + cr, -hh);
  s.lineTo(hw - cr, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + cr);
  s.lineTo(hw, hh - cr);
  s.quadraticCurveTo(hw, hh, hw - cr, hh);
  s.lineTo(-hw + cr, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - cr);
  s.lineTo(-hw, -hh + cr);
  s.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
  return s;
}

/**
 * Builds a vertically extruded rounded-rectangle prism centered in X/Z and spanning [minY, maxY] in Y.
 */
function createVerticalRoundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  cornerRadius: number,
  bevelSize: number,
  bevelSegments = 3,
  heightSteps = 1,
): THREE.BufferGeometry {
  const b = Math.min(bevelSize, width * 0.16, depth * 0.16, height * 0.16);
  const innerW = Math.max(2, width - b * 2);
  const innerD = Math.max(2, depth - b * 2);
  const innerH = Math.max(2, height - b * 2);

  const shape = createRoundedRectShape(innerW, innerD, Math.max(0.5, cornerRadius - b));
  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: heightSteps,
    depth: innerH,
    bevelEnabled: b > 0.05,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments,
    curveSegments: 10,
  });

  // Extrude is along +Z; rotate -90° around X so extrusion runs vertically along +Y
  geo.rotateX(-Math.PI / 2);
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/**
 * Applies a multi-stop vertical vertex-color gradient along Y from [minY, maxY].
 */
function applyVerticalVertexGradient(
  geo: THREE.BufferGeometry,
  stops: { t: number; hex: number }[],
): void {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const minY = bb.min.y;
  const spanY = Math.max(0.001, bb.max.y - minY);

  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const parsedStops = stops.map((s) => ({
    t: s.t,
    color: new THREE.Color(s.hex),
  }));
  const tmpColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp((y - minY) / spanY, 0, 1);

    if (t <= parsedStops[0].t) {
      tmpColor.copy(parsedStops[0].color);
    } else if (t >= parsedStops[parsedStops.length - 1].t) {
      tmpColor.copy(parsedStops[parsedStops.length - 1].color);
    } else {
      for (let k = 0; k < parsedStops.length - 1; k++) {
        const a = parsedStops[k];
        const b = parsedStops[k + 1];
        if (t >= a.t && t <= b.t) {
          const localT = (t - a.t) / Math.max(0.0001, b.t - a.t);
          const smoothT = localT * localT * (3 - 2 * localT);
          tmpColor.copy(a.color).lerp(b.color, smoothT);
          break;
        }
      }
    }

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/**
 * Builds a flat 3D beveled matte-black rounded-rectangle plaque + crisp front typography decal plane.
 */
function createFlatPlaqueGroup(
  width: number,
  height: number,
  cornerRadius: number,
  scale: number,
  labelTex: THREE.CanvasTexture,
  tracker: DisposableTracker,
): { group: THREE.Group; plaqueMesh: THREE.Mesh } {
  const S = scale;
  const group = new THREE.Group();

  const depth = 2.4 * S;
  const bevel = 0.85 * S;
  const shape = createRoundedRectShape(
    width - bevel * 2,
    height - bevel * 2,
    Math.max(2 * S, cornerRadius - bevel),
  );
  const plaqueGeo = tracker.geo(
    new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 16,
    }),
  );
  plaqueGeo.center();
  plaqueGeo.computeVertexNormals();

  const plaqueMat = tracker.mat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0b0b0e,
      roughness: 0.54,
      metalness: 0.08,
      clearcoat: 0.16,
      clearcoatRoughness: 0.38,
      envMapIntensity: 1.15,
    }),
  );

  const plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat);
  plaqueMesh.renderOrder = 5;
  group.add(plaqueMesh);

  const textGeo = tracker.geo(new THREE.PlaneGeometry(width, height));
  textGeo.translate(0, 0, (depth + bevel * 2) * 0.5 + 0.42 * S);

  const textMat = tracker.mat(
    new THREE.MeshBasicMaterial({
      map: labelTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  const textMesh = new THREE.Mesh(textGeo, textMat);
  textMesh.renderOrder = 6;
  group.add(textMesh);

  return { group, plaqueMesh };
}

/**
 * Builds a 3D cylindrical-arc curved matte-black rounded-square plaque + matching curved typography mesh
 * so Khamrah Qawa's label wraps seamlessly onto its round amber glass cylinder.
 */
function createCurvedCylinderPlaqueGroup(
  cylinderRadius: number,
  arcLength: number,
  height: number,
  cornerRadius: number,
  scale: number,
  labelTex: THREE.CanvasTexture,
  tracker: DisposableTracker,
): { group: THREE.Group; plaqueMesh: THREE.Mesh } {
  const S = scale;
  const group = new THREE.Group();

  const thickness = 2.2 * S;
  const bevel = 0.75 * S;
  // Build a smooth curved 3D rounded-rect shell using a clean UV grid clipped to rounded-rect perimeter
  const bendGeometryOntoCylinder = (
    geo: THREE.BufferGeometry,
    baseRadius: number,
  ): THREE.BufferGeometry => {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const r = baseRadius + z;
      const theta = x / cylinderRadius;
      pos.setXYZ(i, r * Math.sin(theta), y, r * Math.cos(theta) - cylinderRadius);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  };

  const segX = 28;
  const segY = 18;
  const plaqueShellGeo = tracker.geo(
    createCurvedRoundedShellGeometry(
      cylinderRadius,
      arcLength,
      height,
      cornerRadius,
      thickness + bevel * 1.4,
      segX,
      segY,
    ),
  );

  const plaqueMat = tracker.mat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0b0b0e,
      roughness: 0.54,
      metalness: 0.08,
      clearcoat: 0.16,
      clearcoatRoughness: 0.38,
      envMapIntensity: 1.15,
    }),
  );

  const plaqueMesh = new THREE.Mesh(plaqueShellGeo, plaqueMat);
  plaqueMesh.renderOrder = 5;
  group.add(plaqueMesh);

  // Curved front typography patch sitting right on the outer face of the curved plaque
  const textGeo = tracker.geo(new THREE.PlaneGeometry(arcLength, height, 36, 8));
  bendGeometryOntoCylinder(textGeo, cylinderRadius + thickness + bevel * 1.4 + 0.48 * S);

  const textMat = tracker.mat(
    new THREE.MeshBasicMaterial({
      map: labelTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  const textMesh = new THREE.Mesh(textGeo, textMat);
  textMesh.renderOrder = 6;
  group.add(textMesh);

  return { group, plaqueMesh };
}

/**
 * Generates a closed, smooth 3D curved rounded-rectangle shell bent around a cylinder of radius `cylR`.
 * Local origin sits at `(0, 0, cylR)` on the cylinder's +Z front surface.
 */
function createCurvedRoundedShellGeometry(
  cylR: number,
  width: number,
  height: number,
  cornerR: number,
  thickness: number,
  radialSteps: number,
  ringSteps: number,
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const cr = Math.min(cornerR, hw * 0.45, hh * 0.45);

  // Sample perimeter of rounded rectangle evenly in 2D
  const perimCount = radialSteps * 2;
  const perimX = new Float32Array(perimCount);
  const perimY = new Float32Array(perimCount);

  for (let i = 0; i < perimCount; i++) {
    const a = (i / perimCount) * Math.PI * 2;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    // Superellipse / exact rounded-rect boundary projection
    const innerW = hw - cr;
    const innerH = hh - cr;

    // March ray from origin to rounded-rect boundary
    const tx = Math.abs(cosA) > 1e-5 ? hw / Math.abs(cosA) : 1e9;
    const ty = Math.abs(sinA) > 1e-5 ? hh / Math.abs(sinA) : 1e9;
    let px = cosA * Math.min(tx, ty);
    let py = sinA * Math.min(tx, ty);

    // Clamp into corner arcs
    const cx = Math.sign(px) * innerW;
    const cy = Math.sign(py) * innerH;
    if (Math.abs(px) > innerW && Math.abs(py) > innerH) {
      const dx = px - cx;
      const dy = py - cy;
      const len = Math.hypot(dx, dy) || 1;
      px = cx + (dx / len) * cr;
      py = cy + (dy / len) * cr;
    }

    perimX[i] = px;
    perimY[i] = py;
  }

  // Rings: center(0) -> inner Rings -> beveled rim -> back perimeter -> back center
  // Total rings = ringSteps (front radial) + 3 (bevel/side) + 1 (back perimeter)
  const frontRings = Math.max(4, ringSteps);
  const totalRings = frontRings + 3;
  const vertCount = 2 + totalRings * perimCount;

  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  const writeVert = (idx: number, x2d: number, y2d: number, zOff: number) => {
    const r = cylR + zOff;
    const theta = x2d / cylR;
    positions[idx * 3] = r * Math.sin(theta);
    positions[idx * 3 + 1] = y2d;
    positions[idx * 3 + 2] = r * Math.cos(theta) - cylR;
    uvs[idx * 2] = x2d / width + 0.5;
    uvs[idx * 2 + 1] = y2d / height + 0.5;
  };

  // 0: Front center
  writeVert(0, 0, 0, thickness);

  // Front face radial rings
  for (let r = 0; r < frontRings; r++) {
    const frac = ((r + 1) / frontRings) * 0.965;
    const base = 1 + r * perimCount;
    for (let s = 0; s < perimCount; s++) {
      writeVert(base + s, perimX[s] * frac, perimY[s] * frac, thickness);
    }
  }

  // Bevel ring 1 (45° edge)
  {
    const base = 1 + frontRings * perimCount;
    for (let s = 0; s < perimCount; s++) {
      writeVert(base + s, perimX[s] * 0.99, perimY[s] * 0.99, thickness * 0.72);
    }
  }

  // Side wall outer perimeter
  {
    const base = 1 + (frontRings + 1) * perimCount;
    for (let s = 0; s < perimCount; s++) {
      writeVert(base + s, perimX[s], perimY[s], thickness * 0.12);
    }
  }

  // Back rim resting against glass
  {
    const base = 1 + (frontRings + 2) * perimCount;
    for (let s = 0; s < perimCount; s++) {
      writeVert(base + s, perimX[s] * 0.96, perimY[s] * 0.96, 0);
    }
  }

  // Last vertex: Back center
  const backCenterIdx = 1 + totalRings * perimCount;
  writeVert(backCenterIdx, 0, 0, 0);

  const triCount = perimCount + (totalRings - 1) * perimCount * 2 + perimCount;
  const indices = new Uint32Array(triCount * 3);
  let ptr = 0;

  for (let s = 0; s < perimCount; s++) {
    const sNext = (s + 1) % perimCount;
    indices[ptr++] = 0;
    indices[ptr++] = 1 + s;
    indices[ptr++] = 1 + sNext;
  }

  for (let r = 0; r < totalRings - 1; r++) {
    const rA = 1 + r * perimCount;
    const rB = 1 + (r + 1) * perimCount;
    for (let s = 0; s < perimCount; s++) {
      const sNext = (s + 1) % perimCount;
      const a = rA + s;
      const b = rA + sNext;
      const c = rB + s;
      const d = rB + sNext;
      indices[ptr++] = a;
      indices[ptr++] = c;
      indices[ptr++] = d;
      indices[ptr++] = a;
      indices[ptr++] = d;
      indices[ptr++] = b;
    }
  }

  const lastRing = 1 + (totalRings - 1) * perimCount;
  for (let s = 0; s < perimCount; s++) {
    const sNext = (s + 1) % perimCount;
    indices[ptr++] = lastRing + sNext;
    indices[ptr++] = lastRing + s;
    indices[ptr++] = backCenterIdx;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Attaches live meniscus slosh & internal subsurface radiance shader to a perfume liquid material.
 */
function attachLiquidEssenceShader(
  mat: THREE.MeshPhysicalMaterial,
  glowHex: number,
  glowIntensity: number,
  minY: number,
  maxY: number,
  sharedUniforms: BespokeBottleSharedUniforms,
): void {
  const glowColor = new THREE.Color(glowHex);

  mat.customProgramCacheKey = () => 'norva-liquid-essence-v1';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uTiltVel = sharedUniforms.uTiltVel;
    shader.uniforms.uLiquidGlow = { value: glowColor };
    shader.uniforms.uGlowIntensity = { value: glowIntensity };
    shader.uniforms.uMinY = { value: minY };
    shader.uniforms.uMaxY = { value: maxY };

    shader.vertexShader =
      `
      uniform float uTime;
      uniform vec2 uTiltVel;
      uniform float uMinY;
      uniform float uMaxY;
      varying vec3 vLiqLocal;
      ` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float hFrac = clamp((transformed.y - uMinY) / max(1.0, uMaxY - uMinY), 0.0, 1.0);
        float topMask = smoothstep(0.68, 1.0, hFrac);
        float slosh = sin(transformed.x * 0.032 + uTime * 2.0) * 2.2
                    + cos(transformed.z * 0.038 - uTime * 1.65) * 1.8
                    + (transformed.x * uTiltVel.x + transformed.z * uTiltVel.y) * 0.10;
        transformed.y += slosh * topMask;
        vLiqLocal = transformed;
        `,
      );

    shader.fragmentShader =
      `
      uniform float uTime;
      uniform vec3 uLiquidGlow;
      uniform float uGlowIntensity;
      uniform float uMinY;
      uniform float uMaxY;
      varying vec3 vLiqLocal;
      ` +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `
        #include <emissivemap_fragment>
        float radialFade = exp(-0.000055 * (vLiqLocal.x * vLiqLocal.x + vLiqLocal.z * vLiqLocal.z));
        float pulse = 0.88 + 0.12 * sin(vLiqLocal.y * 0.015 - uTime * 1.2);
        totalEmissiveRadiance += uLiquidGlow * (uGlowIntensity * (0.45 + 0.55 * radialFade) * pulse);
        `,
      );
  };
}

/**
 * Attaches subtle optical Fresnel edge catchlight & cursor proximity shimmer to outer crystal/glass shells.
 */
function attachOpticalRimShader(
  mat: THREE.MeshPhysicalMaterial,
  rimHex: number,
  rimStrength: number,
  sharedUniforms: BespokeBottleSharedUniforms,
): void {
  const rimColor = new THREE.Color(rimHex);

  mat.customProgramCacheKey = () => 'norva-optical-rim-v1';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCursorWorld = sharedUniforms.uCursorWorld;
    shader.uniforms.uCursorStrength = sharedUniforms.uCursorStrength;
    shader.uniforms.uLayoutScale = sharedUniforms.uLayoutScale;
    shader.uniforms.uRimColor = { value: rimColor };
    shader.uniforms.uRimStrength = { value: rimStrength };

    shader.vertexShader =
      `
      varying vec3 vGlassWorldPos;
      varying vec3 vGlassWorldNormal;
      ` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vec4 gWorld = modelMatrix * vec4(transformed, 1.0);
        vGlassWorldPos = gWorld.xyz;
        vGlassWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
        `,
      );

    shader.fragmentShader =
      `
      uniform vec3 uCursorWorld;
      uniform float uCursorStrength;
      uniform float uLayoutScale;
      uniform vec3 uRimColor;
      uniform float uRimStrength;
      varying vec3 vGlassWorldPos;
      varying vec3 vGlassWorldNormal;
      ` +
      shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `
        #include <emissivemap_fragment>
        vec3 gN = normalize(vGlassWorldNormal);
        vec3 gV = normalize(cameraPosition - vGlassWorldPos);
        float fresnel = pow(1.0 - clamp(dot(gN, gV), 0.0, 1.0), 3.1);
        totalEmissiveRadiance += uRimColor * (fresnel * uRimStrength);

        float cDist = distance(vGlassWorldPos, uCursorWorld);
        float cRadius = max(45.0, 260.0 * uLayoutScale);
        float cGlow = exp(-1.8 * (cDist / cRadius) * (cDist / cRadius));
        totalEmissiveRadiance += uRimColor * (0.14 * cGlow * uCursorStrength);
        `,
      );
  };
}

/**
 * Builds the internal stepped metallic atomizer sprayer, neck collar ring, and curved dip-tube.
 */
function createAtomizerAndTubeAssembly(
  neckY: number,
  bottomPuntY: number,
  collarRadius: number,
  collarHeight: number,
  sprayerRadius: number,
  sprayerHeight: number,
  dipOffsetX: number,
  metalColorHex: number,
  scale: number,
  brushedTex: THREE.Texture,
  tracker: DisposableTracker,
): {
  hardwareGroup: THREE.Group;
  dipTubeMesh: THREE.Mesh;
  atomizerMeshes: THREE.Mesh[];
} {
  const S = scale;
  const hardwareGroup = new THREE.Group();
  const atomizerMeshes: THREE.Mesh[] = [];

  const metalMat = tracker.mat(
    new THREE.MeshPhysicalMaterial({
      color: metalColorHex,
      metalness: 0.95,
      roughness: 0.16,
      roughnessMap: brushedTex,
      anisotropy: 0.65,
      clearcoat: 0.55,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.9,
    }),
  );

  // Lathe profile for collar ring + stepped spray nozzle
  const pts = [
    new THREE.Vector2(0.001, neckY - 8 * S),
    new THREE.Vector2(collarRadius * 0.88, neckY - 8 * S),
    new THREE.Vector2(collarRadius, neckY),
    new THREE.Vector2(collarRadius, neckY + collarHeight),
    new THREE.Vector2(collarRadius * 0.92, neckY + collarHeight + 2 * S),
    new THREE.Vector2(sprayerRadius * 1.08, neckY + collarHeight + 3 * S),
    new THREE.Vector2(sprayerRadius * 1.08, neckY + collarHeight + sprayerHeight * 0.35),
    new THREE.Vector2(sprayerRadius, neckY + collarHeight + sprayerHeight * 0.38),
    new THREE.Vector2(sprayerRadius, neckY + collarHeight + sprayerHeight),
    new THREE.Vector2(sprayerRadius * 0.88, neckY + collarHeight + sprayerHeight + 3 * S),
    new THREE.Vector2(0.001, neckY + collarHeight + sprayerHeight + 3 * S),
  ];

  const sprayerGeo = tracker.geo(new THREE.LatheGeometry(pts, 48));
  sprayerGeo.computeVertexNormals();
  const sprayerMesh = new THREE.Mesh(sprayerGeo, metalMat);
  sprayerMesh.renderOrder = 5;
  hardwareGroup.add(sprayerMesh);
  atomizerMeshes.push(sprayerMesh);

  // Contrasting micro spray aperture dot on +Z of sprayer
  const dotMat = tracker.mat(
    new THREE.MeshStandardMaterial({
      color: 0x0d0d10,
      roughness: 0.35,
      metalness: 0.3,
    }),
  );
  const dotGeo = tracker.geo(new THREE.CylinderGeometry(3.2 * S, 3.2 * S, 2.4 * S, 16));
  dotGeo.rotateX(Math.PI / 2);
  const dotMesh = new THREE.Mesh(dotGeo, dotMat);
  dotMesh.position.set(
    0,
    neckY + collarHeight + sprayerHeight * 0.72,
    sprayerRadius + 0.4 * S,
  );
  dotMesh.renderOrder = 5;
  hardwareGroup.add(dotMesh);
  atomizerMeshes.push(dotMesh);

  // Slender curved optical silica dip-tube reaching into the bottom corner of the chamber
  const tubeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, neckY - 4 * S, 0),
    new THREE.Vector3(dipOffsetX * 0.16, (neckY + bottomPuntY) * 0.58, 1 * S),
    new THREE.Vector3(dipOffsetX * 0.55, (neckY + bottomPuntY) * 0.25, 2 * S),
    new THREE.Vector3(dipOffsetX, bottomPuntY + 6 * S, 3 * S),
  ]);
  const dipGeo = tracker.geo(new THREE.TubeGeometry(tubeCurve, 28, 3.2 * S, 12, false));
  const dipMat = tracker.mat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe6e4dc,
      roughness: 0.08,
      metalness: 0.05,
      transparent: true,
      opacity: 0.42,
      clearcoat: 1.0,
      envMapIntensity: 1.4,
    }),
  );
  const dipTubeMesh = new THREE.Mesh(dipGeo, dipMat);
  dipTubeMesh.renderOrder = 1;

  return { hardwareGroup, dipTubeMesh, atomizerMeshes };
}

/**
 * Helper to create a cylindrical cap with an authentic hollowed underside recess when lifted in Exploded View.
 */
function createHollowCylindricalCapGeometry(
  outerRadius: number,
  height: number,
  topBevel: number,
  scale: number,
  segments = 48,
): THREE.BufferGeometry {
  const S = scale;
  const halfH = height * 0.5;
  const innerR = outerRadius * 0.76;
  const cavityDepth = height * 0.52;
  const b = Math.min(topBevel, outerRadius * 0.12);

  const pts = [
    new THREE.Vector2(0.001, -halfH + cavityDepth),
    new THREE.Vector2(innerR, -halfH + cavityDepth),
    new THREE.Vector2(innerR, -halfH + 1.5 * S),
    new THREE.Vector2(innerR + 2 * S, -halfH),
    new THREE.Vector2(outerRadius - 1.5 * S, -halfH),
    new THREE.Vector2(outerRadius, -halfH + 1.5 * S),
    new THREE.Vector2(outerRadius, halfH - b),
    new THREE.Vector2(outerRadius - b * 0.45, halfH - b * 0.25),
    new THREE.Vector2(outerRadius - b, halfH),
    new THREE.Vector2(0.001, halfH),
  ];

  const geo = new THREE.LatheGeometry(pts, segments);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the 4-tiered grooved glossy black cylindrical cap exclusive to Khamrah Qawa!
 * Matches the 4 glossy black bands & 3 horizontal recessed grooves in khamrah_qawa_bottle.jpg.
 */
function createKhamrahRibbedCapGeometry(
  outerRadius: number,
  height: number,
  scale: number,
): THREE.BufferGeometry {
  const S = scale;
  const halfH = height * 0.5;
  const innerR = outerRadius * 0.74;
  const grooveR = outerRadius * 0.875;

  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.001, -halfH + height * 0.48),
    new THREE.Vector2(innerR, -halfH + height * 0.48),
    new THREE.Vector2(innerR, -halfH),
    new THREE.Vector2(outerRadius - 2 * S, -halfH),
  ];

  // 4 stacked glossy black tiers separated by 3 sharp horizontal grooves
  const tierCount = 4;
  const grooveHeight = 5.6 * S;
  const availableTierH = height - grooveHeight * (tierCount - 1);
  const singleTierH = availableTierH / tierCount;
  const lipBevel = 2.0 * S;

  let cursorY = -halfH;
  for (let t = 0; t < tierCount; t++) {
    const tBottom = cursorY;
    const tTop = cursorY + singleTierH;

    pts.push(new THREE.Vector2(outerRadius, tBottom + lipBevel));
    pts.push(new THREE.Vector2(outerRadius, tTop - lipBevel));

    if (t < tierCount - 1) {
      // Step inward into horizontal groove
      pts.push(new THREE.Vector2(grooveR, tTop));
      pts.push(new THREE.Vector2(grooveR, tTop + grooveHeight));
      cursorY = tTop + grooveHeight;
    } else {
      // Top crown bevel
      pts.push(new THREE.Vector2(outerRadius - 3.5 * S, halfH));
      pts.push(new THREE.Vector2(0.001, halfH));
    }
  }

  const geo = new THREE.LatheGeometry(pts, 52);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Main factory: constructs the exact 3D perfume bottle matching its 2D studio photograph.
 */
export function buildBespokeBottleAssembly(
  opts: BespokeBottleBuildOptions,
): BespokeBottleAssembly {
  const {
    archetype,
    scale: S,
    label,
    maxAnisotropy,
    isSoftwareGl,
    sharedUniforms,
  } = opts;

  const tracker = createDisposableTracker();
  const rootGroup = new THREE.Group();
  const parts: BottleInspectablePart[] = [];
  const raycastTargets: THREE.Mesh[] = [];

  const registerPart = (
    id: string,
    group: THREE.Group,
    restPos: THREE.Vector3,
    explodeOffset: THREE.Vector3,
    explodeRot: THREE.Euler,
    hoverOffset: THREE.Vector3,
    meshes: THREE.Mesh[],
  ) => {
    group.position.copy(restPos);
    rootGroup.add(group);
    const part: BottleInspectablePart = {
      id,
      group,
      restPos: restPos.clone(),
      explodeOffset,
      explodeRot,
      hoverOffset,
      raycastMeshes: meshes,
      liftSpring: { value: 0, velocity: 0 },
      tipXSpring: { value: 0, velocity: 0 },
      tipYSpring: { value: 0, velocity: 0 },
    };
    for (const m of meshes) {
      m.userData.inspectPart = part;
      raycastTargets.push(m);
    }
    parts.push(part);
  };

  const brushedTex = tracker.tex(createBrushedMetalTexture());
  const rearLabelTex = tracker.tex(createRearBottleLabelTexture(maxAnisotropy, label.volume));

  // =========================================================================
  // 01 — KHAMRAH QAWA ('amber')
  // Round Frosted Cognac-Amber Cylinder + Rounded Shoulder + Silver Ring + 4-Ribbed Glossy Black Cap
  // =========================================================================
  if (archetype === 'amber') {
    const plaqueVariant: PlaqueStyleVariant = 'khamrah-square';
    const labelCanvasTex = tracker.tex(
      createPlaqueTypographyTexture(maxAnisotropy, label, plaqueVariant),
    );
    const frostedTex = tracker.tex(createFrostedSilicaTexture());

    const bottomY = -286 * S;
    const shoulderStartY = 26 * S;
    const neckBaseY = 104 * S;
    const outerR = 132 * S;
    const neckR = 76 * S;

    // 1. Vessel Group (Outer Frosted Amber Cylinder + Inner Cavity + Warm Cognac Liquid + Dip Tube)
    const vesselGroup = new THREE.Group();

    // Smooth cylindrical profile with rounded base corner & circular dome shoulder
    const vesselPts: THREE.Vector2[] = [
      new THREE.Vector2(0.001, bottomY + 6 * S),
      new THREE.Vector2(outerR * 0.72, bottomY + 6 * S),
      new THREE.Vector2(outerR - 14 * S, bottomY),
    ];

    // Rounded bottom corner
    for (let i = 0; i <= 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
      vesselPts.push(
        new THREE.Vector2(
          outerR - 14 * S + Math.cos(a) * 14 * S,
          bottomY + 14 * S + Math.sin(a) * 14 * S,
        ),
      );
    }

    vesselPts.push(new THREE.Vector2(outerR, shoulderStartY));

    // Smooth rounded quarter-dome shoulder from outerR (132*S) to neckR (76*S)
    const shoulderSpanR = outerR - neckR;
    const shoulderSpanY = neckBaseY - shoulderStartY;
    for (let i = 1; i <= 18; i++) {
      const a = (i / 18) * (Math.PI * 0.5);
      const r = neckR + Math.cos(a) * shoulderSpanR;
      const y = shoulderStartY + Math.sin(a) * shoulderSpanY;
      vesselPts.push(new THREE.Vector2(r, y));
    }

    vesselPts.push(new THREE.Vector2(neckR, neckBaseY + 6 * S));
    vesselPts.push(new THREE.Vector2(neckR * 0.82, neckBaseY + 6 * S));

    const outerGeo = tracker.geo(new THREE.LatheGeometry(vesselPts, 52));
    outerGeo.computeVertexNormals();

    const frostedAmberMat = tracker.mat(
      new THREE.MeshPhysicalMaterial({
        color: 0xd98026,
        roughness: 0.42,
        roughnessMap: frostedTex,
        bumpMap: frostedTex,
        bumpScale: 0.45 * S,
        metalness: 0.02,
        clearcoat: 0.16,
        clearcoatRoughness: 0.36,
        ior: 1.51,
        transmission: isSoftwareGl ? 0 : 0.74,
        transparent: isSoftwareGl,
        opacity: isSoftwareGl ? 0.58 : 1.0,
        depthWrite: !isSoftwareGl,
        thickness: 38 * S,
        attenuationColor: new THREE.Color(0x6e2b05),
        attenuationDistance: 46 * S,
        envMapIntensity: 1.35,
      }),
    );
    attachOpticalRimShader(frostedAmberMat, 0xf5a94c, 0.22, sharedUniforms);

    const outerMesh = new THREE.Mesh(outerGeo, frostedAmberMat);
    outerMesh.renderOrder = 4;
    vesselGroup.add(outerMesh);

    // Inner hollow cavity wall (BackSide) showing thick 38*S frosted punt at bottom
    const puntTopY = bottomY + 38 * S;
    const innerR = outerR - 16 * S;
    const cavityPts = [
      new THREE.Vector2(0.001, puntTopY),
      new THREE.Vector2(innerR - 10 * S, puntTopY),
      new THREE.Vector2(innerR, puntTopY + 10 * S),
      new THREE.Vector2(innerR, shoulderStartY + 4 * S),
      new THREE.Vector2(neckR * 0.85, neckBaseY - 4 * S),
      new THREE.Vector2(0.001, neckBaseY - 4 * S),
    ];
    const cavityGeo = tracker.geo(new THREE.LatheGeometry(cavityPts, 48));
    cavityGeo.computeVertexNormals();
    const cavityMat = tracker.mat(
      new THREE.MeshPhysicalMaterial({
        color: 0x9c490c,
        roughness: 0.32,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    );
    const cavityMesh = new THREE.Mesh(cavityGeo, cavityMat);
    cavityMesh.renderOrder = 3;
    vesselGroup.add(cavityMesh);

    // Glowing Roasted-Cognac Amber Liquid Core inside chamber
    const liqMinY = puntTopY + 2 * S;
    const liqMaxY = shoulderStartY + 32 * S;
    const liqPts = [
      new THREE.Vector2(0.001, liqMinY),
      new THREE.Vector2(innerR - 10 * S, liqMinY),
      new THREE.Vector2(innerR - 2 * S, liqMinY + 10 * S),
      new THREE.Vector2(innerR - 2 * S, shoulderStartY),
      new THREE.Vector2(innerR * 0.88, liqMaxY),
      new THREE.Vector2(0.001, liqMaxY),
    ];
    const liqGeo = tracker.geo(new THREE.LatheGeometry(liqPts, 52));
    liqGeo.computeVertexNormals();

    const liqMat = tracker.mat(
      new THREE.MeshPhysicalMaterial({
        color: 0xa64808,
        roughness: 0.14,
        metalness: 0.04,
        clearcoat: 0.9,
        envMapIntensity: 1.4,
      }),
    );
    attachLiquidEssenceShader(liqMat, 0xf59d30, 0.58, liqMinY, liqMaxY, sharedUniforms);
    const liqMesh = new THREE.Mesh(liqGeo, liqMat);
    liqMesh.renderOrder = 2;
    vesselGroup.add(liqMesh);

    // Rear discreet house engraving curved on back of cylinder
    const rearGeo = tracker.geo(new THREE.PlaneGeometry(140 * S, 140 * S, 16, 4));
    const rPos = rearGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < rPos.count; i++) {
      const x = rPos.getX(i);
      const y = rPos.getY(i);
      const th = Math.PI - x / (outerR + 0.6 * S);
      rPos.setXYZ(i, (outerR + 0.6 * S) * Math.sin(th), y - 130 * S, (outerR + 0.6 * S) * Math.cos(th));
    }
    rPos.needsUpdate = true;
    rearGeo.computeVertexNormals();
    const rearMat = tracker.mat(
      new THREE.MeshBasicMaterial({
        map: rearLabelTex,
        transparent: true,
        depthWrite: false,
      }),
    );
    const rearMesh = new THREE.Mesh(rearGeo, rearMat);
    rearMesh.renderOrder = 6;
    vesselGroup.add(rearMesh);

    // Atomizer + Silver Neck Ring + Dip Tube
    const { hardwareGroup, dipTubeMesh, atomizerMeshes } = createAtomizerAndTubeAssembly(
      neckBaseY,
      puntTopY,
      80 * S, // Bright silver collar matching 2D photo
      9 * S,
      40 * S,
      54 * S,
      36 * S,
      0xe4e7ed, // Polished chrome silver
      S,
      brushedTex,
      tracker,
    );
    vesselGroup.add(dipTubeMesh);

    registerPart(
      'Frosted Amber Flacon',
      vesselGroup,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -18 * S, 0),
      new THREE.Euler(0, 0, 0),
      new THREE.Vector3(0, 0, 6 * S),
      [outerMesh],
    );

    registerPart(
      'Silver Atomizer & Collar',
      hardwareGroup,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 38 * S, 0),
      new THREE.Euler(0, 0, 0),
      new THREE.Vector3(0, 8 * S, 0),
      atomizerMeshes,
    );

    // 2. Curved 3D Matte-Black Rounded-Square Front Plaque ('KHAMRAH Qawa')
    const { group: plaqueGroup, plaqueMesh } = createCurvedCylinderPlaqueGroup(
      outerR + 0.35 * S,
      208 * S,
      198 * S,
      28 * S,
      S,
      labelCanvasTex,
      tracker,
    );
    registerPart(
      'Signature Matte Plaque',
      plaqueGroup,
      new THREE.Vector3(0, -96 * S, outerR + 0.35 * S),
      new THREE.Vector3(0, -8 * S, 82 * S),
      new THREE.Euler(-0.04, 0, 0),
      new THREE.Vector3(0, 0, 14 * S),
      [plaqueMesh],
    );

    // 3. Iconic 4-Ribbed Glossy Black Cylindrical Cap
    const capHeight = 178 * S;
    const capRestY = neckBaseY + 9 * S + capHeight * 0.5;
    const capGeo = tracker.geo(createKhamrahRibbedCapGeometry(86 * S, capHeight, S));
    const capMat = tracker.mat(
      new THREE.MeshPhysicalMaterial({
        color: 0x060608,
        roughness: 0.06,
        metalness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        specularIntensity: 1.0,
        envMapIntensity: 2.1,
      }),
    );
    const capMesh = new THREE.Mesh(capGeo, capMat);
    capMesh.renderOrder = 5;
    const capGroup = new THREE.Group();
    capGroup.add(capMesh);

    registerPart(
      'Ribbed Noir Stopper',
      capGroup,
      new THREE.Vector3(0, capRestY, 0),
      new THREE.Vector3(0, 118 * S, 0),
      new THREE.Euler(0.10, 0.22, -0.04),
      new THREE.Vector3(0, 18 * S, 0),
      [capMesh],
    );

    return {
      rootGroup,
      parts,
      raycastTargets,
      labelCanvasTex,
      plaqueVariant,
      footprintRadius: outerR,
      bottomY,
      topY: capRestY + capHeight * 0.5,
      dispose: () => tracker.disposeAll(),
    };
  }

  // =========================================================================
  // 02 — COOL WATER ('cobalt' / 'emerald')
  // Frosted Cobalt-to-Seafoam Ombré Rectangular Flacon + Pebbled Matte-Black Cap
  // =========================================================================
  if (archetype === 'cobalt' || archetype === 'emerald') {
    const plaqueVariant: PlaqueStyleVariant = 'coolwater-square';
    const labelCanvasTex = tracker.tex(
      createPlaqueTypographyTexture(maxAnisotropy, label, plaqueVariant),
    );
    const frostedTex = tracker.tex(createFrostedSilicaTexture());
    const pebbledCapTex = tracker.tex(createPebbledCapTexture());

    const bodyW = 282 * S;
    const bodyH = 406 * S;
    const bodyD = 116 * S;
    const bottomY = -286 * S;
    const topY = bottomY + bodyH; // +120 * S
    const bodyCenterY = (bottomY + topY) * 0.5;

    const vesselGroup = new THREE.Group();

    // Frosted rectangular outer block with cobalt -> ocean-teal -> seafoam-mint vertical gradient
    const outerGeo = tracker.geo(
      createVerticalRoundedBoxGeometry(bodyW, bodyH, bodyD, 15 * S, 8 * S, 3, 8),
    );
    outerGeo.translate(0, bodyCenterY, 0);
    applyVerticalVertexGradient(outerGeo, [
      { t: 0.0, hex: 0x90ccb8 },  // Pale frosted seafoam-mint punt
      { t: 0.28, hex: 0x56ab9f }, // Glacial seafoam-aqua
      { t: 0.62, hex: 0x1b7ea8 }, // Deep marine turquoise
      { t: 1.0, hex: 0x0c66b5 },  // Rich ocean cobalt blue shoulder
    ]);

    const frostedCobaltMat = tracker.mat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.39,
        roughnessMap: frostedTex,
        bumpMap: frostedTex,
        bumpScale: 0.42 * S,
        metalness: 0.02,
        clearcoat: 0.18,
        clearcoatRoughness: 0.34,
        ior: 1.50,
        transmission: isSoftwareGl ? 0 : 0.68,
        transparent: isSoftwareGl,
        opacity: isSoftwareGl ? 0.64 : 1.0,
        depthWrite: !isSoftwareGl,
        thickness: 34 * S,
        attenuationColor: new THREE.Color(0x1c799e),
        attenuationDistance: 54 * S,
        envMapIntensity: 1.4,
      }),
    );
    attachOpticalRimShader(frostedCobaltMat, 0x8ad8f0, 0.20, sharedUniforms);

    const outerMesh = new THREE.Mesh(outerGeo, frostedCobaltMat);
    outerMesh.renderOrder = 4;
    vesselGroup.add(outerMesh);

    // Inner hollow cavity wall (BackSide) creating visible 20*S side walls & 36*S seafoam base punt
    const wallT = 20 * S;
    const puntH = 36 * S;
    const cavW = bodyW - wallT * 2;
    const cavD = bodyD - wallT * 1.6;
    const cavMinY = bottomY + puntH;
    const cavMaxY = topY - 18 * S;
    const cavH = cavMaxY - cavMinY;

    const cavGeo = tracker.geo(
      createVerticalRoundedBoxGeometry(cavW, cavH, cavD, 12 * S, 6 * S, 3, 2),
    );
    cavGeo.translate(0, (cavMinY + cavMaxY) * 0.5, 0);
    const cavMat = tracker.mat(
      new THREE.MeshPhysicalMaterial({
        color: 0x2c8ba0,
        roughness: 0.3,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.30,
        depthWrite: false,
      }),
    );
    const cavMesh = new THREE.Mesh(cavGeo, cavMat);
    cavMesh.renderOrder = 3;
    vesselGroup.add(cavMesh);

    // Inner Aquatic Essence Core
    const liqMinY = cavMinY + 2 * S;
    const liqMaxY = cavMaxY - 14 * S;
    const liqH = liqMaxY - liqMinY;
    const liqGeo = tracker.geo(
      createVerticalRoundedBoxGeometry(cavW - 4 * S, liqH, cavD - 4 * S, 10 * S, 5 * S, 3, 6),
    );
    liqGeo.translate(0, (liqMinY + liqMaxY) * 0.5, 0);
    applyVerticalVertexGradient(liqGeo, [
      { t: 0.0, hex: 0x74baa8 },
      { t: 0.5, hex: 0x227ea3 },
      { t: 1.0, hex: 0x0e5ca8 },
    ]);

    const liqMat = tracker.mat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.14,
        metalness: 0.04,
        clearcoat: 0.9,
        envMapIntensity: 1.4,
      }),
    );
    attachLiquidEssenceShader(liqMat, 0x4cc4e0, 0.38, liqMinY, liqMaxY, sharedUniforms);
    const liqMesh = new THREE.Mesh(liqGeo, liqMat);
    liqMesh.renderOrder = 2;
    vesselGroup.add(liqMesh);

    // Rear engraving plane
    const rearGeo = tracker.geo(new THREE.PlaneGeometry(150 * S, 150 * S));
    rearGeo.rotateY(Math.PI);
    rearGeo.translate(0, bottomY + 95 * S, -bodyD * 0.5 - 0.5 * S);
    const rearMat = tracker.mat(
      new THREE.MeshBasicMaterial({ map: rearLabelTex, transparent: true, depthWrite: false }),
    );
    const rearMesh = new THREE.Mesh(rearGeo, rearMat);
    rearMesh.renderOrder = 6;
    vesselGroup.add(rearMesh);

    const { hardwareGroup, dipTubeMesh, atomizerMeshes } = createAtomizerAndTubeAssembly(
      topY,
      cavMinY,
      50 * S,
      4 * S,
      34 * S,
      52 * S,
      56 * S,
      0x252830,
      S,
      brushedTex,
      tracker,
    );
    vesselGroup.add(dipTubeMesh);

    registerPart(
      'Frosted Sea-Glass Flacon',
      vesselGroup,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -18 * S, 0),
      new THREE.Euler(0, 0, 0),
      new THREE.Vector3(0, 0, 6 * S),
      [outerMesh],
    );

    registerPart(
      'Atomizer Nozzle',
      hardwareGroup,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 40 * S, 0),
      new THREE.Euler(0, 0, 0),
      new THREE.Vector3(0, 8 * S, 0),
      atomizerMeshes,
    );

    // Rounded-Square Matte-Black Plaque ('COOL Water')
    const { group: plaqueGroup, plaqueMesh } = createFlatPlaqueGroup(
      174 * S,
      158 * S,
      26 * S,
      S,
      labelCanvasTex,
      tracker,
    );
    registerPart(
      'Signature Matte Plaque',
      plaqueGroup,
      new THREE.Vector3(0, -68 * S, bodyD * 0.5 + 1.2 * S),
      new THREE.Vector3(0, -8 * S, 80 * S),
      new THREE.Euler(-0.04, 0, 0),
      new THREE.Vector3(0, 0, 14 * S),
      [plaqueMesh],
    );

    // Tall Pebbled Matte-Black Cylindrical Cap
    const capH = 172 * S;
    const capRestY = topY + capH * 0.5;
    const capGeo = tracker.geo(createHollowCylindricalCapGeometry(57 * S, capH, 3.2 * S, S, 64));
    const capMat = tracker.mat(
      new THREE.MeshPhysicalMaterial({
        color: 0x111216,
        roughness: 0.58,
        roughnessMap: pebbledCapTex,
        bumpMap: pebbledCapTex,
        bumpScale: 1.9 * S,
        metalness: 0.06,
        clearcoat: 0.14,
        clearcoatRoughness: 0.48,
        envMapIntensity: 1.35,
      }),
    );
    const capMesh = new THREE.Mesh(capGeo, capMat);
    capMesh.renderOrder = 5;
    const capGroup = new THREE.Group();
    capGroup.add(capMesh);

    registerPart(
      'Pebbled Matte Cap',
      capGroup,
      new THREE.Vector3(0, capRestY, 0),
      new THREE.Vector3(0, 114 * S, 0),
      new THREE.Euler(0.10, -0.18, 0.03),
      new THREE.Vector3(0, 18 * S, 0),
      [capMesh],
    );

    return {
      rootGroup,
      parts,
      raycastTargets,
      labelCanvasTex,
      plaqueVariant,
      footprintRadius: bodyW * 0.52,
      bottomY,
      topY: capRestY + capH * 0.5,
      dispose: () => tracker.disposeAll(),
    };
  }

  // =========================================================================
  // 03 — 9mM REBEL ('noir')
  // Two-Tone Rectangular Monolith: Upper Matte-Black Sleeve + Lower Smoked-Obsidian Glass + Glossy Black Cap
  // =========================================================================
  if (archetype === 'noir') {
    const plaqueVariant: PlaqueStyleVariant = 'wide-rect';
    const labelCanvasTex = tracker.tex(
      createPlaqueTypographyTexture(maxAnisotropy, label, plaqueVariant),
    );

    const bodyW = 282 * S;
    const bodyD = 112 * S;
    const bottomY = -286 * S;
    const splitY = -100 * S; // Iconic horizontal seam ~45% up from base
    const topY = 128 * S;

    const lowerH = splitY - bottomY; // 186 * S
    const upperH = topY - splitY;    // 228 * S

    // 1. Lower Smoked-Obsidian Crystal Glass Base
    const lowerGroup = new THREE.Group();
    const lowerGeo = tracker.geo(
      createVerticalRoundedBoxGeometry(bodyW, lowerH, bodyD, 7 * S, 3.6 * S, 3, 2),
    );
    lowerGeo.translate(0, (bottomY + splitY) * 0.5, 0);

    const smokedGlassMat = tracker.mat(
      new THREE.MeshPhysicalMaterial({
        color: 0x101116,
        roughness: 0.05,
        metalness: 0.04,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        ior: 1.54,
        transmission: isSoftwareGl ? 0 : 0.68,
        transparent: isSoftwareGl,
        opacity: isSoftwareGl ? 0.58 : 1.0,
        depthWrite: !isSoftwareGl,
        thickness: 34 * S,
        attenuationColor: new THREE.Color(0x0b0c10),
        attenuationDistance: 44 * S,
        envMapIntensity: 1.85,
      }),
    );
    attachOpticalRimShader(smokedGlassMat, 0xd0d4e2, 0.24, sharedUniforms);

    const lowerMesh = new THREE.Mesh(lowerGeo, smokedGlassMat);
    lowerMesh.renderOrder = 4;
    lowerGroup.add(lowerMesh);

    // Inner smoked glass cavity & thick dark base punt
    const wallT = 22 * S;
    const puntH = 38 * S;
    const cavMinY = bottomY + puntH;
    const cavMaxY = splitY - 2 * S;
    const cavH = cavMaxY - cavMinY;

    const cavGeo = tracker.geo(
      createVerticalRoundedBoxGeometry(bodyW - wallT * 2, cavH, bodyD - wallT * 1.6, 8 * S, 4 * S),
    );
    cavGeo.translate(0, (cavMinY + cavMaxY) * 0.5, 0);
    const cavMat = tracker.mat(
      new THREE.MeshPhysicalMaterial({
        color: 0x1f212b,
        roughness: 0.14,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    const cavMesh = new THREE.Mesh(cavGeo, cavMat);
    cavMesh.renderOrder = 3;
    lowerGroup.add(cavMesh);

    // Smoked Noir Liquid inside lower chamber
    const liqGeo = tracker.geo(
      createVerticalRoundedBoxGeometry(
        bodyW - wallT * 2 - 4 * S,
        cavH - 4 * S,
        bodyD - wallT * 1.6 - 4 * S,
        7 * S,
        3 * S,
      ),
    );
    liqGeo.translate(0, (cavMinY + cavMaxY) * 0.5, 0);
    const liqMat = tracker.mat(
      new THREE.MeshPhysicalMaterial({
        color: 0x0d0e13,
        roughness: 0.12,
        metalness: 0.08,
        clearcoat: 0.9,
        envMapIntensity: 1.5,
      }),
    );
    attachLiquidEssenceShader(liqMat, 0x7b8299, 0.28, cavMinY, cavMaxY, sharedUniforms);
    const liqMesh = new THREE.Mesh(liqGeo, liqMat);
    liqMesh.renderOrder = 2;
    lowerGroup.add(liqMesh);

    // Rear engraving on lower smoked glass
    const rearGeo = tracker.geo(new THREE.PlaneGeometry(150 * S, 120 * S));
    rearGeo.rotateY(Math.PI);
    rearGeo.translate(0, bottomY + 72 * S, -bodyD * 0.5 - 0.5 * S);
    const rearMat = tracker.mat(
      new THREE.MeshBasicMaterial({ map: rearLabelTex, transparent: true, depthWrite: false }),
    );
    const rearMesh = new THREE.Mesh(rearGeo, rearMat);
    rearMesh.renderOrder = 6;
    lowerGroup.add(rearMesh);

    // 2. Upper Matte-Black Architectural Sleeve (sits flush atop lower smoked glass)
    const upperGroup = new THREE.Group();
    const upperGeo = tracker.geo(
      createVerticalRoundedBoxGeometry(bodyW + 0.8 * S, upperH, bodyD + 0.8 * S, 7 * S, 3.8 * S, 4, 1),
    );
    upperGeo.translate(0, (splitY + topY) * 0.5, 0);

    const matteNoirMat = tracker.mat(
      new THREE.MeshPhysicalMaterial({
        color: 0x151519,
        roughness: 0.44,
        metalness: 0.10,
        clearcoat: 0.10,
        clearcoatRoughness: 0.42,
        specularIntensity: 0.85,
        envMapIntensity: 1.45,
      }),
    );
    const upperMesh = new THREE.Mesh(upperGeo, matteNoirMat);
    upperMesh.renderOrder = 5;
    upperGroup.add(upperMesh);

    const { hardwareGroup, dipTubeMesh, atomizerMeshes } = createAtomizerAndTubeAssembly(
      topY,
      cavMinY,
      50 * S,
      4 * S,
      34 * S,
      50 * S,
      58 * S,
      0x18191e,
      S,
      brushedTex,
      tracker,
    );
    lowerGroup.add(dipTubeMesh);

    registerPart(
      'Smoked Obsidian Base',
      lowerGroup,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -24 * S, 0),
      new THREE.Euler(0, 0, 0),
      new THREE.Vector3(0, -4 * S, 5 * S),
      [lowerMesh],
    );

    registerPart(
      'Matte Noir Monolith Sleeve',
      upperGroup,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 14 * S, 0),
      new THREE.Euler(0, 0, 0),
      new THREE.Vector3(0, 4 * S, 4 * S),
      [upperMesh],
    );

    registerPart(
      'Gunmetal Atomizer',
      hardwareGroup,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 56 * S, 0),
      new THREE.Euler(0, 0, 0),
      new THREE.Vector3(0, 8 * S, 0),
      atomizerMeshes,
    );

    // 3. Wide Matte-Black Rounded-Rect Plaque ('9PM Rebel') inside lower smoked glass window
    const { group: plaqueGroup, plaqueMesh } = createFlatPlaqueGroup(
      210 * S,
      110 * S,
      24 * S,
      S,
      labelCanvasTex,
      tracker,
    );
    registerPart(
      'Signature Matte Plaque',
      plaqueGroup,
      new THREE.Vector3(0, -188 * S, bodyD * 0.5 + 1.2 * S),
      new THREE.Vector3(0, -24 * S, 82 * S),
      new THREE.Euler(-0.04, 0, 0),
      new THREE.Vector3(0, 0, 14 * S),
      [plaqueMesh],
    );

    // 4. Mirror-Glossy Piano-Black Cylindrical Cap
    const capH = 166 * S;
    const capRestY = topY + capH * 0.5;
    const capGeo = tracker.geo(createHollowCylindricalCapGeometry(57 * S, capH, 4.2 * S, S, 64));
    const capMat = tracker.mat(
      new THREE.MeshPhysicalMaterial({
        color: 0x050507,
        roughness: 0.04,
        metalness: 0.14,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        specularIntensity: 1.0,
        envMapIntensity: 2.25,
      }),
    );
    const capMesh = new THREE.Mesh(capGeo, capMat);
    capMesh.renderOrder = 5;
    const capGroup = new THREE.Group();
    capGroup.add(capMesh);

    registerPart(
      'Glossy Noir Cap',
      capGroup,
      new THREE.Vector3(0, capRestY, 0),
      new THREE.Vector3(0, 126 * S, 0),
      new THREE.Euler(0.11, 0.2, -0.03),
      new THREE.Vector3(0, 18 * S, 0),
      [capMesh],
    );

    return {
      rootGroup,
      parts,
      raycastTargets,
      labelCanvasTex,
      plaqueVariant,
      footprintRadius: bodyW * 0.52,
      bottomY,
      topY: capRestY + capH * 0.5,
      dispose: () => tracker.disposeAll(),
    };
  }

  // =========================================================================
  // 04 — JADORA ('champagne') & 05 — GUCCI FLORA ('obsidian' / 'violet')
  // Heavy-Punt Polished Optical Crystal Rectangular Flacons + Metallic/Satin Cylindrical Caps
  // =========================================================================
  const isJadora = archetype === 'champagne';
  const plaqueVariant: PlaqueStyleVariant = 'wide-rect';
  const labelCanvasTex = tracker.tex(
    createPlaqueTypographyTexture(maxAnisotropy, label, plaqueVariant),
  );

  const bodyW = (isJadora ? 272 : 270) * S;
  const bodyH = (isJadora ? 412 : 408) * S;
  const bodyD = 112 * S;
  const bottomY = -286 * S;
  const topY = bottomY + bodyH;
  const bodyCenterY = (bottomY + topY) * 0.5;

  const vesselGroup = new THREE.Group();

  // Polished clear optical crystal outer flacon with crisp faceted chamfers
  const outerGeo = tracker.geo(
    createVerticalRoundedBoxGeometry(bodyW, bodyH, bodyD, 9.5 * S, 6.0 * S, 4, 2),
  );
  outerGeo.translate(0, bodyCenterY, 0);

  const crystalMat = tracker.mat(
    new THREE.MeshPhysicalMaterial({
      color: isJadora ? 0xffe4ad : 0xf2deff,
      roughness: 0.04,
      metalness: 0.02,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      ior: 1.56,
      transmission: isSoftwareGl ? 0 : 0.88,
      transparent: isSoftwareGl,
      opacity: isSoftwareGl ? 0.42 : 1.0,
      depthWrite: !isSoftwareGl,
      thickness: 36 * S,
      attenuationColor: new THREE.Color(isJadora ? 0xda8b1a : 0x9b5de5),
      attenuationDistance: 62 * S,
      specularIntensity: 1.0,
      envMapIntensity: 2.0,
    }),
  );
  attachOpticalRimShader(
    crystalMat,
    isJadora ? 0xffcb6b : 0xe0b5ff,
    0.34,
    sharedUniforms,
  );

  const outerMesh = new THREE.Mesh(outerGeo, crystalMat);
  outerMesh.renderOrder = 4;
  vesselGroup.add(outerMesh);

  // Sculpted Inner Optical Crystal Cavity (BackSide) creating thick crystal side borders & heavy punt!
  const wallT = (isJadora ? 24 : 25) * S;
  const puntH = (isJadora ? 42 : 45) * S;
  const cavW = bodyW - wallT * 2;
  const cavD = bodyD - wallT * 1.5;
  const cavMinY = bottomY + puntH;
  const cavMaxY = topY - 18 * S;
  const cavH = cavMaxY - cavMinY;

  const cavGeo = tracker.geo(
    createVerticalRoundedBoxGeometry(cavW, cavH, cavD, 14 * S, 7 * S, 4, 2),
  );
  cavGeo.translate(0, (cavMinY + cavMaxY) * 0.5, 0);
  const cavMat = tracker.mat(
    new THREE.MeshPhysicalMaterial({
      color: isJadora ? 0xf5ad32 : 0xb87aff,
      roughness: 0.08,
      metalness: 0.05,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      envMapIntensity: 1.8,
    }),
  );
  const cavMesh = new THREE.Mesh(cavGeo, cavMat);
  cavMesh.renderOrder = 3;
  vesselGroup.add(cavMesh);

  // Inner Luminous Perfume Liquid Core (Molten Gold for Jadora, Royal Amethyst-Lilac for Gucci Flora)
  const liqMinY = cavMinY + 2 * S;
  const liqMaxY = cavMaxY - 8 * S;
  const liqH = liqMaxY - liqMinY;
  const liqGeo = tracker.geo(
    createVerticalRoundedBoxGeometry(cavW - 4 * S, liqH, cavD - 4 * S, 12 * S, 6 * S, 3, 6),
  );
  liqGeo.translate(0, (liqMinY + liqMaxY) * 0.5, 0);

  const liqMat = tracker.mat(
    new THREE.MeshPhysicalMaterial({
      color: isJadora ? 0xc8720c : 0x733fb3,
      roughness: 0.10,
      metalness: 0.04,
      clearcoat: 0.95,
      envMapIntensity: 1.65,
    }),
  );
  attachLiquidEssenceShader(
    liqMat,
    isJadora ? 0xffba3b : 0xc68aff,
    isJadora ? 0.56 : 0.48,
    liqMinY,
    liqMaxY,
    sharedUniforms,
  );
  const liqMesh = new THREE.Mesh(liqGeo, liqMat);
  liqMesh.renderOrder = 2;
  vesselGroup.add(liqMesh);

  // Discreet Rear Engraving
  const rearGeo = tracker.geo(new THREE.PlaneGeometry(150 * S, 140 * S));
  rearGeo.rotateY(Math.PI);
  rearGeo.translate(0, bottomY + 90 * S, -bodyD * 0.5 - 0.5 * S);
  const rearMat = tracker.mat(
    new THREE.MeshBasicMaterial({ map: rearLabelTex, transparent: true, depthWrite: false }),
  );
  const rearMesh = new THREE.Mesh(rearGeo, rearMat);
  rearMesh.renderOrder = 6;
  vesselGroup.add(rearMesh);

  // Neck Collar & Atomizer
  const collarH = 6 * S;
  const { hardwareGroup, dipTubeMesh, atomizerMeshes } = createAtomizerAndTubeAssembly(
    topY,
    cavMinY,
    52 * S,
    collarH,
    34 * S,
    52 * S,
    52 * S,
    isJadora ? 0xd9a84e : 0xd4cde0, // Warm 24k gold collar for Jadora, silver-lilac for Gucci Flora
    S,
    brushedTex,
    tracker,
  );
  vesselGroup.add(dipTubeMesh);

  registerPart(
    isJadora ? 'Golden Optical Crystal Flacon' : 'Amethyst Optical Crystal Flacon',
    vesselGroup,
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -18 * S, 0),
    new THREE.Euler(0, 0, 0),
    new THREE.Vector3(0, 0, 6 * S),
    [outerMesh],
  );

  registerPart(
    isJadora ? '24k Gold Atomizer & Collar' : 'Silver-Iris Atomizer & Collar',
    hardwareGroup,
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 42 * S, 0),
    new THREE.Euler(0, 0, 0),
    new THREE.Vector3(0, 8 * S, 0),
    atomizerMeshes,
  );

  // Lower Front 3D Matte-Black Rounded-Rect Plaque ('JADORA Parfum' / 'GUCCI Flora')
  const { group: plaqueGroup, plaqueMesh } = createFlatPlaqueGroup(
    (isJadora ? 196 : 188) * S,
    (isJadora ? 106 : 102) * S,
    (isJadora ? 22 : 20) * S,
    S,
    labelCanvasTex,
    tracker,
  );
  registerPart(
    'Signature Matte Plaque',
    plaqueGroup,
    new THREE.Vector3(0, -180 * S, bodyD * 0.5 + 1.2 * S),
    new THREE.Vector3(0, -14 * S, 82 * S),
    new THREE.Euler(-0.04, 0, 0),
    new THREE.Vector3(0, 0, 14 * S),
    [plaqueMesh],
  );

  // Tall Cylindrical Cap: Brushed Dark-Bronze (Jadora) vs Satin Midnight-Indigo (Gucci Flora)
  const capH = (isJadora ? 166 : 170) * S;
  const capRestY = topY + collarH + capH * 0.5;
  const capGeo = tracker.geo(createHollowCylindricalCapGeometry(54 * S, capH, 3.2 * S, S, 64));

  const capMat = tracker.mat(
    isJadora
      ? new THREE.MeshPhysicalMaterial({
          color: 0x3d2a1b,
          metalness: 0.90,
          roughness: 0.21,
          roughnessMap: brushedTex,
          anisotropy: 0.78,
          clearcoat: 0.46,
          clearcoatRoughness: 0.14,
          envMapIntensity: 1.95,
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0x26293e,
          metalness: 0.62,
          roughness: 0.22,
          clearcoat: 0.86,
          clearcoatRoughness: 0.10,
          specularIntensity: 0.95,
          envMapIntensity: 1.9,
        }),
  );

  const capMesh = new THREE.Mesh(capGeo, capMat);
  capMesh.renderOrder = 5;
  const capGroup = new THREE.Group();
  capGroup.add(capMesh);

  registerPart(
    isJadora ? 'Brushed Bronze Cap' : 'Midnight-Indigo Satin Cap',
    capGroup,
    new THREE.Vector3(0, capRestY, 0),
    new THREE.Vector3(0, 118 * S, 0),
    new THREE.Euler(0.10, isJadora ? 0.18 : -0.18, 0.03),
    new THREE.Vector3(0, 18 * S, 0),
    [capMesh],
  );

  return {
    rootGroup,
    parts,
    raycastTargets,
    labelCanvasTex,
    plaqueVariant,
    footprintRadius: bodyW * 0.52,
    bottomY,
    topY: capRestY + capH * 0.5,
    dispose: () => tracker.disposeAll(),
  };
}
