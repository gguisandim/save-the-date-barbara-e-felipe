"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type OceanCanvasHandle = {
  rippleAt: (x: number, y: number) => void;
};

type Ripple = { x: number; y: number; startedAt: number };

/** Low-cost sea reflections with short, touch-driven ripples. */
export const OceanCanvas = forwardRef<OceanCanvasHandle>(function OceanCanvas(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const reducedMotionRef = useRef(false);

  useImperativeHandle(ref, () => ({
    rippleAt(x, y) {
      if (reducedMotionRef.current) return;
      ripplesRef.current.push({ x, y, startedAt: performance.now() });
      ripplesRef.current = ripplesRef.current.slice(-4);
    },
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => { reducedMotionRef.current = motionQuery.matches; };
    syncMotion();
    motionQuery.addEventListener("change", syncMotion);

    let width = 0;
    let height = 0;
    let raf = 0;
    let last = 0;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const drawRipple = (ripple: Ripple, now: number) => {
      const age = (now - ripple.startedAt) / 1000;
      if (age < 0 || age > 2.15) return false;
      const life = 1 - age / 2.15;
      for (let ring = 0; ring < 3; ring += 1) {
        const delayedAge = Math.max(0, age - ring * 0.17);
        const radius = 12 + delayedAge * (74 + ring * 13);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,235,201,${life * (0.2 - ring * 0.035)})`;
        ctx.lineWidth = 0.7 + life * 0.55;
        ctx.ellipse(ripple.x, ripple.y, radius, radius * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      return true;
    };

    const render = (ms: number) => {
      raf = requestAnimationFrame(render);
      if (document.hidden || ms - last < 1000 / 30) return;
      last = ms;
      ctx.clearRect(0, 0, width, height);
      if (!width || !height || reducedMotionRef.current) return;

      const t = ms / 1000;
      const horizon = height * 0.32;
      for (let i = 0; i < 22; i += 1) {
        const depth = (i + 1) / 22;
        const y = horizon + depth * (height - horizon);
        const span = 55 + 170 * depth;
        const x = width * (0.15 + 0.69 * ((Math.sin(i * 11.9 + t * 0.31) + 1) / 2));
        const shift = Math.sin(t * 0.82 + i * 0.3) * (3 + 6 * depth);
        const opacity = (0.014 + 0.035 * depth) * (0.7 + 0.3 * Math.cos(t * 0.48 + i));
        ctx.beginPath();
        ctx.strokeStyle = `rgba(252,222,180,${opacity})`;
        ctx.lineWidth = 0.7 + depth * 0.5;
        ctx.moveTo(x - span / 2 + shift, y);
        ctx.bezierCurveTo(x - span / 5, y - 3 * depth, x + span / 5, y + 2 * depth, x + span / 2 + shift, y);
        ctx.stroke();
      }
      ripplesRef.current = ripplesRef.current.filter((ripple) => drawRipple(ripple, ms));
    };

    raf = requestAnimationFrame(render);
    return () => {
      observer.disconnect();
      motionQuery.removeEventListener("change", syncMotion);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="ocean-reflections" aria-hidden="true" />;
});
