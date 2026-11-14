"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import type {
  AuditResult,
  CallReport,
  CallSettings,
  DemoProfile,
  PolicyThresholds,
  RiskAction,
  RiskSnapshot,
  ScoreMessage,
  SessionStatus,
} from "@/lib/reso-guard-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "") ?? "";
const CHUNK_SAMPLES = 2048;
const ENROLLMENT_SAMPLES = 16_000 * 5;
const initialSnapshot: RiskSnapshot = {
  p: 0,
  R: 0,
  action: "ALLOW",
  acoustic: null,
  prosody: null,
  speaker: null,
  prior: null,
  ms: null,
  alerts: [],
  warning: null,
};

const healthFetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Backend health check failed");
  const data = (await response.json()) as {
    ok: boolean;
    detector: string;
    speaker_backend: string;
  };
  if (!data.ok) throw new Error("Backend reported unhealthy");
  return data;
};

interface AudioCapture {
  stream: MediaStream;
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: AudioWorkletNode | ScriptProcessorNode;
  mutedOutput: GainNode;
}

interface ScoreStats {
  count: number;
  totalMs: number;
  peakRisk: number | null;
  firstMfaSeconds: number | null;
  frozenSeconds: number | null;
}

const initialStats = (): ScoreStats => ({
  count: 0,
  totalMs: 0,
  peakRisk: null,
  firstMfaSeconds: null,
  frozenSeconds: null,
});

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function downsampleWaveform(samples: Float32Array, points = 72) {
  const stride = Math.max(1, Math.floor(samples.length / points));
  const result: number[] = [];
  for (let index = 0; index < points; index += 1) {
    const start = index * stride;
    const end = Math.min(samples.length, start + stride);
    let peak = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      peak = Math.max(peak, Math.abs(samples[cursor] ?? 0));
    }
    result.push(peak);
  }
  return result;
}

