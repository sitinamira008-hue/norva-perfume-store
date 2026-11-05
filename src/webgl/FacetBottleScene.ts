import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BespokeBottleAssembly,
  BespokeBottleSharedUniforms,
  BottleInspectablePart,
  buildBespokeBottleAssembly,
} from './bottleGeometry';
import {
  BottleLabelContent,
  DEFAULT_HERO_BOTTLE_LABEL,
  EssencePresetId,
} from './bottleTypes';
import {
  createRadialGlowTexture,
  drawPlaqueTypographyToCanvas,
} from './labelTexture';
import { SpringState, stepSpring } from './mathAndCells';

export type { EssencePresetId };

export interface StudioParams {
  iridescence: number;
  roughness: number;
  ior: number;
  transmission: number;
  seamScale: number;
  breathSpeed: number;
  autoSpin: boolean;
  essencePreset: EssencePresetId;
}

export const ESSENCE_PRESETS: Record<
  EssencePresetId,
  {
    label: string;
    baseHex: number;
    glowHex: number;
    particleHex: number;
    attenuationHex: number;
    glassHex: number;
    rimLightHex: number;
  }
> = {
  amber: {
    label: 'Saffron & Oud',
    baseHex: 0xa64808,
    glowHex: 0xf0952b,
    particleHex: 0xf7c27c,
    attenuationHex: 0x6e2b05,
    glassHex: 0xd98026,
    rimLightHex: 0xffc680,
  },
  cobalt: {
    label: 'Frosted Cobalt & Seafoam',
    baseHex: 0x1674a4,
    glowHex: 0x3daee0,
    particleHex: 0x9ae6df,
    attenuationHex: 0x176d94,
    glassHex: 0x1d7ea8,
    rimLightHex: 0x9be2ff,
  },
  noir: {
    label: 'Matte Noir & Silver Smoke',
    baseHex: 0x0d0e13,
    glowHex: 0x8592b2,
    particleHex: 0xdfe4f2,
    attenuationHex: 0x0c0d12,
    glassHex: 0x121318,
    rimLightHex: 0xdce2f2,
  },
  champagne: {
    label: 'Sandalwood & Gold',
    baseHex: 0xc8720c,
    glowHex: 0xffb838,
    particleHex: 0xffe49e,
    attenuationHex: 0xda8b1a,
    glassHex: 0xffe4ad,
    rimLightHex: 0xffd78a,
  },
  obsidian: {
    label: 'Iris & Amethyst Crystal',
    baseHex: 0x733fb3,
    glowHex: 0xc285ff,
    particleHex: 0xebd4ff,
    attenuationHex: 0x9b5de5,
    glassHex: 0xf2deff,
    rimLightHex: 0xe2bcff,
  },
  violet: {
    label: 'Rose & Silk Musk',
    baseHex: 0x6b3fa8,
    glowHex: 0xb67ef5,
    particleHex: 0xe3ccff,
    attenuationHex: 0x8c52d9,
    glassHex: 0xecd9ff,
    rimLightHex: 0xdcb5ff,
  },
  emerald: {
    label: 'Marine & Bergamot',
    baseHex: 0x187872,
    glowHex: 0x42c4b0,
    particleHex: 0x9ef0df,
    attenuationHex: 0x166e68,
    glassHex: 0x2a948a,
    rimLightHex: 0x9cf2e2,
  },
};

interface CachedAssemblyEntry {
  assembly: BespokeBottleAssembly;
  labelKey: string;
}

export interface FacetBottleOptions {
  centered?: boolean;
  initialLabel?: BottleLabelContent;
  initialPreset?: EssencePresetId;
  autoSpin?: boolean;
  preloadSignaturePresets?: boolean;
  onPhaseChange?: (isExplodedView: boolean, hoveredPart: string | null) => void;
}

function serializeLabelKey(label: BottleLabelContent): string {
  return `${label.titleLine1}|${label.titleLine2 ?? ''}|${label.volume}|${label.editionCode}`;
}

export class FacetBottleScene {
  private readonly container: HTMLElement;
  private readonly centered: boolean;
  private readonly onPhaseChange?: (isExplodedView: boolean, hoveredPart: string | null) => void;
  public readonly isSoftwareGl: boolean;
  public readonly isMobileDevice: boolean;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private studioEnvRT!: THREE.WebGLRenderTarget;
  private rimLight!: THREE.DirectionalLight;
  private lowBounceLight!: THREE.DirectionalLight;

  private bottleRoot!: THREE.Group;
  private bottleTurntable!: THREE.Group;
  private currentAssembly: BespokeBottleAssembly | null = null;
  private assemblyCache = new Map<EssencePresetId, CachedAssemblyEntry>();
  private preloadTimerId = 0;

  private particles!: THREE.Points;
  private particlePositions!: Float32Array;
  private particleSeeds!: Float32Array;
  private particleMaterial!: THREE.PointsMaterial;

