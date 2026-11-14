"use client";

import { useState } from "react";
import { Activity, BadgeCheck, CircleStop, Mic, Radio, Shield, ShieldCheck, ShieldX, Waves } from "lucide-react";
import { AuditPanel, AlertsPanel, ReportPanel, TransactionGate } from "@/components/resoguard/monitor-panels";
import { CallSetup } from "@/components/resoguard/call-setup";
import { DigitalRain } from "@/components/resoguard/digital-rain";
import { EvidenceCard } from "@/components/resoguard/evidence-card";
import { RiskGauge } from "@/components/resoguard/risk-gauge";
import { RiskTimeline } from "@/components/resoguard/risk-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useResoGuard } from "@/hooks/use-resoguard";
import type { AuditResult, CallSettings, DemoProfile, PolicyThresholds, RiskAction } from "@/lib/reso-guard-types";

const DEFAULT_SETTINGS: CallSettings = {
  scenario: "default",
  origin: "known",
  knownContact: true,
  amount: 0,
  language: "en",
  callerId: "demo-caller",
};

const DEFAULT_THRESHOLDS: PolicyThresholds = { mfaAt: 0.4, freezeAt: 0.7 };

function actionStatus(action: RiskAction) {
  if (action === "FREEZE") return <ShieldX aria-hidden="true" />;
  if (action === "STEP_UP_MFA") return <Shield aria-hidden="true" />;
  return <ShieldCheck aria-hidden="true" />;
}

