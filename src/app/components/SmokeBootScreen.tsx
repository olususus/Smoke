"use client";

import React, { useEffect, useRef } from "react";
import { isReleaseBuild } from "@/lib/app-runtime";
import { AppLogo } from "./AppLogo";
import { NeuralBackdrop } from "./NeuralBackdrop";

type Wisp = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
};

function initWisps(w: number, h: number): Wisp[] {
  return Array.from({ length: 24 }, () => ({
    x: Math.random() * w,
    y: h * (0.5 + Math.random() * 0.45),
    r: 60 + Math.random() * 120,
    vx: (Math.random() - 0.5) * 0.2,
    vy: -0.08 - Math.random() * 0.2,
  }));
}

export function SmokeBootScreen({
  status,
  exiting,
}: {
  status: string;
  exiting: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wispsRef = useRef<Wisp[]>([]);
  const rafRef = useRef(0);

  useEffect(() => {
    if (isReleaseBuild()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      wispsRef.current = initWisps(w, h);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);

      for (const p of wispsRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -p.r * 2) {
          p.x = Math.random() * w;
          p.y = h + p.r;
        }

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, "rgba(180, 200, 220, 0.06)");
        g.addColorStop(0.5, "rgba(120, 150, 180, 0.03)");
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      className={`smoke-boot${exiting ? " smoke-boot--exit" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy={!exiting}
    >
      <div className="smoke-boot__bg">
        <NeuralBackdrop variant={isReleaseBuild() ? "subtle" : "full"} />
      </div>
      {!isReleaseBuild() && (
        <canvas ref={canvasRef} className="smoke-boot__smoke-canvas" aria-hidden />
      )}

      <div className="smoke-boot__content">
        <AppLogo size={88} className="smoke-boot__logo" />
        <h1 className="smoke-boot__wordmark">Smoke</h1>
        <p className="smoke-boot__status">{status}</p>
        <div className="smoke-boot__bar" aria-hidden>
          <div className="smoke-boot__bar-fill" />
        </div>
      </div>
    </div>
  );
}
