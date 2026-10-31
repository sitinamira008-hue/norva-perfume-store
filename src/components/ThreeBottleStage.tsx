import React, { useEffect, useRef, useState } from 'react';
import { RotateCw, Sparkles } from 'lucide-react';
import { EssencePresetId, FacetBottleScene } from '../webgl/FacetBottleScene';
import { BottleLabelContent } from '../webgl/labelTexture';

interface ThreeBottleStageProps {
  label: BottleLabelContent;
  preset: EssencePresetId;
  fallbackImage?: string;
  className?: string;
  showControls?: boolean;
  preloadSignaturePresets?: boolean;
  paused?: boolean;
}

const STAGE_PERFUME_SHADOW_BY_PRESET: Record<
  EssencePresetId,
  {
    ambientMist: string;
    floorPlinthGlow: string;
  }
> = {
  amber: {
    ambientMist:
      'bg-[radial-gradient(ellipse_62%_56%_at_50%_46%,rgba(238,144,42,0.25),rgba(156,72,14,0.12)_48%,transparent_76%)]',
    floorPlinthGlow:
      'bg-[radial-gradient(ellipse_54%_22%_at_50%_84%,rgba(248,162,56,0.34),rgba(128,54,8,0.14)_54%,transparent_80%)]',
  },
  cobalt: {
    ambientMist:
      'bg-[radial-gradient(ellipse_62%_56%_at_50%_46%,rgba(42,162,232,0.24),rgba(72,204,182,0.11)_48%,transparent_76%)]',
    floorPlinthGlow:
      'bg-[radial-gradient(ellipse_54%_22%_at_50%_84%,rgba(68,194,242,0.34),rgba(34,132,168,0.14)_54%,transparent_80%)]',
  },
  noir: {
    ambientMist:
      'bg-[radial-gradient(ellipse_62%_56%_at_50%_46%,rgba(168,182,218,0.19),rgba(78,88,118,0.11)_48%,transparent_76%)]',
    floorPlinthGlow:
      'bg-[radial-gradient(ellipse_54%_22%_at_50%_84%,rgba(196,208,240,0.26),rgba(72,82,110,0.12)_54%,transparent_80%)]',
  },
  champagne: {
    ambientMist:
      'bg-[radial-gradient(ellipse_62%_56%_at_50%_46%,rgba(248,186,62,0.25),rgba(176,108,22,0.12)_48%,transparent_76%)]',
    floorPlinthGlow:
      'bg-[radial-gradient(ellipse_54%_22%_at_50%_84%,rgba(255,198,78,0.35),rgba(168,104,18,0.14)_54%,transparent_80%)]',
  },
  obsidian: {
    ambientMist:
      'bg-[radial-gradient(ellipse_62%_56%_at_50%_46%,rgba(184,116,252,0.25),rgba(104,48,178,0.12)_48%,transparent_76%)]',
    floorPlinthGlow:
      'bg-[radial-gradient(ellipse_54%_22%_at_50%_84%,rgba(198,136,255,0.34),rgba(98,42,168,0.14)_54%,transparent_80%)]',
  },
  violet: {
    ambientMist:
      'bg-[radial-gradient(ellipse_62%_56%_at_50%_46%,rgba(174,116,246,0.23),rgba(96,48,162,0.11)_48%,transparent_76%)]',
    floorPlinthGlow:
      'bg-[radial-gradient(ellipse_54%_22%_at_50%_84%,rgba(186,128,252,0.32),rgba(88,42,152,0.13)_54%,transparent_80%)]',
  },
  emerald: {
    ambientMist:
      'bg-[radial-gradient(ellipse_62%_56%_at_50%_46%,rgba(54,196,174,0.23),rgba(24,116,102,0.11)_48%,transparent_76%)]',
    floorPlinthGlow:
      'bg-[radial-gradient(ellipse_54%_22%_at_50%_84%,rgba(74,218,194,0.32),rgba(24,112,98,0.13)_54%,transparent_80%)]',
  },
};

function canUseWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export const ThreeBottleStage: React.FC<ThreeBottleStageProps> = React.memo(
  ({
    label,
    preset,
    fallbackImage,
    className = 'w-full h-[540px] lg:h-[680px]',
    showControls = true,
    preloadSignaturePresets = false,
    paused = false,
  }) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const sceneRef = useRef<FacetBottleScene | null>(null);
    const [supported, setSupported] = useState<boolean>(() => canUseWebGL());
    const [autoSpin, setAutoSpin] = useState(false);
    const [isExploded, setIsExploded] = useState(false);

    useEffect(() => {
      if (!supported || !mountRef.current) return;
      let instance: FacetBottleScene | null = null;
      try {
        instance = new FacetBottleScene(mountRef.current, {
          centered: true,
          initialLabel: label,
          initialPreset: preset,
          autoSpin: false,
          preloadSignaturePresets,
          onPhaseChange: (exploded) => {
            setIsExploded(exploded);
          },
        });
        sceneRef.current = instance;
      } catch {
        setSupported(false);
      }

      return () => {
        instance?.dispose();
        sceneRef.current = null;
      };
    }, [supported]);

    useEffect(() => {
      sceneRef.current?.setPaused(paused);
    }, [paused]);

    // Instant cached swap of bespoke 3D bottle silhouette, materials & perfumed shadow
    useEffect(() => {
      if (sceneRef.current) {
        sceneRef.current.setBottleIdentity(label, preset);
        setIsExploded(false);
      }
    }, [
      label.titleLine1,
      label.titleLine2,
      label.notesLine,
      label.concentration,
      label.volume,
      label.editionCode,
      preset,
    ]);

    const toggleSpin = () => {
      const next = !autoSpin;
      setAutoSpin(next);
      sceneRef.current?.updateStudioParams({ autoSpin: next });
    };

    const toggleExplode = () => {
      if (!sceneRef.current) return;
      if (isExploded) {
        sceneRef.current.reassembleBottle();
        setIsExploded(false);
      } else {
        sceneRef.current.shatterBottle();
        setIsExploded(true);
      }
    };

    if (!supported) {
      return (
        <div
          className={`relative flex items-center justify-center overflow-hidden rounded-2xl bg-[#09090d] border border-[#d6be96]/15 ${className}`}
        >
          {fallbackImage ? (
            <img
              src={fallbackImage}
              alt={`${label.titleLine1} ${label.titleLine2 ?? ''} perfume bottle`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-8">
              <p className="font-serif-display text-3xl text-white">
                {label.titleLine1} {label.titleLine2}
              </p>
              <p className="text-xs text-white/50 mt-2">{label.notesLine}</p>
            </div>
          )}
        </div>
      );
    }

    const aura = STAGE_PERFUME_SHADOW_BY_PRESET[preset] ?? STAGE_PERFUME_SHADOW_BY_PRESET.amber;

    return (
      <div className={`relative select-none ${className}`}>
        {/* Multi-layered Perfumed Mist Gradient & Plinth Refraction Shadow behind the 3D flacon */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${aura.ambientMist}`}
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${aura.floorPlinthGlow}`}
        />

        {/* Dedicated isolated WebGL canvas container */}
        <div ref={mountRef} className="relative z-[1] w-full h-full" />

        {/* Discreet interactive 3D stage controls at bottom center (no backdrop-blur over WebGL) */}
        {showControls && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0b0b10]/96 border border-white/12 shadow-[0_12px_32px_rgba(0,0,0,0.85)]">
            <button
              type="button"
              onClick={toggleSpin}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11.5px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                autoSpin ? 'bg-[#d6be96] text-[#050508]' : 'text-white/75 hover:text-white'
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{autoSpin ? '360° Active' : '360° Orbit'}</span>
            </button>

            <span aria-hidden="true" className="text-white/20">
              ·
            </span>

            <button
              type="button"
              onClick={toggleExplode}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11.5px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isExploded
                  ? 'bg-[#d6be96]/18 text-[#d6be96]'
                  : 'text-white/75 hover:text-[#d6be96]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isExploded ? 'Reassemble Flacon' : 'Deconstruct Flacon'}</span>
            </button>
          </div>
        )}
      </div>
    );
  },
);
