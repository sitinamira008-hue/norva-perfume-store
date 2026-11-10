import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Layers, RotateCw } from 'lucide-react';
import type { BottleLabelContent, EssencePresetId } from '../webgl/bottleTypes';
import type { FacetBottleScene } from '../webgl/FacetBottleScene';
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
    autoSpin = true,
    centered = true,
    interactiveControls = false,
    preloadSignaturePresets = false,
    paused = false,
    className = '',
    priorityImage = false,
  }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<FacetBottleScene | null>(null);

    const [inView, setInView] = useState(false);
    const [sceneReady, setSceneReady] = useState(false);
    const [webglFailed, setWebglFailed] = useState(false);
    const [isExploded, setIsExploded] = useState(false);
    const [spinning, setSpinning] = useState(autoSpin);

    // Directly enable WebGL whenever 3D is mounted
    const shouldEnableWebGL = !webglFailed;

    // Observe viewport visibility so Three.js is initialized smoothly
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

    // Dynamically import FacetBottleScene + Three.js directly on mount
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

      // Directly initialize without any artificial gate or corner button
      if (typeof win.requestIdleCallback === 'function') {
        idleHandle = win.requestIdleCallback(() => bootScene(), { timeout: 400 });
      } else {
        timeoutHandle = window.setTimeout(() => bootScene(), 50);
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
    }, [shouldEnableWebGL, inView, centered, preloadSignaturePresets]);

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

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full select-none overflow-hidden bg-[#06060a] ${className}`}
      >
        {/* Instant smooth placeholder image while 3D WebGL finishes loading */}
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
          </div>
        )}

        {/* Advance 3D Interactive Demonstration & Orbit Controls */}
        {interactiveControls && sceneReady && (
          <div className="absolute bottom-3.5 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#0a0a0f]/90 backdrop-blur-md border border-white/15 shadow-xl w-max max-w-[calc(100%-1.25rem)] pointer-events-auto">
            {/* Advance Bottle Disassembly / Demonstration Feature */}
            <button
              type="button"
              onClick={handleToggleExplode}
              className={`px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                isExploded
                  ? 'bg-[#d6be96] text-[#050508] font-semibold shadow-[0_0_15px_rgba(214,190,150,0.4)]'
                  : 'bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/10'
              }`}
            >
              {isExploded ? (
                <>
                  <Layers className="w-3.5 h-3.5 text-[#050508]" />
                  <span>Assemble Flacon</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-[#d6be96]" />
                  <span>Demonstrate Anatomy</span>
                </>
              )}
            </button>

            {/* 360° Turntable Orbit Toggle */}
            <button
              type="button"
              onClick={handleToggleSpin}
              className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                spinning
                  ? 'bg-[#d6be96]/20 text-[#f2e6d5] border border-[#d6be96]/40'
                  : 'text-white/70 hover:text-white bg-white/[0.04] hover:bg-white/[0.08]'
              }`}
            >
              <RotateCw className={`w-3 h-3 ${spinning ? 'text-[#d6be96]' : 'text-white/50'}`} />
              <span>{spinning ? 'Orbit: Active' : '360° Orbit'}</span>
            </button>
          </div>
        )}
      </div>
    );
  },
);
ThreeBottleStage.displayName = 'ThreeBottleStage';
