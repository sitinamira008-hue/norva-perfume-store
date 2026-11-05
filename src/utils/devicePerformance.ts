/**
 * Hardware, OS, and GPU capability profiler tuned specifically for older, low-spec PCs
 * (especially Windows 7 / legacy integrated graphics / low-core CPUs / <= 4 GB RAM).
 *
 * Results are cached after the first call so repeated reads cost zero DOM/WebGL work.
 */

export interface DevicePerformanceProfile {
  isLowEndDevice: boolean;
  isWindowsLegacy: boolean;
  prefersReducedMotion: boolean;
  canUseHeavyWebGL: boolean;
  hasBasicWebGL: boolean;
}

let cachedProfile: DevicePerformanceProfile | null = null;
let cachedWebGLCheck: { hasBasicWebGL: boolean; isWeakGpu: boolean } | null = null;

function detectWindowsLegacy(ua: string): boolean {
  // Windows NT 6.1 = Windows 7, 6.0 = Vista, 5.x = XP, 6.2/6.3 = Windows 8/8.1
  if (/Windows NT (5\.\d|6\.[0-3])/i.test(ua)) {
    return true;
  }
  // Chrome <= 109 was the final release supporting Windows 7 / 8.1; Firefox ESR <= 115
  const chromeMatch = ua.match(/Windows NT[\s\S]*?Chrome\/(\d+)/i);
  if (chromeMatch && Number(chromeMatch[1]) > 0 && Number(chromeMatch[1]) <= 110) {
    return true;
  }
  const firefoxMatch = ua.match(/Windows NT[\s\S]*?Firefox\/(\d+)/i);
  if (firefoxMatch && Number(firefoxMatch[1]) > 0 && Number(firefoxMatch[1]) <= 115) {
    return true;
  }
  return false;
}

function detectLowSpecHardware(): {
  isLowEnd: boolean;
  isWindowsLegacy: boolean;
  prefersReducedMotion: boolean;
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isLowEnd: false, isWindowsLegacy: false, prefersReducedMotion: false };
  }

  const ua = navigator.userAgent || '';
  const isWindowsLegacy = detectWindowsLegacy(ua);
  const prefersReducedMotion = Boolean(
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  const cores = navigator.hardwareConcurrency || 0;
  const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0;

  const conn = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  const saveData = Boolean(conn?.saveData);
  const slowNetwork = Boolean(
    conn?.effectiveType && /^(slow-2g|2g|3g)$/i.test(conn.effectiveType),
  );

  // Treat Windows 7/8, <= 4 logical CPU threads, <= 4 GB RAM, Save-Data, or reduced-motion as low-spec
  const lowCpu = cores > 0 && cores <= 4;
  const lowRam = memoryGb > 0 && memoryGb <= 4;

  const isLowEnd =
    isWindowsLegacy || prefersReducedMotion || lowCpu || lowRam || saveData || slowNetwork;

  return { isLowEnd, isWindowsLegacy, prefersReducedMotion };
}

/**
 * Lazy GPU inspection — only called when a 3D stage is actually mounted on a non-low-spec device,
 * avoiding WebGL context creation overhead during initial page load or on Windows 7 systems.
 */
export function probeWebGLCapability(): { hasBasicWebGL: boolean; isWeakGpu: boolean } {
  if (cachedWebGLCheck) return cachedWebGLCheck;

  if (typeof document === 'undefined') {
    cachedWebGLCheck = { hasBasicWebGL: false, isWeakGpu: true };
    return cachedWebGLCheck;
  }

  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2', { powerPreference: 'low-power' }) ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

    if (!gl) {
      cachedWebGLCheck = { hasBasicWebGL: false, isWeakGpu: true };
      return cachedWebGLCheck;
    }

    const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = String(
      gl.getParameter(debugExt ? debugExt.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '',
    );
    const maxTexSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0);

    gl.getExtension('WEBGL_lose_context')?.loseContext();

    // Flag software rasterizers, Direct3D9 ANGLE (Windows 7), and legacy integrated GPUs
    const isWeakGpu =
      maxTexSize < 4096 ||
      /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Direct3D9|D3D9|GDI Generic|Intel.*(HD Graphics( [234]\d{3})?($|\s)|GMA|G41|G45|Q45|Ironlake|Sandybridge|Ivybridge)|Mali-4|Adreno \(TM\) [23]/i.test(
        rendererStr,
      );

    cachedWebGLCheck = { hasBasicWebGL: true, isWeakGpu };
    return cachedWebGLCheck;
  } catch {
    cachedWebGLCheck = { hasBasicWebGL: false, isWeakGpu: true };
    return cachedWebGLCheck;
  }
}

export function getDevicePerformanceProfile(): DevicePerformanceProfile {
  if (cachedProfile) return cachedProfile;

  const { isLowEnd, isWindowsLegacy, prefersReducedMotion } = detectLowSpecHardware();

  if (isLowEnd) {
    cachedProfile = {
      isLowEndDevice: true,
      isWindowsLegacy,
      prefersReducedMotion,
      canUseHeavyWebGL: false,
      hasBasicWebGL: false,
    };
    return cachedProfile;
  }

  const { hasBasicWebGL, isWeakGpu } = probeWebGLCapability();
  const isLowEndFinal = isWeakGpu || !hasBasicWebGL;

  cachedProfile = {
    isLowEndDevice: isLowEndFinal,
    isWindowsLegacy,
    prefersReducedMotion,
    canUseHeavyWebGL: hasBasicWebGL && !isWeakGpu,
    hasBasicWebGL,
  };
  return cachedProfile;
}

export function isLowSpecDevice(): boolean {
  return detectLowSpecHardware().isLowEnd;
}

/**
 * Stamps `data-perf="low"` or `data-perf="high"` onto `<html>` synchronously before React mounts
 * so CSS disables expensive gradients, shadows, hover scales, and smooth-scroll on Windows 7 & weak PCs.
 */
export function initPerformanceModeAttribute(): void {
  if (typeof document === 'undefined') return;
  const { isLowEnd } = detectLowSpecHardware();
  document.documentElement.dataset.perf = isLowEnd ? 'low' : 'high';
}