  // Dual-layer obsidian contact shadow + perfumed caustic aura pool
  private eclipseShadowMesh!: THREE.Mesh;
  private perfumedAuraMesh!: THREE.Mesh;
  private perfumedAuraMat!: THREE.MeshBasicMaterial;
  private causticCoreMesh!: THREE.Mesh;
  private causticCoreMat!: THREE.MeshBasicMaterial;

  private currentLabel: BottleLabelContent;
  private studioParams: StudioParams;

  private sharedUniforms: BespokeBottleSharedUniforms = {
    uTime: { value: 0 },
    uTiltVel: { value: new THREE.Vector2(0, 0) },
    uCursorWorld: { value: new THREE.Vector3(0, 0, 9999) },
    uCursorStrength: { value: 0 },
    uLayoutScale: { value: 1 },
  };

  private layoutScale = 1;
  private width = 800;
  private height = 760;

  private pointerNdc = new THREE.Vector2(0, 0);
  private smoothedPointer = new THREE.Vector2(0, 0);
  private pointerInside = false;
  private pointerFade = 0;
  private hoveredPart: BottleInspectablePart | null = null;
  private hoveredHitLocal = new THREE.Vector3();
  private appliedCursor = 'grab';

  private isDragging = false;
  private dragStartX = 0;
  private dragPrevX = 0;
  private dragMovedPx = 0;
  private orbitYaw = 0;
  private orbitYawVel = 0;

  private currentTiltX = 0.014;
  private currentTiltY = -0.024;

  // Smooth palette interpolation targets for zero-snap perfumed shadow transitions
  private targetGlowColor = new THREE.Color(0xf0952b);
  private currentGlowColor = new THREE.Color(0xf0952b);
  private targetRimColor = new THREE.Color(0xffc680);
  private currentRimColor = new THREE.Color(0xffc680);

  private isExploded = false;
  private explodeSpring: SpringState = { value: 0, velocity: 0 };
  private entranceSpring: SpringState = { value: 0.92, velocity: 0 };

  private elapsedTime = 0;
  private lastRaycastTime = -1;
  private lastTimestamp = 0;
  private idleActiveBudgetSec = 2.6;
  private frameId = 0;
  private resizeRafId = 0;
  private loopActive = false;
  private disposed = false;
  private inViewport = true;
  private pageVisible = true;
  private externallyPaused = false;
  private pointerDirty = false;
  private initializedSize = false;
  private cachedRect: DOMRect | null = null;
  private observer?: IntersectionObserver;
  private resizeObserver?: ResizeObserver;

  private readonly _raycaster = new THREE.Raycaster();
  private readonly _planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private readonly _worldHit = new THREE.Vector3();
  private readonly _localHit = new THREE.Vector3();
  private readonly _tmpPos = new THREE.Vector3();
  private readonly _tmpEuler = new THREE.Euler();

