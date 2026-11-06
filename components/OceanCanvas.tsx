"use client";

import { useEffect, useRef } from "react";

/** Decorative, low-cost reflections below the horizon; video remains the actual scene. */
export function OceanCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let width = 0; let height = 0; let raf = 0; let last = 0;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = canvas.clientWidth; height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas); resize();

    const render = (ms: number) => {
      raf = requestAnimationFrame(render);
      if (document.hidden || ms - last < 1000 / 24) return;
      last = ms;
      const t = ms / 1000;
      ctx.clearRect(0, 0, width, height);
      if (!width || !height) return;
      const horizon = height * .32;
      for (let i = 0; i < 22; i++) {
        const depth = (i + 1) / 22;
        const y = horizon + depth * (height - horizon);
        const span = 55 + 170 * depth;
        const x = width * (.15 + .69 * ((Math.sin(i * 11.9 + t * .31) + 1) / 2));
        const shift = Math.sin(t * .82 + i * .3) * (3 + 6 * depth);
        const opacity = (.014 + .035 * depth) * (.7 + .3 * Math.cos(t * .48 + i));
        ctx.beginPath();
        ctx.strokeStyle = `rgba(252,222,180,${opacity})`;
        ctx.lineWidth = 0.7 + depth * .5;
        ctx.moveTo(x - span / 2 + shift, y);
        ctx.bezierCurveTo(x - span / 5, y - 3 * depth, x + span / 5, y + 2 * depth, x + span / 2 + shift, y);
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(render);
    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  return <canvas ref={canvasRef} className="ocean-reflections" aria-hidden="true" />;
}