export function ResoGuardDashboard() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [previewThresholds, setPreviewThresholds] = useState(DEFAULT_THRESHOLDS);
  const [demoProfile, setDemoProfile] = useState<DemoProfile>("takeover");
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditBusy, setAuditBusy] = useState(false);
  const monitor = useResoGuard(settings, previewThresholds, demoProfile);
  const active = monitor.status !== "idle";
  const backendAvailable = Boolean(monitor.backend) && !monitor.backendError;

  const verifyAudit = async () => {
    setAuditBusy(true);
    const result = await monitor.verifyAudit();
    if (result) setAuditResult(result);
    setAuditBusy(false);
  };

  const tamperAudit = async () => {
    if (!window.confirm("This changes the backend's first audit entry and can break the demo chain. Continue?")) return;
    setAuditBusy(true);
    const result = await monitor.tamperAudit();
    if (result) setAuditResult(result);
    setAuditBusy(false);
  };

  const backendLabel = monitor.checkingHealth
    ? "CHECKING BACKEND"
    : backendAvailable
      ? `BACKEND CONNECTED · ${monitor.backend?.detector ?? "DETECTOR"}`
      : "BACKEND OFFLINE";
  const backendClass = monitor.checkingHealth ? "backend-checking" : backendAvailable ? "backend-online" : "backend-offline";

  return (
    <div className="dashboard-shell" data-risk={monitor.snapshot.action}>
      <DigitalRain action={monitor.snapshot.action} />
      <div className="screen-vignette" aria-hidden="true" />
      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true"><Waves /></div>
            <div>
              <p className="brand-title">RESOGUARD<span>-AI</span></p>
              <p className="brand-subtitle">VOICE AUTHENTICITY MONITOR · SIH26104</p>
            </div>
          </div>
          <Badge variant="outline" className={`backend-badge ${backendClass}`} aria-live="polite">
            <span className="status-pip" aria-hidden="true" />
            {backendLabel}
          </Badge>
        </header>

        <section className="dashboard-intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow"><span className="eyebrow-line" />SECURITY OPERATIONS / LIVE CALL DEFENSE</p>
            <h1 id="page-title">Verify the voice.<br /><span>Protect the signal.</span></h1>
            <p className="intro-copy">Real-time voice-clone risk monitoring for high-stakes conversations and transactions.</p>
          </div>
          <div className="intro-status" aria-label="Current monitoring state">
            <span className="intro-status-icon">{actionStatus(monitor.snapshot.action)}</span>
            <div><span>RISK ACTION</span><strong>{monitor.snapshot.action.replaceAll("_", " ")}</strong></div>
            <Activity aria-hidden="true" className="intro-wave" />
          </div>
        </section>

        {monitor.demoMode && (
          <div className="demo-banner" role="status" aria-live="polite">
            <div className="demo-banner-icon"><Radio aria-hidden="true" /></div>
            <div><strong>Demo mode: backend offline, scores are simulated</strong><span>Choose a demo caller profile below. Simulated risk is never presented as a live backend score.</span></div>
            <Badge variant="outline" className="demo-tag">SIMULATION</Badge>
          </div>
        )}

        {monitor.errorMessage && (
          <div className="app-alert" role="alert" aria-live="assertive">
            <ShieldX aria-hidden="true" /><p>{monitor.errorMessage}</p>
            <button type="button" className="alert-dismiss" onClick={() => monitor.setErrorMessage(null)} aria-label="Dismiss message">×</button>
          </div>
        )}

        {monitor.notice && (
          <div className={`session-notice ${monitor.demoMode ? "notice-demo" : ""}`} role="status" aria-live="polite">
            <span className="notice-pip" aria-hidden="true" />{monitor.notice}
          </div>
        )}

        <main className="dashboard-main">
          <CallSetup
            settings={settings}
            onSettingsChange={setSettings}
            previewThresholds={previewThresholds}
            onPreviewThresholdsChange={setPreviewThresholds}
            demoProfile={demoProfile}
            onDemoProfileChange={setDemoProfile}
            demoMode={monitor.demoMode}
            active={active}
          />

          <div className="dashboard-columns">
            <div className="dashboard-column">
              <RiskGauge
                snapshot={monitor.snapshot}
                elapsedText={monitor.elapsedText}
                status={monitor.status}
                hasScores={monitor.hasScores}
              />
              <EvidenceCard snapshot={monitor.snapshot} waveform={monitor.waveform} active={active} />
              <section className="glass-card action-card" aria-label="Call actions">
                <div className="action-card-copy">
                  <p className="section-kicker">AUDIO SESSION</p>
                  <strong>{monitor.status === "listening" ? "Call monitor active" : monitor.status === "connecting" ? "Establishing secure stream" : monitor.status === "enrolling" ? "Capturing enrollment sample" : "Ready to monitor"}</strong>
                  <span>{backendAvailable ? "PCM · 16 kHz · mono" : "Offline simulation · no microphone"}</span>
                </div>
                <div className="session-actions">
                  <Button type="button" variant="outline" className="secondary-button" onClick={monitor.enroll} disabled={active || monitor.checkingHealth}>
                    <Mic data-icon="inline-start" /> Enrol my voice <span className="button-duration">(5 s)</span>
                  </Button>
                  <Button type="button" className="action-button" onClick={monitor.start} disabled={active || monitor.checkingHealth}>
                    <Radio data-icon="inline-start" /> Start listening
                  </Button>
                  <Button type="button" variant="outline" className="stop-button" onClick={monitor.stop} disabled={!active}>
                    <CircleStop data-icon="inline-start" /> Stop
                  </Button>
                </div>
              </section>
              <RiskTimeline points={monitor.timeline} thresholds={monitor.thresholds} />
            </div>

            <div className="dashboard-column">
              <TransactionGate snapshot={monitor.snapshot} hasScores={monitor.hasScores} />
              <AlertsPanel alerts={monitor.snapshot.alerts} />
              <ReportPanel report={monitor.report} />
              <AuditPanel
                result={auditResult}
                busy={auditBusy}
                backendAvailable={backendAvailable}
                onVerify={() => void verifyAudit()}
                onTamper={() => void tamperAudit()}
              />
            </div>
          </div>
        </main>

        <footer className="dashboard-footer">
          <div className="privacy-copy"><BadgeCheck aria-hidden="true" /><p>In live mode, microphone audio is streamed to the ResoGuard backend for scoring. Audio is not stored; only scores and metadata are logged in a hash-chained audit trail.</p></div>
          <div className="footer-meta"><span>SIH26104</span><span>SECURE BY DESIGN / HUMAN-VERIFIED</span></div>
        </footer>
      </div>
    </div>
  );
}
