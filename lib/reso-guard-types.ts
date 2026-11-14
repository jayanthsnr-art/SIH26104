export type RiskAction = "ALLOW" | "STEP_UP_MFA" | "FREEZE";

export type SessionStatus = "idle" | "connecting" | "listening" | "enrolling";

export type DemoProfile = "genuine" | "cloned" | "takeover";

export type Scenario =
  | "default"
  | "high_value_transfer"
  | "privileged_access"
  | "routine_inquiry";

export type CallOrigin = "known" | "unknown" | "international" | "voip";

export type Language = "en" | "ta" | "hi" | "te";

export interface CallSettings {
  scenario: Scenario;
  origin: CallOrigin;
  knownContact: boolean;
  amount: number;
  language: Language;
  callerId: string;
}

export interface PolicyThresholds {
  mfaAt: number;
  freezeAt: number;
}

export interface ResoAlert {
  id: string;
  channel: string;
  mode?: string;
  text?: string;
  action: RiskAction;
  timestamp: number;
}

export interface ScoreMessage {
  p: number;
  R: number;
  action: RiskAction;
  acoustic: number | null;
  prosody: number | null;
  speaker: number | null;
  prior: number | null;
  ms: number | null;
  alerts?: Array<{ channel: string; mode?: string; text?: string }>;
  warning?: string | null;
}

export interface RiskSnapshot extends ScoreMessage {
  warning: string | null;
  alerts: ResoAlert[];
}

export interface CallReport {
  peakRisk: number | null;
  firstMfaSeconds: number | null;
  frozenSeconds: number | null;
  chunksScored: number;
  averageProcessingMs: number | null;
}

export interface AuditResult {
  intact: boolean;
  count: number;
  last: unknown[];
  merkle_root: string;
}