function calculatePrior(settings: CallSettings) {
  let prior = 0;
  if (["unknown", "international", "voip"].includes(settings.origin)) prior += 0.1;
  if (!settings.knownContact) prior += 0.08;
  if (settings.amount >= 100_000) prior += 0.08;
  return Math.min(prior, 0.3);
}

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function useResoGuard(
  settings: CallSettings,
  previewThresholds: PolicyThresholds,
  demoProfile: DemoProfile,
) {
  const { data: backend, error: healthError, isLoading: checkingHealth } = useSWR(
    API_BASE ? `${API_BASE}/health` : null,
    healthFetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: true, shouldRetryOnError: false },
  );
  const demoMode = !API_BASE || Boolean(healthError);
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [snapshot, setSnapshot] = useState<RiskSnapshot>(initialSnapshot);
  const [thresholds, setThresholds] = useState<PolicyThresholds>(previewThresholds);
  const [timeline, setTimeline] = useState<number[]>([]);
  const [report, setReport] = useState<CallReport>({
    peakRisk: null,
    firstMfaSeconds: null,
    frozenSeconds: null,
    chunksScored: 0,
    averageProcessingMs: null,
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const captureRef = useRef<AudioCapture | null>(null);
  const simulationRef = useRef<number | null>(null);
  const clockRef = useRef<number | null>(null);
  const clockStartRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const runIdRef = useRef(0);
  const manuallyStoppedRef = useRef(false);
  const scoreStatsRef = useRef<ScoreStats>(initialStats());
  const simulationStateRef = useRef({ risk: 0, hot: 0, frozen: false, tick: 0 });
  const thresholdsRef = useRef(previewThresholds);
  const settingsRef = useRef(settings);
  const profileRef = useRef(demoProfile);
  thresholdsRef.current = previewThresholds;
  settingsRef.current = settings;
  profileRef.current = demoProfile;

  useEffect(() => {
    if (status === "idle") setThresholds(previewThresholds);
  }, [previewThresholds, status]);

  const beginClock = useCallback(() => {
    if (clockRef.current) window.clearInterval(clockRef.current);
    clockStartRef.current = Date.now();
    elapsedRef.current = 0;
    setElapsedSeconds(0);
    clockRef.current = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - (clockStartRef.current ?? Date.now())) / 1000);
      elapsedRef.current = seconds;
      setElapsedSeconds(seconds);
    }, 1000);
  }, []);

  const clearClock = useCallback(() => {
    if (clockRef.current) window.clearInterval(clockRef.current);
    clockRef.current = null;
    if (clockStartRef.current !== null) {
      elapsedRef.current = Math.floor((Date.now() - clockStartRef.current) / 1000);
      setElapsedSeconds(elapsedRef.current);
    }
    clockStartRef.current = null;
  }, []);

  const closeCapture = useCallback(async () => {
    const capture = captureRef.current;
    captureRef.current = null;
    if (!capture) return;
    capture.processor.disconnect();
    capture.source.disconnect();
    capture.mutedOutput.disconnect();
    capture.stream.getTracks().forEach((track) => track.stop());
    if (capture.context.state !== "closed") {
      await capture.context.close().catch(() => undefined);
    }
  }, []);

  const createCapture = useCallback(async (onSamples: (samples: Float32Array) => void) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone access is not available in this browser. Use a secure HTTPS page.");
    }

    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let processor: AudioWorkletNode | ScriptProcessorNode | null = null;
    let mutedOutput: GainNode | null = null;
    let moduleUrl: string | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, channelCount: 1 },
      });
      context = new AudioContext({ sampleRate: 16_000 });
      if (context.sampleRate !== 16_000) {
        throw new Error("This browser could not start a 16 kHz audio context. Try a current desktop browser.");
      }
      source = context.createMediaStreamSource(stream);
      mutedOutput = context.createGain();
      mutedOutput.gain.value = 0;

      if (context.audioWorklet) {
        const workletSource = `
          class ResoGuardCapture extends AudioWorkletProcessor {
            constructor() {
              super();
              this.pending = new Float32Array(${CHUNK_SAMPLES});
              this.offset = 0;
            }
            process(inputs) {
              const input = inputs[0] && inputs[0][0];
              if (!input) return true;
              let cursor = 0;
              while (cursor < input.length) {
                const length = Math.min(input.length - cursor, this.pending.length - this.offset);
                this.pending.set(input.subarray(cursor, cursor + length), this.offset);
                cursor += length;
                this.offset += length;
                if (this.offset === this.pending.length) {
                  const packet = this.pending;
                  this.pending = new Float32Array(${CHUNK_SAMPLES});
                  this.offset = 0;
                  this.port.postMessage(packet.buffer, [packet.buffer]);
                }
              }
              return true;
            }
          }
          registerProcessor("reso-guard-capture", ResoGuardCapture);
        `;
        moduleUrl = URL.createObjectURL(new Blob([workletSource], { type: "text/javascript" }));
        await context.audioWorklet.addModule(moduleUrl);
        processor = new AudioWorkletNode(context, "reso-guard-capture", {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });
        processor.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
          onSamples(new Float32Array(event.data));
        };
      } else {
        const scriptProcessor = context.createScriptProcessor(CHUNK_SAMPLES, 1, 1);
        scriptProcessor.onaudioprocess = (event) => {
          onSamples(new Float32Array(event.inputBuffer.getChannelData(0)));
        };
        processor = scriptProcessor;
      }

      source.connect(processor);
      processor.connect(mutedOutput);
      mutedOutput.connect(context.destination);
      const capture = { stream, context, source, processor, mutedOutput };
      captureRef.current = capture;
      return capture;
    } catch (error) {
      if (moduleUrl) URL.revokeObjectURL(moduleUrl);
      processor?.disconnect();
      source?.disconnect();
      mutedOutput?.disconnect();
      stream?.getTracks().forEach((track) => track.stop());
      if (context && context.state !== "closed") await context.close().catch(() => undefined);
      throw error;
    } finally {
      if (moduleUrl) URL.revokeObjectURL(moduleUrl);
    }
  }, []);

  const resetSession = useCallback(() => {
    scoreStatsRef.current = initialStats();
    simulationStateRef.current = { risk: 0, hot: 0, frozen: false, tick: 0 };
    elapsedRef.current = 0;
    setSnapshot(initialSnapshot);
    setTimeline([]);
    setWaveform([]);
    setReport({
      peakRisk: null,
      firstMfaSeconds: null,
      frozenSeconds: null,
      chunksScored: 0,
      averageProcessingMs: null,
    });
    setElapsedSeconds(0);
    setNotice(null);
  }, []);

  const stop = useCallback(() => {
    runIdRef.current += 1;
    manuallyStoppedRef.current = true;
    if (simulationRef.current) window.clearInterval(simulationRef.current);
    simulationRef.current = null;
    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.onerror = null;
      socketRef.current.onmessage = null;
      socketRef.current.close(1000, "Call monitoring stopped");
    }
    socketRef.current = null;
    void closeCapture();
    clearClock();
    setStatus("idle");
  }, [clearClock, closeCapture]);

  const recordResult = useCallback((message: ScoreMessage) => {
    if (!Number.isFinite(message.R) || !Number.isFinite(message.p)) return;
    const timestamp = Date.now();
    const stats = scoreStatsRef.current;
    stats.count += 1;
    stats.totalMs += Number.isFinite(message.ms) ? (message.ms ?? 0) : 0;
    stats.peakRisk = Math.max(stats.peakRisk ?? 0, clamp(message.R));
    const elapsed = Math.floor((timestamp - (clockStartRef.current ?? timestamp)) / 1000);
    if (message.action === "STEP_UP_MFA" && stats.firstMfaSeconds === null) {
      stats.firstMfaSeconds = elapsed;
    }
    if (message.action === "FREEZE" && stats.frozenSeconds === null) {
      stats.frozenSeconds = elapsed;
    }

    setSnapshot((current) => ({
      ...message,
      R: clamp(message.R),
      p: clamp(message.p),
      warning: message.warning ?? null,
      alerts: current.alerts,
    }));
    setTimeline((current) => [...current, clamp(message.R)].slice(-100));
    setReport({
      peakRisk: stats.peakRisk,
      firstMfaSeconds: stats.firstMfaSeconds,
      frozenSeconds: stats.frozenSeconds,
      chunksScored: stats.count,
      averageProcessingMs: stats.count ? stats.totalMs / stats.count : null,
    });

    if (message.alerts?.length) {
      const nextAlerts = message.alerts.map((alert, index) => ({
        ...alert,
        id: `${timestamp}-${index}`,
        action: message.action,
        timestamp,
      }));
      setSnapshot((current) => ({ ...current, alerts: [...nextAlerts, ...current.alerts].slice(0, 40) }));
    }
  }, []);

  const startDemo = useCallback(() => {
    const runId = runIdRef.current;
    const currentSettings = settingsRef.current;
    const currentThresholds = thresholdsRef.current;
    const state = simulationStateRef.current;
    state.risk = calculatePrior(currentSettings);
    setThresholds(currentThresholds);
    beginClock();
    setStatus("listening");
    setNotice(`Demo simulation · ${profileRef.current === "genuine" ? "Genuine caller" : profileRef.current === "cloned" ? "Cloned caller" : "Genuine caller, then a clone takes over"}. No microphone audio is captured or sent.`);

    const previousAction = { value: "ALLOW" as RiskAction };
    simulationRef.current = window.setInterval(() => {
      if (runId !== runIdRef.current) return;
      const simulation = simulationStateRef.current;
      simulation.tick += 1;
      const takeoverPoint = 9;
      const cloned = profileRef.current === "cloned" || (profileRef.current === "takeover" && simulation.tick > takeoverPoint);
      const raw = cloned ? 0.88 + Math.random() * 0.1 : 0.06 + Math.random() * 0.12;
      const acoustic = clamp(cloned ? raw - 0.06 : raw * 0.7);
      const prosody = clamp(cloned ? 0.65 + Math.random() * 0.2 : raw * 0.9);
      const speaker = cloned ? 0.82 + Math.random() * 0.16 : 0.05 + Math.random() * 0.08;
      const p = clamp(acoustic * 0.7 + prosody * 0.15 + speaker * 0.15);
      simulation.risk = 0.35 * p + 0.65 * simulation.risk;
      simulation.hot = simulation.risk >= currentThresholds.freezeAt ? simulation.hot + 1 : 0;
      if (simulation.hot >= 3) simulation.frozen = true;
      const action: RiskAction = simulation.frozen
        ? "FREEZE"
        : simulation.risk >= currentThresholds.mfaAt
          ? "STEP_UP_MFA"
          : "ALLOW";
      const actionChanged = previousAction.value !== action;
      previousAction.value = action;
      const channels = action === "STEP_UP_MFA"
        ? ["ui", "sms_customer"]
        : action === "FREEZE"
          ? ["ui", "sms_customer", "email_supervisor", "webhook", "block_transaction"]
          : [];
      const warning = action === "STEP_UP_MFA"
        ? "Demo simulation: possible synthetic voice. Verify the caller by callback or MFA before continuing."
        : action === "FREEZE"
          ? "Demo simulation: high voice-clone risk. The transfer is blocked and escalated to a supervisor."
          : null;
      const alertMessages = actionChanged && action !== "ALLOW"
        ? channels.map((channel) => ({ channel, action, timestamp: Date.now(), id: `${Date.now()}-${channel}`, text: warning ?? undefined }))
        : [];
      if (profileRef.current === "takeover" && simulation.tick === takeoverPoint + 1) {
        setNotice("Demo simulation · clone takeover detected. Scores are simulated; no microphone audio is captured or sent.");
      }
      const demoResult: ScoreMessage = {
        p,
        R: simulation.risk,
        action,
        acoustic,
        prosody,
        speaker,
        prior: calculatePrior(currentSettings),
        ms: 7 + Math.random() * 20,
        alerts: alertMessages,
        warning,
      };
      recordResult(demoResult);
      setWaveform(Array.from({ length: 72 }, (_, index) => {
        const envelope = 0.12 + Math.abs(Math.sin(index * 0.39 + simulation.tick * 0.45)) * 0.65;
        return Math.min(1, envelope * (0.35 + Math.random() * 0.65));
      }));
    }, 550);
  }, [beginClock, recordResult]);

  const start = useCallback(() => {
    if (status !== "idle") return;
    setErrorMessage(null);
    manuallyStoppedRef.current = false;
    runIdRef.current += 1;
    const runId = runIdRef.current;
    resetSession();
    if (demoMode) {
      startDemo();
      return;
    }

    const params = new URLSearchParams({
      scenario: settingsRef.current.scenario,
      origin: settingsRef.current.origin,
      known_contact: String(settingsRef.current.knownContact),
      amount: String(settingsRef.current.amount),
      lang: settingsRef.current.language,
      caller_id: settingsRef.current.callerId.trim() || "demo-caller",
    });
    const socketUrl = `${API_BASE.replace(/^http/, "ws")}/ws?${params.toString()}`;
    setStatus("connecting");
    setNotice("Connecting to the ResoGuard backend; scores will only appear after it responds.");

    let socket: WebSocket;
    try {
      socket = new WebSocket(socketUrl);
    } catch {
      setStatus("idle");
      setErrorMessage("The live connection could not be created. Check the backend URL and try again.");
      return;
    }
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    socket.onopen = () => {
      if (runId !== runIdRef.current) {
        socket.close(1000, "Session was stopped");
        return;
      }
      void createCapture((samples) => {
        if (runId !== runIdRef.current) return;
        const level = downsampleWaveform(samples);
        setWaveform(level);
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(samples.buffer);
        }
      }).then(() => {
        if (runId !== runIdRef.current || socket.readyState !== WebSocket.OPEN) {
          void closeCapture();
          return;
        }
        beginClock();
        setStatus("listening");
        setNotice("Live mode · microphone audio is streaming to the ResoGuard backend for scoring.");
      }).catch((error: unknown) => {
        manuallyStoppedRef.current = true;
        socket.onclose = null;
        socket.close(1000, "Microphone unavailable");
        setStatus("idle");
        const message = error instanceof Error ? error.message : "Microphone access failed.";
        const errorName = error instanceof DOMException ? error.name : "";
        setErrorMessage(errorName === "NotAllowedError" || message.toLowerCase().includes("permission") || message.toLowerCase().includes("denied")
          ? "Microphone permission was denied. Allow microphone access in your browser and try again."
          : message);
      });
    };

    socket.onmessage = (event) => {
      if (runId !== runIdRef.current || typeof event.data !== "string") return;
      try {
        const message = JSON.parse(event.data) as ScoreMessage & {
          session?: string;
          policy?: { mfa_at: number; freeze_at: number };
          prior?: number;
        };
        if (message.session && message.policy) {
          setThresholds({ mfaAt: message.policy.mfa_at, freezeAt: message.policy.freeze_at });
          setSnapshot((current) => ({ ...current, prior: message.prior ?? null }));
          setNotice(`Live session ${message.session} · backend policy ${message.policy.mfa_at.toFixed(2)} MFA / ${message.policy.freeze_at.toFixed(2)} freeze.`);
          return;
        }
        recordResult(message);
      } catch {
        setErrorMessage("The backend returned an unreadable scoring response. Stop the call and reconnect.");
      }
    };

    socket.onerror = () => {
      if (runId === runIdRef.current) {
        setErrorMessage("The live WebSocket connection failed. Check the backend URL and its allowed CORS/WebSocket origins.");
      }
    };

    socket.onclose = () => {
      if (runId !== runIdRef.current || manuallyStoppedRef.current) return;
      manuallyStoppedRef.current = true;
      setErrorMessage("The backend closed the live audio connection. Your microphone has been stopped.");
      setStatus("idle");
      void closeCapture();
      clearClock();
    };
  }, [beginClock, clearClock, closeCapture, createCapture, demoMode, recordResult, resetSession, startDemo, status]);

  const enroll = useCallback(async () => {
    if (status !== "idle") return;
    setErrorMessage(null);
    setNotice(null);
    if (demoMode) {
      setNotice("Demo mode: voice enrollment needs a connected backend. No microphone audio was captured.");
      return;
    }

    const callerId = settingsRef.current.callerId.trim();
    if (!callerId) {
      setErrorMessage("Enter a caller ID before enrolling a voice.");
      return;
    }

    const runId = ++runIdRef.current;
    manuallyStoppedRef.current = false;
    setStatus("enrolling");
    setNotice("Enrollment runs for 5 seconds. Speak naturally; the audio is sent to the backend and is not stored by this app.");
    const parts: Float32Array[] = [];
    let captured = 0;
    let completed = false;

    const finishEnrollment = async () => {
      if (completed || captured < ENROLLMENT_SAMPLES || runId !== runIdRef.current) return;
      completed = true;
      await closeCapture();
      setStatus("idle");
      const audio = new Float32Array(ENROLLMENT_SAMPLES);
      let offset = 0;
      for (const part of parts) {
        const length = Math.min(part.length, audio.length - offset);
        audio.set(part.subarray(0, length), offset);
        offset += length;
        if (offset >= audio.length) break;
      }
      try {
        const response = await fetch(`${API_BASE}/enroll/${encodeURIComponent(callerId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: audio.buffer,
        });
        if (!response.ok) throw new Error("Enrollment request was rejected");
        const result = (await response.json()) as { enrolled: string; backend: string };
        setNotice(`Voice enrolled for ${result.enrolled} · speaker backend ${result.backend}.`);
      } catch {
        setErrorMessage("Voice enrollment could not reach the backend. No enrollment was confirmed.");
      }
    };

    try {
      await createCapture((samples) => {
        if (runId !== runIdRef.current || completed) return;
        const remaining = ENROLLMENT_SAMPLES - captured;
        const part = samples.slice(0, Math.min(samples.length, remaining));
        parts.push(part);
        captured += part.length;
        setWaveform(downsampleWaveform(samples));
        if (captured >= ENROLLMENT_SAMPLES) void finishEnrollment();
      });
      if (runId !== runIdRef.current) void closeCapture();
    } catch (error) {
      setStatus("idle");
      const message = error instanceof Error ? error.message : "Microphone access failed.";
      const errorName = error instanceof DOMException ? error.name : "";
      setErrorMessage(errorName === "NotAllowedError" || message.toLowerCase().includes("permission") || message.toLowerCase().includes("denied")
        ? "Microphone permission was denied. Allow microphone access in your browser and try again."
        : message);
    }
  }, [closeCapture, createCapture, demoMode, status]);

  const verifyAudit = useCallback(async (): Promise<AuditResult | null> => {
    if (demoMode) {
      setErrorMessage("Audit verification is unavailable in demo mode; connect the backend to read its audit chain.");
      return null;
    }
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE}/audit`, { cache: "no-store" });
      if (!response.ok) throw new Error("Audit request failed");
      return (await response.json()) as AuditResult;
    } catch {
      setErrorMessage("Audit verification could not reach the backend.");
      return null;
    }
  }, [demoMode]);

  const tamperAudit = useCallback(async (): Promise<AuditResult | null> => {
    if (demoMode) {
      setErrorMessage("Audit tampering is unavailable in demo mode; connect the backend to use its demo endpoint.");
      return null;
    }
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE}/audit/tamper`, { method: "POST" });
      if (!response.ok) throw new Error("Tamper request failed");
      const result = (await response.json()) as { intact: boolean };
      const auditResult = await verifyAudit();
      if (auditResult) return { ...auditResult, intact: result.intact && auditResult.intact };
      return { intact: result.intact, count: 0, last: [], merkle_root: "" };
    } catch {
      setErrorMessage("The audit tamper demonstration could not reach the backend.");
      return null;
    }
  }, [demoMode, verifyAudit]);

  useEffect(() => () => {
    runIdRef.current += 1;
    if (simulationRef.current) window.clearInterval(simulationRef.current);
    if (clockRef.current) window.clearInterval(clockRef.current);
    socketRef.current?.close(1000, "Dashboard unmounted");
    const capture = captureRef.current;
    captureRef.current = null;
    capture?.processor.disconnect();
    capture?.source.disconnect();
    capture?.mutedOutput.disconnect();
    capture?.stream.getTracks().forEach((track) => track.stop());
    if (capture && capture.context.state !== "closed") void capture.context.close();
  }, []);

  return {
    apiBase: API_BASE,
    backend,
    backendError: Boolean(healthError),
    checkingHealth: Boolean(API_BASE && checkingHealth),
    demoMode,
    status,
    snapshot,
    thresholds,
    timeline,
    report,
    elapsedSeconds,
    elapsedText: formatClock(elapsedSeconds),
    waveform,
    errorMessage,
    notice,
    hasScores: report.chunksScored > 0,
    start,
    stop,
    enroll,
    verifyAudit,
    tamperAudit,
    setErrorMessage,
  };
}