  constructor(container: HTMLElement, options: FacetBottleOptions = {}) {
    this.container = container;
    this.centered = options.centered ?? true;
    this.currentLabel = options.initialLabel ?? DEFAULT_HERO_BOTTLE_LABEL;
    this.onPhaseChange = options.onPhaseChange;

    this.studioParams = {
      iridescence: 0.52,
      roughness: 0.28,
      ior: 1.54,
      transmission: 0.78,
      seamScale: 0.88,
      breathSpeed: 1.0,
      autoSpin: options.autoSpin ?? false,
      essencePreset: options.initialPreset ?? 'amber',
    };

    this.isMobileDevice = (() => {
      if (typeof window === 'undefined') return false;
      return (
        Boolean(window.matchMedia?.('(pointer: coarse)').matches) || window.innerWidth < 768
      );
    })();

    this.isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const initPreset = ESSENCE_PRESETS[this.studioParams.essencePreset];
    this.targetGlowColor.setHex(initPreset.glowHex);
    this.currentGlowColor.copy(this.targetGlowColor);
    this.targetRimColor.setHex(initPreset.rimLightHex);
    this.currentRimColor.copy(this.targetRimColor);

    this.initScene();
    this.handleResize(true);
    this.ensureBottleAssembly();
    this.applyPresetPalette(true);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.wakeUp(2.4);

    // Only prewarm extra bottles if explicitly requested AND on high-core desktop hardware
    const highCoreDesktop =
      typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 0) >= 8;
    if (options.preloadSignaturePresets && highCoreDesktop && !this.isSoftwareGl && !this.isMobileDevice) {
      this.scheduleIdlePrewarm();
    }
  }

  private scheduleIdlePrewarm(): void {
    const presetsToWarm: { preset: EssencePresetId; label: BottleLabelContent }[] = [
      {
        preset: 'amber',
        label: {
          kicker: 'FRAGRANCE 01 · EXTRAIT',
          titleLine1: 'Khamrah',
          titleLine2: 'Qawa',
          notesLine: 'Oud · Leather · Amber · Saffron',
          concentration: 'EXTRAIT DE PARFUM',
          volume: '50 ML',
          editionCode: 'N° 01 · OUD',
        },
      },
      {
        preset: 'cobalt',
        label: {
          kicker: 'FRAGRANCE 02 · INTENSE',
          titleLine1: 'Cool',
          titleLine2: 'Water',
          notesLine: 'Rose · Vanilla · Musk · Jasmine',
          concentration: 'EAU DE PARFUM INTENSE',
          volume: '50 ML',
          editionCode: 'N° 02 · FLORAL',
        },
      },
      {
        preset: 'noir',
        label: {
          kicker: 'FRAGRANCE 03 · MODERN AQUATIC',
          titleLine1: '9PM',
          titleLine2: 'Rebel',
          notesLine: 'Bergamot · Marine Accords · Cedarwood',
          concentration: 'EAU DE PARFUM',
          volume: '50 ML',
          editionCode: 'N° 03 · MARINE',
        },
      },
      {
        preset: 'champagne',
        label: {
          kicker: 'FRAGRANCE 04 · PURE EXTRAIT',
          titleLine1: 'Jadora',
          titleLine2: 'Parfum',
          notesLine: 'Oud · Sandalwood · Amber · Spices',
          concentration: 'EXTRAIT DE PARFUM',
          volume: '50 ML',
          editionCode: 'N° 04 · AMBER',
        },
      },
      {
        preset: 'obsidian',
        label: {
          kicker: 'FRAGRANCE 05 · LUMINOUS IRIS',
          titleLine1: 'Gucci',
          titleLine2: 'Flora',
          notesLine: 'White Musk · Iris · Citrus · Cashmere',
          concentration: 'EAU DE PARFUM',
          volume: '50 ML',
          editionCode: 'N° 05 · IRIS',
        },
      },
    ];

    let idx = 0;
    const warmNext = () => {
      if (this.disposed || idx >= presetsToWarm.length) return;
      const item = presetsToWarm[idx++];
      if (!this.assemblyCache.has(item.preset)) {
        const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
        const built = buildBespokeBottleAssembly({
          archetype: item.preset,
          scale: 1,
          label: item.label,
          maxAnisotropy: maxAniso,
          isSoftwareGl: this.isSoftwareGl,
          isMobileDevice: this.isMobileDevice,
          sharedUniforms: this.sharedUniforms,
        });
        built.rootGroup.visible = false;
        this.bottleTurntable.add(built.rootGroup);
        this.assemblyCache.set(item.preset, {
          assembly: built,
          labelKey: serializeLabelKey(item.label),
        });
      }
      this.preloadTimerId = window.setTimeout(warmNext, 180);
    };

    this.preloadTimerId = window.setTimeout(warmNext, 450);
  }

  public setPaused(paused: boolean): void {
    if (this.externallyPaused === paused) return;
    this.externallyPaused = paused;
    if (!paused) {
      this.wakeUp(2.0);
    }
  }

  private wakeUp(durationSec = 2.2): void {
    this.idleActiveBudgetSec = Math.max(this.idleActiveBudgetSec, durationSec);
    this.startLoop();
  }

  private startLoop(): void {
    if (
      this.disposed ||
      this.loopActive ||
      !this.inViewport ||
      !this.pageVisible ||
      this.externallyPaused
    ) {
      return;
    }
    if (this.idleActiveBudgetSec <= 0 && !this.studioParams.autoSpin && !this.isDragging && !this.pointerInside) {
      this.idleActiveBudgetSec = 0.6;
    }
    this.loopActive = true;
    this.lastTimestamp = performance.now();
    this.tick();
  }

  /**
   * Bakes an obsidian-black haute-parfumerie studio PMREM environment ONCE at startup.
   * Zero per-frame CubeCamera passes — live reflection motion is driven by shader `environmentRotation`!
   */
  private bakeObsidianStudioEnvironment(): THREE.WebGLRenderTarget {
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x040407);

    const baseRoom = new RoomEnvironment();
    baseRoom.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const m = mesh.material as THREE.MeshStandardMaterial;
        if (m.emissiveIntensity !== undefined && m.emissiveIntensity > 1) {
          m.emissiveIntensity *= 0.48;
        } else if (m.color) {
          m.color.multiplyScalar(0.18);
        }
      }
    });
    envScene.add(baseRoom);

    // Tall vertical studio softbox strips for crisp luxury cap & crystal bevel specular lines
    const stripGeo = new THREE.CylinderGeometry(14, 14, 26, 20, 1, true, -0.16, 0.32);
    stripGeo.scale(-1, 1, 1);
    const leftMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(6.4, 5.8, 5.1),
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const leftRibbon = new THREE.Mesh(stripGeo, leftMat);
    leftRibbon.rotation.y = -Math.PI * 0.30;
    envScene.add(leftRibbon);

    const rightMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(5.0, 4.8, 5.6),
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const rightRibbon = new THREE.Mesh(stripGeo.clone(), rightMat);
    rightRibbon.rotation.y = Math.PI * 0.34;
    envScene.add(rightRibbon);

    const haloGeo = new THREE.TorusGeometry(8.5, 0.55, 12, 36);
    haloGeo.rotateX(Math.PI / 2);
    const haloMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(5.0, 4.8, 5.4),
      toneMapped: false,
    });
    const crownHalo = new THREE.Mesh(haloGeo, haloMat);
    crownHalo.position.set(0, 12.0, 1.5);
    envScene.add(crownHalo);

    const keyPanelGeo = new THREE.PlaneGeometry(5.2, 15.0);
    const keyPanelMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(5.8, 5.4, 6.0),
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const keySoftbox = new THREE.Mesh(keyPanelGeo, keyPanelMat);
    keySoftbox.position.set(-5.8, 4.2, 11.2);
    keySoftbox.lookAt(0, 0, 0);
    envScene.add(keySoftbox);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileCubemapShader();
    const renderTarget = pmrem.fromScene(envScene, 0.032);
    pmrem.dispose();

    // Immediately free temporary studio rig geometries & materials
    envScene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });

    return renderTarget;
  }

  private initScene(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setClearColor(0x050508, 0);

    // Balanced crisp DPR for silky 60/120fps glass transmission
    const maxDpr = this.isMobileDevice ? 1.2 : 1.5;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, maxDpr),
    );
    (
      this.renderer as unknown as { transmissionResolutionScale?: number }
    ).transmissionResolutionScale = this.isMobileDevice ? 0.5 : 0.65;

    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'pan-y';
    this.renderer.domElement.style.cursor = 'grab';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 10, 12000);

    this.studioEnvRT = this.bakeObsidianStudioEnvironment();
    this.scene.environment = this.studioEnvRT.texture;
    this.scene.environmentIntensity = 0.78;

    const keyLight = new THREE.DirectionalLight(0xfff6eb, 2.4);
    keyLight.position.set(-520, 740, 860);
    this.scene.add(keyLight);

    const hemiFill = new THREE.HemisphereLight(0xd8e2ff, 0x050508, 0.52);
    this.scene.add(hemiFill);

    this.rimLight = new THREE.DirectionalLight(0xffd79e, 1.75);
    this.rimLight.position.set(540, 280, -640);
    this.scene.add(this.rimLight);

    this.lowBounceLight = new THREE.DirectionalLight(0xf0952b, 0.7);
    this.lowBounceLight.position.set(-260, -560, 440);
    this.scene.add(this.lowBounceLight);

    const glowSpriteTex = createRadialGlowTexture(
      'rgba(255, 255, 255, 0.95)',
      'rgba(255, 255, 255, 0.35)',
    );
    const darkShadowTex = createRadialGlowTexture(
      'rgba(0, 0, 0, 0.88)',
      'rgba(0, 0, 0, 0.38)',
      0.52,
    );
    const perfumedMistTex = createRadialGlowTexture(
      'rgba(255, 255, 255, 0.58)',
      'rgba(255, 255, 255, 0.16)',
      0.46,
    );

    this.bottleRoot = new THREE.Group();
    this.bottleTurntable = new THREE.Group();
    this.bottleRoot.add(this.bottleTurntable);
    this.scene.add(this.bottleRoot);

    // 1. Grounded Obsidian Contact Shadow directly beneath flacon punt
    const planeGeo = new THREE.PlaneGeometry(1, 1);
    planeGeo.rotateX(-Math.PI / 2);

    const eclipseMat = new THREE.MeshBasicMaterial({
      map: darkShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.92,
    });
    this.eclipseShadowMesh = new THREE.Mesh(planeGeo, eclipseMat);
    this.eclipseShadowMesh.renderOrder = 0;
    this.bottleRoot.add(this.eclipseShadowMesh);

    // 2. Wide Scent-Tinted Perfumed Mist Shadow on the obsidian floor
    this.perfumedAuraMat = new THREE.MeshBasicMaterial({
      map: perfumedMistTex,
      color: this.currentGlowColor,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.44,
    });
    this.perfumedAuraMesh = new THREE.Mesh(planeGeo, this.perfumedAuraMat);
    this.perfumedAuraMesh.renderOrder = 1;
    this.bottleRoot.add(this.perfumedAuraMesh);

    // 3. Crisp Optical Caustic Refraction Pool directly under the glass punt
    this.causticCoreMat = new THREE.MeshBasicMaterial({
      map: perfumedMistTex,
      color: this.currentRimColor,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.34,
    });
    this.causticCoreMesh = new THREE.Mesh(planeGeo, this.causticCoreMat);
    this.causticCoreMesh.renderOrder = 1;
    this.bottleRoot.add(this.causticCoreMesh);

    const preset = ESSENCE_PRESETS[this.studioParams.essencePreset];
    const pCount = this.isMobileDevice ? 24 : 38;
    this.particlePositions = new Float32Array(pCount * 3);
    this.particleSeeds = new Float32Array(pCount * 4);
    for (let i = 0; i < pCount; i++) {
      this.particleSeeds[i * 4] = Math.random() * Math.PI * 2;
      this.particleSeeds[i * 4 + 1] = 0.35 + Math.random() * 0.85;
      this.particleSeeds[i * 4 + 2] = Math.random();
      this.particleSeeds[i * 4 + 3] = 0.35 + Math.random() * 0.75;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    this.particleMaterial = new THREE.PointsMaterial({
      size: 9,
      map: glowSpriteTex,
      color: preset.particleHex,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.particles = new THREE.Points(pGeo, this.particleMaterial);
    this.particles.frustumCulled = false;
    this.bottleTurntable.add(this.particles);
  }

  /**
   * Retrieves or builds the canonical (S = 1) bespoke 3D bottle assembly from cache for < 0.05ms instant switching.
   */
  private ensureBottleAssembly(): void {
    const targetArchetype = this.studioParams.essencePreset;
    const labelKey = serializeLabelKey(this.currentLabel);

    // Hide previous assembly without disposing it so switching back is instantaneous
    if (this.currentAssembly) {
      this.currentAssembly.rootGroup.visible = false;
      this.hoveredPart = null;
      this.syncCursorStyle();
    }

    let entry = this.assemblyCache.get(targetArchetype);
    if (!entry) {
      const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
      const assembly = buildBespokeBottleAssembly({
        archetype: targetArchetype,
        scale: 1,
        label: this.currentLabel,
        maxAnisotropy: maxAniso,
        isSoftwareGl: this.isSoftwareGl,
        isMobileDevice: this.isMobileDevice,
        sharedUniforms: this.sharedUniforms,
      });
      this.bottleTurntable.add(assembly.rootGroup);
      entry = { assembly, labelKey };
      this.assemblyCache.set(targetArchetype, entry);
    } else if (entry.labelKey !== labelKey) {
      const canvas = entry.assembly.labelCanvasTex.image as HTMLCanvasElement;
      if (canvas) {
        drawPlaqueTypographyToCanvas(
          canvas,
          this.currentLabel,
          entry.assembly.plaqueVariant,
        );
        entry.assembly.labelCanvasTex.needsUpdate = true;
      }
      entry.labelKey = labelKey;
    }

    entry.assembly.rootGroup.visible = true;
    this.currentAssembly = entry.assembly;

    const r = entry.assembly.footprintRadius;
    const baseY = entry.assembly.bottomY;

    this.eclipseShadowMesh.position.set(0, baseY - 22, 0);
    this.eclipseShadowMesh.scale.set(r * 2.9, 1, r * 1.9);

    this.perfumedAuraMesh.position.set(0, baseY - 25, -12);
    this.perfumedAuraMesh.scale.set(r * 5.2, 1, r * 3.4);

    this.causticCoreMesh.position.set(0, baseY - 23, 14);
    this.causticCoreMesh.scale.set(r * 2.5, 1, r * 1.55);
  }

  private applyPresetPalette(immediate = false): void {
    const preset = ESSENCE_PRESETS[this.studioParams.essencePreset];
    this.particleMaterial.color.setHex(preset.particleHex);
    this.targetGlowColor.setHex(preset.glowHex);
    this.targetRimColor.setHex(preset.rimLightHex);

    if (immediate) {
      this.currentGlowColor.copy(this.targetGlowColor);
      this.currentRimColor.copy(this.targetRimColor);
      this.rimLight.color.copy(this.currentRimColor);
      this.lowBounceLight.color.copy(this.currentGlowColor);
      this.perfumedAuraMat.color.copy(this.currentGlowColor);
      this.causticCoreMat.color.copy(this.currentRimColor);
    }
  }

  private syncCursorStyle(): void {
    const nextCursor = this.isDragging
      ? 'grabbing'
      : this.hoveredPart && !this.isExploded
        ? 'pointer'
        : 'grab';
    if (nextCursor !== this.appliedCursor) {
      this.appliedCursor = nextCursor;
      if (this.renderer?.domElement) {
        this.renderer.domElement.style.cursor = nextCursor;
      }
    }
  }

  private scheduleResize = (): void => {
    if (this.disposed || this.resizeRafId) return;
    this.cachedRect = null;
    this.resizeRafId = requestAnimationFrame(() => {
      this.resizeRafId = 0;
      this.handleResize(false);
    });
  };

  public handleResize = (force = false): void => {
    if (this.disposed) return;
    const rect = this.container.getBoundingClientRect();
    this.cachedRect = rect;
    const nextWidth = Math.max(250, rect.width || 640);
    const nextHeight = Math.max(260, rect.height || 640);

    if (
      !force &&
      this.initializedSize &&
      Math.abs(nextWidth - this.width) < 3 &&
      (this.isMobileDevice
        ? Math.abs(nextHeight - this.height) < 96
        : Math.abs(nextHeight - this.height) < 3)
    ) {
      return;
    }

    this.initializedSize = true;
    this.width = nextWidth;
    this.height = nextHeight;

    this.renderer.setSize(this.width, this.height, false);

    const fovRad = THREE.MathUtils.degToRad(30);
    const camZ = this.height / (2 * Math.tan(fovRad * 0.5));
    this.camera.aspect = this.width / this.height;
    this.camera.position.set(0, 0, camZ);
    this.camera.near = Math.max(10, camZ * 0.08);
    this.camera.far = camZ * 5.5;
    this.camera.updateProjectionMatrix();

    const isCompactStage = this.width < 640;
    const heightFitScale = (this.height * (isCompactStage ? 0.64 : 0.70)) / 610;
    const widthFitScale = (this.width * (isCompactStage ? 0.65 : 0.68)) / 360;
    const S = Math.max(0.32, Math.min(1.18, Math.min(widthFitScale, heightFitScale)));

    this.layoutScale = S;
    this.sharedUniforms.uLayoutScale.value = S;
    this.particleMaterial.size = 10 * S;

    const bottleOffsetX = this.centered ? 0 : this.width >= 1024 ? this.width * 0.14 : 0;
    const baseYOffset = isCompactStage ? 8 * S : -8 * S;
    this.bottleRoot.position.set(bottleOffsetX, baseYOffset, 0);
  };

  private onVisibilityChange = (): void => {
    this.pageVisible = !document.hidden;
    if (this.pageVisible) {
      this.startLoop();
    }
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.loopActive = false;
    cancelAnimationFrame(this.frameId);
  };

  private onContextRestored = (): void => {
    this.startLoop();
  };

  private invalidateCachedRect = (): void => {
    this.cachedRect = null;
  };

  private bindEvents(): void {
    window.addEventListener('resize', this.scheduleResize, { passive: true });
    // Zero layout-thrashing: mark rect stale on scroll instead of calling getBoundingClientRect()
    window.addEventListener('scroll', this.invalidateCachedRect, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.container.addEventListener('pointerenter', this.invalidateCachedRect, { passive: true });
    this.container.addEventListener('pointermove', this.onPointerMove, { passive: true });
    this.container.addEventListener('pointerleave', this.onPointerLeave);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
    window.addEventListener('pointercancel', this.onPointerUp, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
      this.resizeObserver.observe(this.container);
    }

    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          this.inViewport = entry.isIntersecting;
          if (this.inViewport) {
            this.wakeUp(1.5);
          }
        },
        { threshold: 0.02 },
      );
      this.observer.observe(this.container);
    }
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!this.cachedRect) {
      this.cachedRect = this.container.getBoundingClientRect();
    }
    this.isDragging = true;
    this.dragStartX = e.clientX;
    this.dragPrevX = e.clientX;
    this.dragMovedPx = 0;
    this.syncCursorStyle();
    this.wakeUp(2.5);
  };

  private onPointerUp = (): void => {
    if (this.isDragging && this.isExploded && this.dragMovedPx < 5) {
      this.reassembleBottle();
    }
    this.isDragging = false;
    this.syncCursorStyle();
    this.wakeUp(1.8);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.cachedRect) {
      this.cachedRect = this.container.getBoundingClientRect();
    }
    const rect = this.cachedRect;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.pointerNdc.x = (x / Math.max(1, this.width)) * 2 - 1;
    this.pointerNdc.y = -(y / Math.max(1, this.height)) * 2 + 1;
    this.pointerInside = e.pointerType === 'mouse';
    this.pointerDirty = e.pointerType === 'mouse';

    if (this.isDragging) {
      const dx = e.clientX - this.dragPrevX;
      this.dragMovedPx = Math.max(this.dragMovedPx, Math.abs(e.clientX - this.dragStartX));
      this.dragPrevX = e.clientX;
      this.orbitYawVel = dx * 0.0085;
      this.orbitYaw += dx * 0.0072;
    }
    this.wakeUp(1.6);
  };

  private onPointerLeave = (): void => {
    this.pointerInside = false;
    this.pointerDirty = false;
    this.isDragging = false;
    this.hoveredPart = null;
    this.syncCursorStyle();
    this.wakeUp(1.4);
  };

  public shatterBottle(): void {
    if (this.isExploded) return;
    this.isExploded = true;
    this.hoveredPart = null;
    this.syncCursorStyle();
    this.wakeUp(2.6);
    this.onPhaseChange?.(true, null);
  }

  public reassembleBottle(): void {
    if (!this.isExploded) return;
    this.isExploded = false;
    this.syncCursorStyle();
    this.wakeUp(2.6);
    this.onPhaseChange?.(false, null);
  }

  public setBottleIdentity(label: BottleLabelContent, presetId: EssencePresetId): void {
    this.currentLabel = label;
    const presetChanged = this.studioParams.essencePreset !== presetId;
    this.studioParams.essencePreset = presetId;

    if (presetChanged || !this.currentAssembly) {
      const wasExploded = this.isExploded;
      this.isExploded = false;
      this.explodeSpring.value = 0;
      this.explodeSpring.velocity = 0;
      this.entranceSpring.value = 0.93;
      this.entranceSpring.velocity = 1.25;
      this.orbitYaw = 0;
      this.orbitYawVel = 0.028;

      this.ensureBottleAssembly();
      this.applyPresetPalette(false);
      if (wasExploded) {
        this.onPhaseChange?.(false, null);
      }
    } else if (this.currentAssembly) {
      this.ensureBottleAssembly();
    }
    this.wakeUp(2.6);
  }

  public updateStudioParams(partial: Partial<StudioParams>): void {
    const prevPreset = this.studioParams.essencePreset;
    this.studioParams = { ...this.studioParams, ...partial };
    if (partial.essencePreset && partial.essencePreset !== prevPreset) {
      this.ensureBottleAssembly();
      this.applyPresetPalette(false);
    }
    this.wakeUp(2.2);
  }

  public resetOrbit(): void {
    this.orbitYaw = 0;
    this.orbitYawVel = 0;
    this.wakeUp(1.8);
  }

  private performRaycast(): void {
    if (this.isMobileDevice || this.isDragging || !this.currentAssembly || !this.pointerInside) {
      if (this.hoveredPart) {
        this.hoveredPart = null;
        this.syncCursorStyle();
      }
      return;
    }

    if (!this.pointerDirty || this.elapsedTime - this.lastRaycastTime < 1 / 24) {
      return;
    }
    this.pointerDirty = false;
    this.lastRaycastTime = this.elapsedTime;

    this._raycaster.setFromCamera(this.pointerNdc, this.camera);
    this._planeZ.constant = -60 * this.layoutScale;
    this._raycaster.ray.intersectPlane(this._planeZ, this._worldHit);

    const hits = this._raycaster.intersectObjects(this.currentAssembly.raycastTargets, false);
    if (hits.length > 0) {
      const topHit = hits[0];
      const part = topHit.object.userData.inspectPart as BottleInspectablePart | undefined;
      this.sharedUniforms.uCursorWorld.value.copy(topHit.point);

      if (part) {
        this._localHit.copy(topHit.point);
        part.group.worldToLocal(this._localHit);
        this.hoveredHitLocal.copy(this._localHit);

        if (this.hoveredPart !== part) {
          this.hoveredPart = part;
          this.syncCursorStyle();
        }
      }
    } else {
      this.sharedUniforms.uCursorWorld.value.copy(this._worldHit);
      if (this.hoveredPart) {
        this.hoveredPart = null;
        this.syncCursorStyle();
      }
    }
  }

  private stepAnimation(dt: number): void {
    this.elapsedTime += dt;
    this.sharedUniforms.uTime.value = this.elapsedTime;

    const S = this.layoutScale;

    // Smoothly interpolate perfumed shadow & rim lighting hues across fragrance transitions
    const colorLerp = 1 - Math.exp(-dt * 8.5);
    this.currentGlowColor.lerp(this.targetGlowColor, colorLerp);
    this.currentRimColor.lerp(this.targetRimColor, colorLerp);
    this.rimLight.color.copy(this.currentRimColor);
    this.lowBounceLight.color.copy(this.currentGlowColor);
    this.perfumedAuraMat.color.copy(this.currentGlowColor);
    this.causticCoreMat.color.copy(this.currentRimColor);

    const targetFade = this.pointerInside ? 1 : 0;
    this.pointerFade += (targetFade - this.pointerFade) * (1 - Math.exp(-dt * 9));
    this.sharedUniforms.uCursorStrength.value = this.pointerFade;

    const px = this.pointerInside ? this.pointerNdc.x : 0;
    const py = this.pointerInside ? this.pointerNdc.y : 0;
    const smoothAlpha = 1 - Math.exp(-dt / 0.22);
    this.smoothedPointer.x += (px - this.smoothedPointer.x) * smoothAlpha;
    this.smoothedPointer.y += (py - this.smoothedPointer.y) * smoothAlpha;

    // Zero-cost GPU shader environment rotation
    this.scene.environmentRotation.set(
      this.smoothedPointer.y * 0.11,
      Math.sin(this.elapsedTime * 0.34) * 0.15 + this.smoothedPointer.x * 0.26,
      0,
    );

    const deg = Math.PI / 180;
    const targetRotY = px * 10.5 * deg - 1.5 * deg;
    const targetRotX = -py * 6.5 * deg + 1.2 * deg;

    const prevTiltX = this.currentTiltX;
    const prevTiltY = this.currentTiltY;
    const tiltAlpha = 1 - Math.exp(-dt / 0.26);
    this.currentTiltX += (targetRotX - this.currentTiltX) * tiltAlpha;
    this.currentTiltY += (targetRotY - this.currentTiltY) * tiltAlpha;

    this.sharedUniforms.uTiltVel.value.set(
      (this.currentTiltY - prevTiltY) / Math.max(0.001, dt),
      (this.currentTiltX - prevTiltX) / Math.max(0.001, dt),
    );

    const floatWave = Math.sin(this.elapsedTime * 1.1);
    const floatY = floatWave * 5.2 * S;
    const idleSwayY = Math.sin(this.elapsedTime * 0.48) * 0.082;
    const idleSwayZ = Math.cos(this.elapsedTime * 0.42) * 0.011;

    if (!this.isDragging) {
      if (this.studioParams.autoSpin) {
        this.orbitYaw += dt * 0.52;
      } else {
        this.orbitYaw += this.orbitYawVel;
        this.orbitYawVel *= Math.pow(0.92, dt * 60);
      }
    }

    const entranceScale = stepSpring(this.entranceSpring, 1.0, dt, 195, 22);
    const explodeT = stepSpring(this.explodeSpring, this.isExploded ? 1.0 : 0.0, dt, 145, 19);

    const stageFitScale = entranceScale * (1.0 - 0.11 * explodeT);
    const restCenterY = this.width < 640 ? 8 : -10;
    this.bottleRoot.scale.setScalar(S * stageFitScale);
    this.bottleRoot.position.y = (restCenterY - 16 * explodeT) * S + floatY;
    this.bottleRoot.rotation.set(
      this.currentTiltX,
      this.currentTiltY + idleSwayY,
      idleSwayZ,
    );
    this.bottleTurntable.rotation.y = this.orbitYaw;

    // Breathe the perfumed shadow & caustic refraction pool inversely with bottle levitation
    this.perfumedAuraMat.opacity = 0.44 - floatWave * 0.04 + this.pointerFade * 0.08;
    this.causticCoreMat.opacity = 0.34 - floatWave * 0.05 + this.pointerFade * 0.06;

    this.performRaycast();

    if (this.currentAssembly) {
      for (const part of this.currentAssembly.parts) {
        const isHovered = this.hoveredPart === part && !this.isExploded;
        const hoverAmt = stepSpring(part.liftSpring, isHovered ? 1 : 0, dt, 190, 21);

        let targetTipX = 0;
        let targetTipY = 0;
        if (isHovered) {
          const normX = THREE.MathUtils.clamp(this.hoveredHitLocal.x / 110, -1, 1);
          const normY = THREE.MathUtils.clamp(this.hoveredHitLocal.y / 110, -1, 1);
          targetTipY = -normX * 0.08;
          targetTipX = normY * 0.08;
        }
        const tipX = stepSpring(part.tipXSpring, targetTipX, dt, 180, 20);
        const tipY = stepSpring(part.tipYSpring, targetTipY, dt, 180, 20);

        this._tmpPos
          .copy(part.restPos)
          .addScaledVector(part.hoverOffset, hoverAmt)
          .addScaledVector(part.explodeOffset, explodeT);
        part.group.position.copy(this._tmpPos);

        this._tmpEuler.set(
          tipX + part.explodeRot.x * explodeT,
          tipY + part.explodeRot.y * explodeT,
          part.explodeRot.z * explodeT,
        );
        part.group.rotation.copy(this._tmpEuler);
      }

      // Canonical-scale (S = 1) atmospheric perfume mist particles orbiting the flacon
      const posArr = this.particlePositions;
      const pCount = posArr.length / 3;
      const baseR = this.currentAssembly.footprintRadius * (1.16 + 0.34 * explodeT);
      for (let i = 0; i < pCount; i++) {
        const ang0 = this.particleSeeds[i * 4];
        const radFrac = this.particleSeeds[i * 4 + 1];
        const hFrac = this.particleSeeds[i * 4 + 2];
        const speed = this.particleSeeds[i * 4 + 3];

        const rise = (hFrac + this.elapsedTime * 0.045 * speed) % 1;
        const y = -260 + rise * 520;
        const r = baseR * radFrac;
        const theta = ang0 + this.elapsedTime * 0.28 * speed;

        posArr[i * 3] = Math.cos(theta) * r;
        posArr[i * 3 + 1] = y;
        posArr[i * 3 + 2] = Math.sin(theta) * r * 0.72;
      }
      (this.particles.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate =
        true;
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed || !this.inViewport || !this.pageVisible || this.externallyPaused) {
          this.loopActive = false;
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private tick = (): void => {
    if (this.disposed || !this.inViewport || !this.pageVisible || this.externallyPaused) {
      this.loopActive = false;
      return;
    }
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTimestamp) / 1000));
    this.lastTimestamp = now;

    this.stepAnimation(dt);
    this.renderer.render(this.scene, this.camera);

    const activelyInteracting =
      this.studioParams.autoSpin ||
      this.isDragging ||
      this.pointerInside ||
      Math.abs(this.orbitYawVel) > 0.0005;

    if (activelyInteracting) {
      this.idleActiveBudgetSec = Math.max(this.idleActiveBudgetSec, 1.4);
    } else {
      this.idleActiveBudgetSec -= dt;
      if (this.idleActiveBudgetSec <= 0) {
        this.loopActive = false;
        return;
      }
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    this.loopActive = false;
    cancelAnimationFrame(this.frameId);
    cancelAnimationFrame(this.resizeRafId);
    clearTimeout(this.frameId);
    clearTimeout(this.preloadTimerId);

    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.scheduleResize);
    window.removeEventListener('scroll', this.invalidateCachedRect);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.container.removeEventListener('pointerenter', this.invalidateCachedRect);
    this.container.removeEventListener('pointermove', this.onPointerMove);
    this.container.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);

    this.assemblyCache.forEach((entry) => entry.assembly.dispose());
    this.assemblyCache.clear();
    this.currentAssembly = null;

    this.particleMaterial.dispose();
    this.particles.geometry.dispose();
    this.eclipseShadowMesh.geometry.dispose();
    (this.eclipseShadowMesh.material as THREE.Material).dispose();
    this.perfumedAuraMat.dispose();
    this.causticCoreMat.dispose();

    this.studioEnvRT.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
