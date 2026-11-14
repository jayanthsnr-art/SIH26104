import type { CSSProperties } from "react";
import { Activity, Clock3, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RiskAction, RiskSnapshot, SessionStatus } from "@/lib/reso-guard-types";

const ACTION_TEXT: Record<RiskAction, string> = {
  ALLOW: "Allow",
  STEP_UP_MFA: "Step-up MFA required",
  FREEZE: "Call frozen",
};

const ACTION_ICON = {
  ALLOW: ShieldCheck,
  STEP_UP_MFA: ShieldAlert,
  FREEZE: ShieldX,
};

export function RiskGauge({
  snapshot,
  elapsedText,
  status,
  hasScores,
}: {
  snapshot: RiskSnapshot;
  elapsedText: string;
  status: SessionStatus;
  hasScores: boolean;
}) {
  const risk = Math.round(snapshot.R * 100);
  const Icon = ACTION_ICON[snapshot.action];
  const stateLabel = status === "connecting"
    ? "Connecting to backend"
    : status === "enrolling"
      ? "Enrolling voice"
      : status === "listening"
        ? "Listening"
        : hasScores
          ? ACTION_TEXT[snapshot.action]
          : "Ready for a score";

  return (
    <Card className={`glass-card risk-card risk-${snapshot.action.toLowerCase()}`} data-risk={snapshot.action}>
      <CardHeader className="card-heading-row">
        <div>
          <p className="section-kicker">02 / LIVE DECISION</p>
          <CardTitle className="card-title">Risk signal</CardTitle>
          <CardDescription className="card-copy">Fused confidence · smoothed risk R(t)</CardDescription>
        </div>
        <Badge variant="outline" className={`action-badge badge-${snapshot.action.toLowerCase()}`}>
          <Icon data-icon="inline-start" />
          {snapshot.action.replaceAll("_", " ")}
        </Badge>
      </CardHeader>
      <CardContent className="risk-content">
        <div className="risk-center-row">
          <div
            className={`risk-gauge gauge-${snapshot.action.toLowerCase()} ${snapshot.action === "FREEZE" ? "gauge-pulse" : ""}`}
            role="meter"
            aria-label="Current call risk"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={risk}
            aria-valuetext={`${risk}% risk · ${ACTION_TEXT[snapshot.action]}`}
            style={{ "--risk-progress": `${risk}%` } as CSSProperties}
          >
            <div className="gauge-inner">
              <span className="gauge-value">{risk}<small>%</small></span>
              <span className="gauge-caption">RISK SCORE</span>
            </div>
          </div>
          <div className="risk-summary">
            <span className="live-state">
              <i className={status === "listening" ? "state-dot state-live" : "state-dot"} aria-hidden="true" />
              {stateLabel}
            </span>
            <strong className="action-description">{hasScores ? ACTION_TEXT[snapshot.action] : "Awaiting signal"}</strong>
            <span className="risk-clock"><Clock3 aria-hidden="true" /> {elapsedText} elapsed</span>
          </div>
        </div>

        <div className="signal-stats">
          <div className="signal-stat"><span>Fused p</span><strong>{hasScores ? snapshot.p.toFixed(2) : "—"}</strong></div>
          <div className="signal-stat"><span>Context prior</span><strong>{snapshot.prior === null ? "—" : snapshot.prior.toFixed(2)}</strong></div>
          <div className="signal-stat"><span>Processing</span><strong>{snapshot.ms === null ? "—" : `${snapshot.ms.toFixed(1)} ms`}</strong></div>
        </div>

        {snapshot.warning && (
          <div className={`risk-warning warning-${snapshot.action.toLowerCase()}`} role="alert" aria-live="assertive">
            <Icon aria-hidden="true" />
            <p>{snapshot.warning}</p>
          </div>
        )}
        {!hasScores && status === "idle" && (
          <div className="risk-placeholder"><Activity aria-hidden="true" /> Start monitoring to receive the first risk score.</div>
        )}
      </CardContent>
    </Card>
  );
}
