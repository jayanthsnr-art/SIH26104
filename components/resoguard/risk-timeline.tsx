"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PolicyThresholds } from "@/lib/reso-guard-types";

export function RiskTimeline({ points, thresholds }: { points: number[]; thresholds: PolicyThresholds }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const thresholdsRef = useRef(thresholds);
  thresholdsRef.current = thresholds;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    const draw = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const left = 38;
      const right = 12;
      const top = 12;
      const bottom = 24;
      const chartWidth = Math.max(1, width - left - right);
      const chartHeight = Math.max(1, height - top - bottom);
      const yFor = (value: number) => top + (1 - Math.max(0, Math.min(1, value))) * chartHeight;
      const xFor = (index: number, count: number) => left + (count <= 1 ? chartWidth : (index / (count - 1)) * chartWidth);

      context.font = "10px ui-monospace, SFMono-Regular, monospace";
      context.textAlign = "right";
      context.textBaseline = "middle";
      [0, 0.5, 1].forEach((value) => {
        const y = yFor(value);
        context.beginPath();
        context.setLineDash([]);
        context.strokeStyle = "rgba(125, 169, 166, 0.12)";
        context.moveTo(left, y);
        context.lineTo(width - right, y);
        context.stroke();
        context.fillStyle = "#809b99";
        context.fillText(value.toFixed(1), left - 8, y);
      });

      const thresholdLines = [
        { value: thresholdsRef.current.mfaAt, color: "#ffc857", label: "MFA" },
        { value: thresholdsRef.current.freezeAt, color: "#ff5964", label: "FREEZE" },
      ];
      thresholdLines.forEach((line) => {
        const y = yFor(line.value);
        context.beginPath();
        context.setLineDash([5, 5]);
        context.strokeStyle = line.color;
        context.globalAlpha = 0.78;
        context.moveTo(left, y);
        context.lineTo(width - right, y);
        context.stroke();
        context.setLineDash([]);
        context.globalAlpha = 1;
        context.fillStyle = line.color;
        context.textAlign = "left";
        context.fillText(line.label, left + 6, Math.max(top + 7, y - 8));
      });
      context.setLineDash([]);

      const values = pointsRef.current;
      if (values.length) {
        const gradient = context.createLinearGradient(0, top, 0, height - bottom);
        gradient.addColorStop(0, "rgba(97, 234, 210, 0.26)");
        gradient.addColorStop(1, "rgba(97, 234, 210, 0.01)");
        context.beginPath();
        values.forEach((value, index) => {
          const x = xFor(index, values.length);
          const y = yFor(value);
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        if (values.length === 1) context.lineTo(left + 2, yFor(values[0] ?? 0));
        context.lineTo(xFor(values.length - 1, values.length), height - bottom);
        context.lineTo(left, height - bottom);
        context.closePath();
        context.fillStyle = gradient;
        context.fill();

        context.beginPath();
        values.forEach((value, index) => {
          const x = xFor(index, values.length);
          const y = yFor(value);
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.strokeStyle = "#62ead2";
        context.lineWidth = 2;
        context.shadowBlur = 9;
        context.shadowColor = "rgba(98, 234, 210, 0.36)";
        context.stroke();
        context.shadowBlur = 0;
      }

      context.fillStyle = "#708b89";
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      context.fillText("0", left, height - 5);
      context.textAlign = "right";
      context.fillText(`${pointsRef.current.length} / 100 chunks`, width - right, height - 5);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [points, thresholds]);

  return (
    <Card className="glass-card timeline-card">
      <CardHeader className="card-heading-row">
        <div>
          <p className="section-kicker">04 / TEMPORAL TRACE</p>
          <CardTitle className="card-title">Risk timeline</CardTitle>
          <CardDescription className="card-copy">Smoothed R(t) · most recent 100 scored audio chunks.</CardDescription>
        </div>
        <div className="chart-legend" aria-label="Threshold legend">
          <span><i className="legend-mfa" /> MFA {thresholds.mfaAt.toFixed(2)}</span>
          <span><i className="legend-freeze" /> Freeze {thresholds.freezeAt.toFixed(2)}</span>
        </div>
      </CardHeader>
      <CardContent>
        <canvas ref={canvasRef} className="timeline-canvas" role="img" aria-label={`Risk score timeline with MFA threshold ${thresholds.mfaAt.toFixed(2)} and freeze threshold ${thresholds.freezeAt.toFixed(2)}. ${points.length} scored chunks.`} />
      </CardContent>
    </Card>
  );
}
