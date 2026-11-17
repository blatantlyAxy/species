import { useEffect, useRef, useState } from 'react';
import { FOE_X, PLAYER_X, SCENE_H, SCENE_W, drawScene } from './art';
import type { SceneSpec } from './art';

/** True when this browser can draw the pixel scene. Checked once. */
let canvasOk: boolean | null = null;
export function canDrawPixels(): boolean {
  if (canvasOk === null) {
    try { canvasOk = !!document.createElement('canvas').getContext('2d'); } catch { canvasOk = false; }
  }
  return canvasOk;
}
/** For tests: forget the cached answer. */
export function resetCanvasCheck(): void { canvasOk = null; }

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The pixel scene: a small canvas scaled up with hard edges. It redraws when the scene changes and on a slow
 * two-step idle tick. The tick stops when the tab is hidden or the player prefers reduced motion.
 */
export function PixelScene(p: { spec: Omit<SceneSpec, 'frame'>; playerTag: string; foeTag?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);
  const { biome, season, place, player, foe, companions, nest } = p.spec;

  useEffect(() => {
    if (reducedMotion()) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (id === null) id = setInterval(() => setFrame((f) => 1 - f), 480); };
    const stop = () => { if (id !== null) { clearInterval(id); id = null; } };
    const onVis = () => (document.hidden ? stop() : start());
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const f = drawScene({ biome, season, place, player, foe, companions, nest, frame });
    const img = ctx.createImageData(f.w, f.h);
    img.data.set(new Uint8ClampedArray(f.px.buffer));
    ctx.putImageData(img, 0, 0);
  }, [biome, season, place, player, foe, companions, nest, frame]);

  return (
    <div className="pixelwrap" data-scene="pixel">
      <canvas ref={ref} className="pixelscene" width={SCENE_W} height={SCENE_H} role="img"
        aria-label={`${p.playerTag}${p.foeTag ? `, facing ${p.foeTag}` : ''}`} />
      <span className="ptag you" style={{ left: `${((PLAYER_X + 16) / SCENE_W) * 100}%` }}>{p.playerTag}</span>
      {p.foeTag && <span className="ptag foe" style={{ left: `${((FOE_X + 16) / SCENE_W) * 100}%` }}>{p.foeTag}</span>}
    </div>
  );
}
