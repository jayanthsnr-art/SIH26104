"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, BadgeCheck, Check, CircleAlert, Fingerprint, LockKeyhole, ShieldX, Siren } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AuditResult, CallReport, RiskSnapshot, ResoAlert } from "@/lib/reso-guard-types";

const CHANNEL_LABELS: Record<string, string> = {
  ui: "UI",
  sms_customer: "SMS customer",
  email_supervisor: "Supervisor email",
  webhook: "Webhook",
  block_transaction: "Transaction block",
};

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function TransactionGate({ snapshot, hasScores }: { snapshot: RiskSnapshot; hasScores: boolean }) {
  const [otp, setOtp] = useState("");
  const [approved, setApproved] = useState(false);
  const [otpError, setOtpError] = useState(false);
  const action = snapshot.action;

  useEffect(() => {
    setApproved(false);
    setOtp("");
    setOtpError(false);
  }, [action]);

  const approve =  (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (action === "FREEZE" || !hasScores) return;
    if (action === "STEP_UP_MFA" && otp !== "482916") {
      setApproved(false);
      setOtpError(true);
      return;
    }
    setOtpError(false);
    setApproved(true);
  };

  return (
    <Card className={`glass-card gate-card gate-${action.toLowerCase()}`}>
      <CardHeader className="card-heading-row">
        <div>
          <p className="section-kicker">05 / PRE-TRANSACTION GATE</p>
          <CardTitle className="card-title">Transfer authorization</CardTitle>
          <CardDescription className="card-copy">Approval stays closed until the current risk action allows it.</CardDescription>
        </div>
        <span className="icon-chip"><LockKeyhole aria-hidden="true" /></span>
      </CardHeader>
      <CardContent>
        {!hasScores ? (
          <div className="gate-message gate-pending"><CircleAlert aria-hidden="true" /><span>Awaiting a scored chunk before this gate can approve.</span></div>
        ) : action === "FREEZE" ? (
          <div className="gate-message gate-blocked" role="status">
            <ShieldX aria-hidden="true" />
            <div><strong>Blocked · escalated to a supervisor</strong><span>Freeze action is latched by the ResoGuard policy.</span></div>
          </div>
        ) : approved ? (
          <div className="gate-message gate-approved" role="status">
            <BadgeCheck aria-hidden="true" />
            <div><strong>Approved</strong><span>{action === "STEP_UP_MFA" ? "MFA verification passed · demo gate" : "Current action is ALLOW · demo gate"}</span></div>
          </div>
        ) : (
          <form className="gate-form" onSubmit={approve}>
            {action === "STEP_UP_MFA" && (
              <div className="otp-field">
                <label htmlFor="mfa-otp">One-time passcode <span>DEMO CODE · 482916</span></label>
                <Input
                  id="mfa-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => { setOtp(event.target.value.replace(/\D/g, "")); setOtpError(false); }}
                  placeholder="Enter 6-digit code"
                  aria-invalid={otpError}
                  aria-describedby={otpError ? "otp-error" : undefined}
                  className="field-control otp-input"
                />
                {otpError && <p id="otp-error" className="field-error" role="alert">Code not accepted. Use the demo code shown above.</p>}
              </div>
            )}
            <Button type="submit" className="action-button gate-approve-button">
              {action === "STEP_UP_MFA" ? "Verify and approve" : "Approve transfer"}
              <ArrowUpRight data-icon="inline-end" />
            </Button>
            <p className="gate-disclaimer">Demo authorization only · this page does not execute a bank transfer.</p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function AlertsPanel({ alerts }: { alerts: ResoAlert[] }) {
  return (
    <Card className="glass-card alerts-card">
      <CardHeader className="card-heading-row">
        <div>
          <p className="section-kicker">06 / RESPONSE ROUTING</p>
          <CardTitle className="card-title">Alerts</CardTitle>
          <CardDescription className="card-copy">Backend policy notifications as risk actions change.</CardDescription>
        </div>
        <span className="icon-chip"><Siren aria-hidden="true" /></span>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="empty-panel"><span className="empty-dot" /> No policy alerts have been raised.</div>
        ) : (
          <div className="alert-list" aria-live="polite" aria-relevant="additions">
            {alerts.map((alert) => (
              <article key={alert.id} className={`alert-event alert-${alert.action.toLowerCase()}`}>
                <div className="alert-event-heading">
                  <Badge variant="outline" className={`action-badge badge-${alert.action.toLowerCase()}`}>
                    {alert.action.replaceAll("_", " ")}
                  </Badge>
                  <time dateTime={new Date(alert.timestamp).toISOString()}>
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </time>
                </div>
                <p>{alert.text || "Policy alert dispatched."}</p>
                <div className="channel-list" aria-label="Alert channels">
                  <Badge variant="outline" className="channel-chip">{CHANNEL_LABELS[alert.channel] ?? alert.channel}</Badge>
                  {alert.mode && <Badge variant="outline" className="channel-chip">{alert.mode}</Badge>}
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportPanel({ report }: { report: CallReport }) {
  const metrics = [
    { label: "Peak risk", value: report.peakRisk === null ? "—" : `${Math.round(report.peakRisk * 100)}%` },
    { label: "First MFA", value: formatDuration(report.firstMfaSeconds) },
    { label: "Time frozen", value: formatDuration(report.frozenSeconds) },
    { label: "Chunks scored", value: report.chunksScored.toLocaleString() },
    { label: "Average processing", value: report.averageProcessingMs === null ? "—" : `${report.averageProcessingMs.toFixed(1)} ms` },
  ];
  return (
    <Card className="glass-card report-card">
      <CardHeader>
        <p className="section-kicker">07 / SESSION SUMMARY</p>
        <CardTitle className="card-title">Call report</CardTitle>
        <CardDescription className="card-copy">Measurements from scored chunks in this session.</CardDescription>
      </CardHeader>
      <CardContent className="report-grid">
        {metrics.map((metric) => (
          <div key={metric.label} className="report-metric">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AuditPanel({
  result,
  busy,
  backendAvailable,
  onVerify,
  onTamper,
}: {
  result: AuditResult | null;
  busy: boolean;
  backendAvailable: boolean;
  onVerify: () => void;
  onTamper: () => void;
}) {
  const state = result === null ? "NOT VERIFIED" : result.intact ? "INTACT" : "BROKEN";
  return (
    <Card className="glass-card audit-card">
      <CardHeader className="card-heading-row">
        <div>
          <p className="section-kicker">08 / INTEGRITY CHECK</p>
          <CardTitle className="card-title">Audit trail</CardTitle>
          <CardDescription className="card-copy">Verify the backend hash chain and its Merkle summary.</CardDescription>
        </div>
        <span className="icon-chip"><Fingerprint aria-hidden="true" /></span>
      </CardHeader>
      <CardContent>
        <div className={`audit-state audit-${state.toLowerCase().replaceAll(" ", "-")}`} role="status" aria-live="polite">
          <i aria-hidden="true" />
          <strong>{state}</strong>
          {result && <span>{result.count.toLocaleString()} entries</span>}
        </div>
        <div className="audit-root">
          <span>MERKLE ROOT · FIRST 16</span>
          <code>{result?.merkle_root ? result.merkle_root.slice(0, 16) : "—"}</code>
        </div>
        <div className="audit-actions">
          <Button type="button" variant="outline" className="secondary-button" disabled={busy || !backendAvailable} onClick={onVerify}>
            <Check data-icon="inline-start" /> Verify audit log
          </Button>
          <Button type="button" variant="outline" className="tamper-button" disabled={busy || !backendAvailable} onClick={onTamper}>
            <CircleAlert data-icon="inline-start" /> Tamper with log entry
          </Button>
        </div>
        {!backendAvailable && <p className="audit-note">Connect the backend to inspect its audit trail.</p>}
        {backendAvailable && <p className="audit-note">Tamper is a destructive backend demo endpoint. Use only with a disposable demo audit log.</p>}
      </CardContent>
    </Card>
  );
}
