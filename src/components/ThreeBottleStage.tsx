import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { BottleLabelContent, EssencePresetId } from '../webgl/bottleTypes';
import type { FacetBottleScene } from '../webgl/FacetBottleScene';
import { getDevicePerformanceProfile, probeWebGLCapability } from '../utils/devicePerformance';
import { LuxuryImage } from './LuxuryUI';

interface ThreeBottleStageProps {
  preset: EssencePresetId;
  label: BottleLabelContent;
  fallbackImage?: string;
  autoSpin?: boolean;
  centered?: boolean;
  interactiveControls?: boolean;
  preloadSignaturePresets?: boolean;
  paused?: boolean;
  className?: string;
  priorityImage?: boolean;
}

export const ThreeBottleStage: React.FC<ThreeBottleStageProps> = React.memo(
  ({
    preset,
    label,
    fallbackImage,
    autoSpin = false,
    centered = true,
    interactiveControls = false,
    preloadSignaturePresets = false,
    paused = false,
    className = '',
    priorityImage = false,
  }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<FacetBottleScene | null>(null);

    const [perfProfile] = useState(() => getDevicePerformanceProfile());
    const [manual3DRequested, setManual3DRequested] = useState(false);
    const [inView, setInView] = useState(false);
    const [sceneReady, setSceneReady] = useState(false);
    const [webglFailed, setWebglFailed] = useState(false);
    const [isExploded, setIsExploded] = useState(false);
    const [spinning, setSpinning] = useState(autoSpin);

    const shouldEnableWebGL =
      !webglFailed && (perfProfile.canUseHeavyWebGL || manual3DRequested);

    // Observe viewport visibility so Three.js is never downloaded or initialized off-screen
    useEffect(() => {
      if (!shouldEnableWebGL) return;
      const el = containerRef.current;
      if (!el) return;

      if (typeof IntersectionObserver === 'undefined') {
        setInView(true);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        },
        { rootMargin: '160px' },
      );
      observer.observe(el);
      return () => observer.disconnect();
    }, [shouldEnableWebGL]);

    // Dynamically import FacetBottleScene + Three.js in an async chunk during idle time
    useEffect(() => {
      if (!shouldEnableWebGL || !inView) return;
      const el = containerRef.current;
      if (!el) return;

      let cancelled = false;
      let idleHandle: number | null = null;
      let timeoutHandle: number | null = null;

      const bootScene = async () => {
        try {
          const mod = await import('../webgl/FacetBottleScene');
          if (cancelled || !containerRef.current) return;

          const scene = new mod.FacetBottleScene(containerRef.current, {
            centered,
            autoSpin: spinning,
            initialPreset: preset,
            initialLabel: label,
            preloadSignaturePresets,
            onPhaseChange: (exploded) => {
              if (!cancelled) setIsExploded(exploded);
            },
          });
          scene.setPaused(paused);
          sceneRef.current = scene;
          if (!cancelled) {
            setSceneReady(true);
          }
        } catch {
          if (!cancelled) {
            setWebglFailed(true);
            setSceneReady(false);
          }
        }
      };

      const win = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };

      if (manual3DRequested) {
        bootScene();
      } else if (typeof win.requestIdleCallback === 'function') {
        idleHandle = win.requestIdleCallback(() => bootScene(), { timeout: 900 });
      } else {
        timeoutHandle = window.setTimeout(() => bootScene(), 140);
      }

      return () => {
        cancelled = true;
        if (idleHandle !== null && typeof win.cancelIdleCallback === 'function') {
          win.cancelIdleCallback(idleHandle);
        }
        if (timeoutHandle !== null) {
          window.clearTimeout(timeoutHandle);
        }
        sceneRef.current?.dispose();
        sceneRef.current = null;
        setSceneReady(false);
      };
    }, [shouldEnableWebGL, inView, centered, preloadSignaturePresets, manual3DRequested]);

    useEffect(() => {
      sceneRef.current?.setPaused(paused);
    }, [paused]);

    useEffect(() => {
      if (!sceneRef.current) return;
      sceneRef.current.setBottleIdentity(label, preset);
    }, [preset, label]);

    useEffect(() => {
      setSpinning(autoSpin);
      sceneRef.current?.updateStudioParams({ autoSpin });
    }, [autoSpin]);

    const handleToggleExplode = () => {
      if (!sceneRef.current) return;
      if (isExploded) {
        sceneRef.current.reassembleBottle();
      } else {
        sceneRef.current.shatterBottle();
      }
    };

    const handleToggleSpin = () => {
      const next = !spinning;
      setSpinning(next);
      sceneRef.current?.updateStudioParams({ autoSpin: next });
    };

    const handleManualEnable3D = () => {
      const check = probeWebGLCapability();
      if (!check.hasBasicWebGL) {
        setWebglFailed(true);
        return;
      }
      setManual3DRequested(true);
      setInView(true);
    };

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full select-none overflow-hidden bg-[#06060a] ${className}`}
      >
        {/* Lightweight Static Studio Image (always shown on Windows 7 / weak devices, and as instant placeholder before 3D boots) */}
        {fallbackImage && !sceneReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-6 bg-[#06060a]">
            <LuxuryImage
              src={fallbackImage}
              alt={`${label.titleLine1} ${label.titleLine2 ?? ''}`.trim()}
              priority={priorityImage}
              className="w-full h-full max-h-[86%] object-contain"
            />
            <div className="mt-2 text-center pointer-events-none">
              <p className="font-mono-tabular text-[10px] uppercase tracking-[0.22em] text-[#d6be96]/85">
                {label.editionCode} · {label.volume}
              </p>
            </div>

            {/* Optional manual 3D opt-in button on low-spec devices that still desire interactive inspection */}
            {!shouldEnableWebGL && !webglFailed && interactiveControls && (
              <button
                type="button"
                onClick={handleManualEnable3D}
                className="absolute bottom-3.5 right-3.5 z-20 px-3 py-1.5 rounded-lg bg-[#0c0c12] border border-[#d6be96]/30 text-[11px] font-medium text-[#f2e6d5] hover:border-[#d6be96] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-[#d6be96]" />
                <span>Interactive 3D</span>
              </button>
            )}
          </div>
        )}

        {interactiveControls && sceneReady && (
          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#0a0a0f]/95 border border-white/12 w-max max-w-[calc(100%-1.25rem)]">
            <button
              type="button"
              onClick={handleToggleExplode}
              className="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium tracking-wide text-white/90 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              {isExploded ? 'Assemble Flacon' : 'Inspect Anatomy'}
            </button>
            <button
              type="button"
              onClick={handleToggleSpin}
              className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium tracking-wide rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                spinning
                  ? 'bg-[#d6be96]/20 text-[#f2e6d5] border border-[#d6be96]/40'
                  : 'text-white/75 hover:text-white bg-white/[0.04] hover:bg-white/[0.1]'
              }`}
            >
              {spinning ? 'Orbit: On' : '360° Orbit'}
            </button>
          </div>
        )}
      </div>
    );
  },
);
ThreeBottleStage.displayName = 'ThreeBottleStage';
