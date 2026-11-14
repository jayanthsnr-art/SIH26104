"use client";

import { useEffect, useRef } from "react";
import type { RiskAction } from "@/lib/reso-guard-types";

const COLORS: Record<RiskAction, string> = {
  ALLOW: "#65f29a",
  STEP_UP_MFA: "#ffc857",
  FREEZE: "#ff5964",
};
const CHARACTERS = "0123456789ABCDEFｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ";

export function DigitalRain({ action }: { action: RiskAction }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actionRef = useRef(action);
  actionRef.current = action;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    let columns: number[] = [];
    let animationId = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const resize = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.font = "12px ui-monospace, SFMono-Regular, monospace";
      columns = Array.from({ length: Math.ceil(width / 22) }, () => Math.random() * height / 12);
      if (reducedMotion.matches) draw(true);
    };

    const draw = (staticFrame = false) => {
      context.fillStyle = "rgba(3, 5, 4, 0.1)";
      context.fillRect(0, 0, width, height);
      context.fillStyle = COLORS[actionRef.current];
      context.globalAlpha = 0.28;
      context.font = "12px ui-monospace, SFMono-Regular, monospace";
      columns.forEach((position, index) => {
        const character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
        context.fillText(character, index * 22, position * 12);
        if (!staticFrame) {
          columns[index] = position * 12 > height && Math.random() > 0.98
            ? 0
            : position + 0.22 + Math.random() * 0.42;
        }
      });
      context.globalAlpha = 1;
      if (!staticFrame && !reducedMotion.matches) {
        frame += 1;
        if (frame % 2 === 0) animationId = window.requestAnimationFrame(() => draw());
        else animationId = window.requestAnimationFrame(() => draw());
      }
    };

    const handleMotionChange = () => {
      window.cancelAnimationFrame(animationId);
      if (reducedMotion.matches) draw(true);
      else draw();
    };
    resize();
    if (!reducedMotion.matches) draw();
    window.addEventListener("resize", resize);
    reducedMotion.addEventListener("change", handleMotionChange);
    return () => {
      window.removeEventListener("resize", resize);
      reducedMotion.removeEventListener("change", handleMotionChange);
      window.cancelAnimationFrame(animationId);
    };
  }, []);

  return <canvas ref={canvasRef} className="digital-rain" aria-hidden="true" />;
}
