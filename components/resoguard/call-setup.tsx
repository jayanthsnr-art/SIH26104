"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { CallSettings, DemoProfile, PolicyThresholds } from "@/lib/reso-guard-types";

interface CallSetupProps {
  settings: CallSettings;
  onSettingsChange: (next: CallSettings) => void;
  previewThresholds: PolicyThresholds;
  onPreviewThresholdsChange: (next: PolicyThresholds) => void;
  demoProfile: DemoProfile;
  onDemoProfileChange: (profile: DemoProfile) => void;
  demoMode: boolean;
  active: boolean;
}

const scenarioOptions = [
  { value: "default", label: "Default" },
  { value: "high_value_transfer", label: "High-value transfer" },
  { value: "privileged_access", label: "Privileged access" },
  { value: "routine_inquiry", label: "Routine inquiry" },
] as const;

const originOptions = [
  { value: "known", label: "Known number" },
  { value: "unknown", label: "Unknown number" },
  { value: "international", label: "International" },
  { value: "voip", label: "VoIP" },
] as const;

const languageOptions = [
  { value: "en", label: "English" },
  { value: "ta", label: "Tamil" },
  { value: "hi", label: "Hindi" },
  { value: "te", label: "Telugu" },
] as const;

const demoOptions = [
  { value: "genuine", label: "Genuine caller" },
  { value: "cloned", label: "Cloned caller" },
  { value: "takeover", label: "Genuine, then clone takes over" },
] as const;

export function CallSetup({
  settings,
  onSettingsChange,
  previewThresholds,
  onPreviewThresholdsChange,
  demoProfile,
  onDemoProfileChange,
  demoMode,
  active,
}: CallSetupProps) {
  const update = <K extends keyof CallSettings>(key: K, value: CallSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Card className="glass-card call-setup-card">
      <CardHeader className="card-heading-row">
        <div>
          <p className="section-kicker">01 / SESSION CONTEXT</p>
          <CardTitle className="card-title">Call setup</CardTitle>
          <CardDescription className="card-copy">Set the context before opening a live scoring session.</CardDescription>
        </div>
        <Badge variant="outline" className="quiet-badge">
          <SlidersHorizontal data-icon="inline-start" />
          POLICY PREVIEW
        </Badge>
      </CardHeader>
      <CardContent className="setup-content">
        <FieldGroup className="setup-grid">
          <Field>
            <FieldLabel id="scenario-label">Scenario</FieldLabel>
            <Select value={settings.scenario} onValueChange={(value) => update("scenario", value as CallSettings["scenario"])}>
              <SelectTrigger aria-labelledby="scenario-label" className="field-control" disabled={active}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {scenarioOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel id="origin-label">Call origin</FieldLabel>
            <Select value={settings.origin} onValueChange={(value) => update("origin", value as CallSettings["origin"])}>
              <SelectTrigger aria-labelledby="origin-label" className="field-control" disabled={active}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {originOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel id="known-contact-label">Known contact</FieldLabel>
            <Select value={String(settings.knownContact)} onValueChange={(value) => update("knownContact", value === "true")}>
              <SelectTrigger aria-labelledby="known-contact-label" className="field-control" disabled={active}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="true">Yes · enrolled contact</SelectItem>
                  <SelectItem value="false">No · unverified contact</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel id="amount-label">Transfer amount</FieldLabel>
            <Select value={String(settings.amount)} onValueChange={(value) => update("amount", Number(value))}>
              <SelectTrigger aria-labelledby="amount-label" className="field-control" disabled={active}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="0">None</SelectItem>
                  <SelectItem value="50000">INR 50,000</SelectItem>
                  <SelectItem value="500000">INR 5,00,000</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel id="language-label">Language</FieldLabel>
            <Select value={settings.language} onValueChange={(value) => update("language", value as CallSettings["language"])}>
              <SelectTrigger aria-labelledby="language-label" className="field-control" disabled={active}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {languageOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="caller-id">Caller ID</FieldLabel>
            <Input
              id="caller-id"
              className="field-control"
              value={settings.callerId}
              onChange={(event) => update("callerId", event.target.value)}
              autoComplete="off"
              maxLength={80}
              placeholder="demo-caller"
              disabled={active}
            />
          </Field>
        </FieldGroup>

        {demoMode && (
          <div className="demo-profile-row">
            <Field className="demo-profile-field">
              <FieldLabel id="demo-profile-label">Simulation profile</FieldLabel>
              <Select value={demoProfile} onValueChange={(value) => onDemoProfileChange(value as DemoProfile)}>
                <SelectTrigger aria-labelledby="demo-profile-label" className="field-control" disabled={active}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {demoOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <p className="demo-profile-note">Synthetic scores only · no microphone capture</p>
          </div>
        )}

        <div className="policy-preview">
          <div className="policy-preview-heading">
            <div>
              <p className="section-kicker">THRESHOLD DISPLAY</p>
              <h3>Risk policy preview</h3>
            </div>
            <ChevronDown aria-hidden="true" />
          </div>
          <div className="policy-slider-grid">
            <div className="policy-slider">
              <div className="policy-slider-label">
                <span>Step-up MFA</span>
                <output>{previewThresholds.mfaAt.toFixed(2)}</output>
              </div>
              <Slider
                thumbLabels={["Step-up MFA risk threshold"]}
                value={[previewThresholds.mfaAt]}
                disabled={active}
                min={0.1}
                max={0.9}
                step={0.01}
                onValueChange={(value) => onPreviewThresholdsChange({
                  ...previewThresholds,
                  mfaAt: Math.min(
                    Array.isArray(value) ? value[0] ?? previewThresholds.mfaAt : value,
                    previewThresholds.freezeAt - 0.05,
                  ),
                })}
                className="neon-slider"
              />
            </div>
            <div className="policy-slider">
              <div className="policy-slider-label">
                <span>Freeze call</span>
                <output>{previewThresholds.freezeAt.toFixed(2)}</output>
              </div>
              <Slider
                thumbLabels={["Freeze-call risk threshold"]}
                value={[previewThresholds.freezeAt]}
                disabled={active}
                min={0.2}
                max={0.98}
                step={0.01}
                onValueChange={(value) => onPreviewThresholdsChange({
                  ...previewThresholds,
                  freezeAt: Math.max(
                    Array.isArray(value) ? value[0] ?? previewThresholds.freezeAt : value,
                    previewThresholds.mfaAt + 0.05,
                  ),
                })}
                className="neon-slider freeze-slider"
              />
            </div>
          </div>
          <FieldDescription className="policy-disclaimer">
            Sliders are a display and demo-policy preview only. In live mode, server policy thresholds control every action.
          </FieldDescription>
        </div>
      </CardContent>
    </Card>
  );
}
