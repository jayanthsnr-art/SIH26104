"use client";

import { useEffect, useRef } from "react";
import { AudioLines, Fingerprint, Gauge, Waves, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RiskSnapshot } from "@/lib/reso-guard-types";

interface EvidenceRowProps {
  label: string;
  value: number | null;
  icon: LucideIcon;
  color: "green" | "cyan" | "amber" | "red";
}

function EvidenceRow({ label, value, icon: Icon, color }: EvidenceRowProps) {
  const normalized = value === null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div className="evidence-row">
      <div className="evidence-meta">
        <span className="evidence-name"><Icon aria-hidden="true" />{label}</span>
        <strong className={value === null ? "evidence-na" : ""}>{value === null ? "n/a" : `${Math.round(value * 100)}%`}</strong>
      </div>
      <div className="evidence-track" aria-hidden="true">
        <span className={`evidence-fill evidence-${color}`} style={{ width: `${normalized * 100}%` }} />
      </div>
    </div>
  );
}

function WaveformCanvas({ samples, active }: { samples: number[]; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const samplesRef = useRef(samples);
  samplesRef.current = samples;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let animationId = 0;
    let phase = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      context.strokeStyle = "rgba(87, 125, 125, 0.12)";
      context.lineWidth = 1;
      for (let x = 0; x < width; x += 26) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      context.beginPath();
      context.moveTo(0, height / 2);
      context.lineTo(width, height / 2);
      context.strokeStyle = "rgba(87, 125, 125, 0.2)";
      context.stroke();

      const values = samplesRef.current.length ? samplesRef.current : [];
      const count = Math.max(28, Math.floor(width / 8));
      const color = "#62ead2";
      context.fillStyle = color;
      for (let index = 0; index < count; index += 1) {
        const source = values.length ? values[Math.floor((index / count) * values.length)] ?? 0 : 0;
        const idle = active ? 0.025 : 0.012;
        const animation = active && !reducedMotion.matches ? Math.abs(Math.sin(phase + index * 0.43)) * 0.055 : 0;
        const amplitude = Math.min(1, Math.max(idle, source * 0.72 + animation));
        const barHeight = Math.max(2, amplitude * (height * 0.82));
        const x = (index / count) * width;
        context.globalAlpha = active ? 0.76 : 0.3;
        context.fillRect(x, (height - barHeight) / 2, Math.max(2, width / count - 3), barHeight);
      }
      context.globalAlpha = 1;
      phase += 0.09;
      if (active && !reducedMotion.matches) {
        frame += 1;
        if (frame % 2 === 0) animationId = window.requestAnimationFrame(draw);
        else animationId = window.requestAnimationFrame(draw);
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    if (active && !reducedMotion.matches) animationId = window.requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationId);
    };
  }, [active]);

  return <canvas ref={canvasRef} className="waveform-canvas" role="img" aria-label={active ? "Live voice activity waveform" : "Voice activity visualizer idle"} />;
}

export function EvidenceCard({ snapshot, waveform, active }: { snapshot: RiskSnapshot; waveform: number[]; active: boolean }) {
  return (
    <Card className="glass-card evidence-card">
      <CardHeader className="card-heading-row">
        <div>
          <p className="section-kicker">03 / SIGNAL BREAKDOWN</p>
          <CardTitle className="card-title">Evidence layers</CardTitle>
          <CardDescription className="card-copy">Independent signals contributing to fused probability p.</CardDescription>
        </div>
        <span className="icon-chip"><Waves aria-hidden="true" /></span>
      </CardHeader>
      <CardContent className="evidence-content">
        <div className="evidence-list">
          <EvidenceRow label="Acoustic artifacts" value={snapshot.acoustic} icon={AudioLines} color="cyan" />
          <EvidenceRow label="Prosody and behaviour" value={snapshot.prosody} icon={Gauge} color="amber" />
          <EvidenceRow label="Speaker mismatch" value={snapshot.speaker} icon={Fingerprint} color="red" />
          <EvidenceRow label="Context prior" value={snapshot.prior} icon={Waves} color="green" />
        </div>
        <div className="waveform-header">
          <span>VOICE ACTIVITY</span>
          <span className={active ? "waveform-live" : "waveform-idle"}>{active ? "STREAMING" : "STANDBY"}</span>
        </div>
        <WaveformCanvas samples={waveform} active={active} />
      </CardContent>
    </Card>
  );
}
